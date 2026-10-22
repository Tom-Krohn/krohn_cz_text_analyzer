import { and, eq } from "drizzle-orm";
import { isHostAllowed } from "@/lib/import/url";
import { getDb } from "@/lib/db";
import { pageFields, pages, projects } from "@/lib/db/schema";
import { validateProjectSelectors, type ProjectSelectors } from "@/lib/projects/selectors";
import { fetchPublicUrl } from "@/lib/security/network";
import { detectPageKind, extractFields, hashText, type ExtractedField } from "./extract";

const MAX_HTML_BYTES = 3 * 1024 * 1024;
const MAX_FETCH_TIMEOUT_MS = 15_000;
const BLOCKED_STATUSES = [401, 403, 429];

export type ScrapeOutcome = { status: "scraped" | "failed" | "blocked" | "skipped"; message: string };
export type ExtractionPreview = { finalUrl: string; fields: ExtractedField[]; htmlTruncated: boolean };

function fetchProjectUrl(url: string, allowedHosts: string[]) {
	return fetchPublicUrl(url, {
		maxBytes: MAX_HTML_BYTES,
		timeoutMs: MAX_FETCH_TIMEOUT_MS,
		acceptedHosts: (hostname) => isHostAllowed(hostname, allowedHosts),
	});
}

export async function scrapePage(projectId: string, pageId: string): Promise<ScrapeOutcome> {
	const db = getDb();
	const [project] = await db
		.select({ allowedHosts: projects.allowedHosts, selectors: projects.selectors })
		.from(projects)
		.where(eq(projects.id, projectId));
	const [page] = await db
		.select({ url: pages.url })
		.from(pages)
		.where(and(eq(pages.id, pageId), eq(pages.projectId, projectId)));
	if (!project || !page) throw new Error("Stránka v projektu neexistuje.");

	await db.update(pages).set({ scrapeStatus: "scraping", updatedAt: new Date() }).where(eq(pages.id, pageId));

	try {
		const response = await fetchProjectUrl(page.url, project.allowedHosts);
		const outcome = classifyResponse(response.status, response.contentType);
		if (outcome) return await saveOutcome(pageId, outcome, response.status, response.finalUrl);

		const html = response.body.toString("utf8");
		const fields = extractFields(html, project.selectors);
		await db.transaction(async (tx) => {
			const existingFields = await tx
				.select({ field: pageFields.field, sourceHash: pageFields.sourceHash })
				.from(pageFields)
				.where(eq(pageFields.pageId, pageId));
			const existingHashes = new Map(existingFields.map((field) => [field.field, field.sourceHash]));
			const sourceChanged =
				existingFields.length !== fields.length ||
				fields.some((field) => existingHashes.get(field.field) !== (field.text ? hashText(field.text) : ""));

			for (const field of fields) {
				const values = {
					pageId,
					field: field.field,
					sourceText: field.text,
					sourceHash: field.text ? hashText(field.text) : "",
					extraction: field.extraction,
					extractionNote: field.note,
					updatedAt: new Date(),
				};
				await tx
					.insert(pageFields)
					.values(values)
					.onConflictDoUpdate({
						target: [pageFields.pageId, pageFields.field],
						set: {
							sourceText: values.sourceText,
							sourceHash: values.sourceHash,
							extraction: values.extraction,
							extractionNote: values.extractionNote,
							updatedAt: values.updatedAt,
						},
					});
			}
			await tx
				.update(pages)
				.set({
					kind: detectPageKind(html),
					scrapeStatus: "scraped",
					httpStatus: response.status,
					finalUrl: response.finalUrl,
					errorMessage: null,
					...(sourceChanged ? { analyzedAt: null } : {}),
					scrapedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(pages.id, pageId));
		});
		return { status: "scraped", message: "Texty byly načteny." };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Neznámá chyba scrapování.";
		await db
			.update(pages)
			.set({ scrapeStatus: "failed", errorMessage: message, updatedAt: new Date() })
			.where(eq(pages.id, pageId));
		return { status: "failed", message };
	}
}

export async function previewPageExtraction(
	projectId: string,
	pageId: string,
	selectors: ProjectSelectors,
): Promise<ExtractionPreview> {
	validateProjectSelectors(selectors);
	const db = getDb();
	const [project] = await db
		.select({ allowedHosts: projects.allowedHosts })
		.from(projects)
		.where(eq(projects.id, projectId));
	if (!project) throw new Error("Projekt neexistuje.");

	const [page] = await db
		.select({ url: pages.url })
		.from(pages)
		.where(and(eq(pages.id, pageId), eq(pages.projectId, projectId)));
	if (!page) throw new Error("Vzorová stránka v projektu neexistuje.");

	const response = await fetchProjectUrl(page.url, project.allowedHosts);
	const outcome = classifyResponse(response.status, response.contentType);
	if (outcome) throw new Error(outcome.message);

	return {
		finalUrl: response.finalUrl,
		fields: extractFields(response.body.toString("utf8"), selectors),
		htmlTruncated: response.truncated,
	};
}

function classifyResponse(status: number, contentType: string): Pick<ScrapeOutcome, "status" | "message"> | null {
	if (BLOCKED_STATUSES.includes(status))
		return { status: "blocked", message: `Server odmítl přístup (HTTP ${status}).` };
	if (status < 200 || status >= 300) return { status: "failed", message: `Server vrátil HTTP ${status}.` };
	if (!contentType.includes("text/html")) return { status: "skipped", message: "Odpověď není HTML stránka." };
	return null;
}

async function saveOutcome(
	pageId: string,
	outcome: Pick<ScrapeOutcome, "status" | "message">,
	httpStatus: number,
	finalUrl: string,
): Promise<ScrapeOutcome> {
	await getDb()
		.update(pages)
		.set({ scrapeStatus: outcome.status, httpStatus, finalUrl, errorMessage: outcome.message, updatedAt: new Date() })
		.where(eq(pages.id, pageId));
	return { status: outcome.status, message: outcome.message };
}
