import { analyzePage } from "@/lib/ai/analysis";
import { ProviderError } from "@/lib/ai/providers";
import { scrapePage } from "@/lib/scraping/service";
import { advanceChunk, claimChunk, finishBatch } from "./batch";
import { inngest } from "./client";

const STOP_STATUSES = [401, 402, 403, 429];
const ANALYZE_THROTTLE = { limit: 8, period: "1m" as const, key: "event.data.projectId" };

type BatchEvent = { jobId: string; projectId: string };

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Neznámá chyba.";
}

export const scrapeBatch = inngest.createFunction(
	{
		id: "scrape-batch",
		triggers: [{ event: "batch/scrape" }],
		concurrency: { limit: 1, key: "event.data.jobId" },
		throttle: { limit: 6, period: "1m", key: "event.data.projectId" },
		retries: 2,
	},
	async ({ event, step }) => {
		const { jobId, projectId } = event.data as BatchEvent;
		const chunk = await step.run("claim", () => claimChunk(jobId));
		if (!chunk) return { jobId, stopped: true };
		if (chunk.pageIds.length === 0) {
			await step.run("finish", () => finishBatch(jobId, "done"));
			return { jobId, done: true };
		}

		let failed = 0;
		for (const pageId of chunk.pageIds) {
			try {
				const outcome = await step.run(`scrape-${pageId}`, () => scrapePage(projectId, pageId));
				if (outcome.status !== "scraped") failed += 1;
			} catch {
				failed += 1;
			}
		}

		await step.run("advance", () =>
			advanceChunk(jobId, chunk.pageIds[chunk.pageIds.length - 1], chunk.pageIds.length, failed),
		);
		await step.sendEvent("continue", { name: "batch/scrape", data: { jobId, projectId } });
		return { jobId, processed: chunk.pageIds.length, failed };
	},
);

export const analyzeBatch = inngest.createFunction(
	{
		id: "analyze-batch",
		triggers: [{ event: "batch/analyze" }],
		concurrency: { limit: 1, key: "event.data.projectId" },
		throttle: ANALYZE_THROTTLE,
		retries: 1,
	},
	async ({ event, step }) => {
		const { jobId, projectId } = event.data as BatchEvent;
		const chunk = await step.run("claim", () => claimChunk(jobId));
		if (!chunk) return { jobId, stopped: true };
		if (chunk.pageIds.length === 0) {
			await step.run("finish", () => finishBatch(jobId, "done"));
			return { jobId, done: true };
		}

		const pageId = chunk.pageIds[0];
		const result = await step.run(`analyze-${pageId}`, async () => {
			try {
				await analyzePage(projectId, pageId);
				return { ok: true, stop: false, message: "" };
			} catch (error) {
				const stop = error instanceof ProviderError && STOP_STATUSES.includes(error.status);
				return { ok: false, stop, message: errorMessage(error) };
			}
		});

		if (result.stop) {
			await step.run("stop", () => finishBatch(jobId, "failed", result.message));
			return { jobId, stopped: true, reason: result.message };
		}

		await step.run("advance", () =>
			advanceChunk(jobId, pageId, 1, result.ok ? 0 : 1, result.ok ? undefined : `${pageId}: ${result.message}`),
		);
		await step.sendEvent("continue", { name: "batch/analyze", data: { jobId, projectId } });
		return { jobId, pageId, ok: result.ok };
	},
);
