import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { resolveProviderForProject } from "@/lib/ai/settings";
import { getDb } from "@/lib/db";
import { pages, processingJobs, projects } from "@/lib/db/schema";
import { inngest } from "./client";

export type BatchKind = "scrape" | "analyze";

export const BATCH_CHUNK_SIZE: Record<BatchKind, number> = { scrape: 10, analyze: 1 };

const EVENT_BY_KIND: Record<BatchKind, "batch/scrape" | "batch/analyze"> = {
	scrape: "batch/scrape",
	analyze: "batch/analyze",
};

export const ACTIVE_JOB_STATUSES = ["queued", "running", "waiting_quota"] as const;
export const TERMINAL_JOB_STATUSES = ["done", "failed", "cancelled"] as const;

function candidateFilter(kind: BatchKind, projectId: string): SQL {
	if (kind === "scrape") return and(eq(pages.projectId, projectId), eq(pages.scrapeStatus, "pending")) as SQL;
	return and(eq(pages.projectId, projectId), eq(pages.scrapeStatus, "scraped"), isNull(pages.analyzedAt)) as SQL;
}

export async function countBatchCandidates(projectId: string, kind: BatchKind): Promise<number> {
	const [row] = await getDb()
		.select({ total: sql<number>`count(*)::int` })
		.from(pages)
		.where(candidateFilter(kind, projectId));
	return row.total;
}

export async function startBatch(projectId: string, kind: BatchKind) {
	const db = getDb();
	const [active] = await db
		.select({ id: processingJobs.id })
		.from(processingJobs)
		.where(
			and(
				eq(processingJobs.projectId, projectId),
				eq(processingJobs.kind, kind),
				inArray(processingJobs.status, [...ACTIVE_JOB_STATUSES]),
			),
		)
		.limit(1);
	if (active) throw new Error("Stejná úloha pro tento projekt už běží nebo čeká ve frontě.");

	if (kind === "analyze") {
		const [project] = await db
			.select({ provider: projects.provider, model: projects.model })
			.from(projects)
			.where(eq(projects.id, projectId));
		if (!project) throw new Error("Projekt neexistuje.");
		await resolveProviderForProject(project.provider, project.model);
	}

	const total = await countBatchCandidates(projectId, kind);
	if (total === 0) throw new Error("Nejsou žádné URL, které by šlo zpracovat.");

	const [job] = await db
		.insert(processingJobs)
		.values({ projectId, kind, status: "queued", idempotencyKey: randomUUID(), total })
		.returning({ id: processingJobs.id });

	try {
		await inngest.send({ name: EVENT_BY_KIND[kind], data: { jobId: job.id, projectId } });
	} catch (error) {
		await finishBatch(
			job.id,
			"failed",
			"Frontu se nepodařilo spustit. Běží Inngest dev server? Spusťte pnpm jobs:dev.",
		);
		throw new Error("Úlohu nelze zařadit do fronty. Spusťte Inngest dev server příkazem pnpm jobs:dev.", {
			cause: error,
		});
	}
	return { jobId: job.id, total };
}

export async function claimChunk(jobId: string): Promise<{ pageIds: string[] } | null> {
	const db = getDb();
	const [job] = await db.select().from(processingJobs).where(eq(processingJobs.id, jobId));
	if (!job || !(ACTIVE_JOB_STATUSES as readonly string[]).includes(job.status)) return null;

	const kind = job.kind as BatchKind;
	const rows = await db
		.select({ id: pages.id })
		.from(pages)
		.where(and(candidateFilter(kind, job.projectId), job.cursor ? gt(pages.id, job.cursor) : undefined))
		.orderBy(asc(pages.id))
		.limit(BATCH_CHUNK_SIZE[kind]);

	if (job.status !== "running") {
		await db
			.update(processingJobs)
			.set({ status: "running", updatedAt: new Date() })
			.where(eq(processingJobs.id, jobId));
	}
	return { pageIds: rows.map((row) => row.id) };
}

export async function advanceChunk(
	jobId: string,
	lastPageId: string,
	processedCount: number,
	failedCount: number,
	lastError?: string,
) {
	await getDb()
		.update(processingJobs)
		.set({
			cursor: lastPageId,
			processed: sql`${processingJobs.processed} + ${processedCount}`,
			failed: sql`${processingJobs.failed} + ${failedCount}`,
			...(lastError ? { lastError } : {}),
			updatedAt: new Date(),
		})
		.where(eq(processingJobs.id, jobId));
}

export async function finishBatch(jobId: string, status: "done" | "failed", lastError?: string) {
	await getDb()
		.update(processingJobs)
		.set({ status, lastError: lastError ?? null, finishedAt: new Date(), updatedAt: new Date() })
		.where(and(eq(processingJobs.id, jobId), inArray(processingJobs.status, [...ACTIVE_JOB_STATUSES])));
}

export async function cancelBatch(projectId: string, jobId: string) {
	await getDb()
		.update(processingJobs)
		.set({ status: "cancelled", finishedAt: new Date(), updatedAt: new Date() })
		.where(
			and(
				eq(processingJobs.id, jobId),
				eq(processingJobs.projectId, projectId),
				inArray(processingJobs.status, [...ACTIVE_JOB_STATUSES]),
			),
		);
}

export async function deleteFinishedBatchJob(projectId: string, jobId: string): Promise<void> {
	const [deleted] = await getDb()
		.delete(processingJobs)
		.where(
			and(
				eq(processingJobs.id, jobId),
				eq(processingJobs.projectId, projectId),
				inArray(processingJobs.status, [...TERMINAL_JOB_STATUSES]),
			),
		)
		.returning({ id: processingJobs.id });
	if (!deleted) throw new Error("Úloha neexistuje nebo ještě není ukončená.");
}

export function listActiveBatchJobs(projectId: string) {
	return getDb()
		.select()
		.from(processingJobs)
		.where(and(eq(processingJobs.projectId, projectId), inArray(processingJobs.status, [...ACTIVE_JOB_STATUSES])))
		.orderBy(desc(processingJobs.createdAt));
}

export function listBatchJobsAcrossProjects() {
	return getDb()
		.select({ job: processingJobs, projectName: projects.name })
		.from(processingJobs)
		.innerJoin(projects, eq(processingJobs.projectId, projects.id))
		.orderBy(asc(projects.name), desc(processingJobs.createdAt));
}
