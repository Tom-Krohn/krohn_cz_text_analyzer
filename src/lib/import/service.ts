import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { feedSources, pages, projects } from "@/lib/db/schema";
import { fetchPublicUrl } from "@/lib/security/network";
import { decodeFeedBytes, parseFeedXml, planImport, type FeedFormat, type ImportPlan, type ParsedFeed } from "./feed";

export const MAX_FEED_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_SITEMAP_FILES = 50;
const INSERT_CHUNK_SIZE = 500;

async function fetchAndParse(url: string, format: FeedFormat): Promise<ParsedFeed> {
	const response = await fetchPublicUrl(url, { maxBytes: MAX_FEED_BYTES, timeoutMs: 20_000 });
	if (response.status !== 200) throw new Error(`Feed ${url} vrátil HTTP ${response.status}.`);
	if (response.truncated) throw new Error(`Feed ${url} překračuje povolenou velikost.`);
	return parseFeedXml(decodeFeedBytes(response.body, MAX_FEED_BYTES), format);
}

export async function expandSitemapIndexes(initial: ParsedFeed, format: FeedFormat): Promise<string[]> {
	const urls = [...initial.urls];
	const queue = [...initial.sitemapIndexUrls];
	const visited = new Set<string>();
	while (queue.length > 0) {
		const next = queue.shift() as string;
		if (visited.has(next)) continue;
		if (visited.size >= MAX_SITEMAP_FILES) throw new Error("Sitemap index obsahuje příliš mnoho souborů.");
		visited.add(next);
		const child = await fetchAndParse(next, format);
		urls.push(...child.urls);
		queue.push(...child.sitemapIndexUrls);
	}
	return urls;
}

export async function collectFeedUrlsFromUrl(feedUrl: string, format: FeedFormat): Promise<string[]> {
	return expandSitemapIndexes(await fetchAndParse(feedUrl, format), format);
}

export function collectFeedUrlsFromUpload(bytes: Buffer, format: FeedFormat): Promise<string[]> {
	if (bytes.length > MAX_UPLOAD_BYTES) throw new Error("Soubor je větší než 4 MB. Použijte URL feedu.");
	return expandSitemapIndexes(parseFeedXml(decodeFeedBytes(bytes, MAX_FEED_BYTES), format), format);
}

export type ImportSource = {
	format: FeedFormat;
	sourceUrl?: string;
	fileName?: string;
};

export async function importCandidateUrls(projectId: string, source: ImportSource, candidates: string[]) {
	return getDb().transaction(async (tx) => {
		const [project] = await tx
			.select({ allowedHosts: projects.allowedHosts })
			.from(projects)
			.where(eq(projects.id, projectId))
			.for("update");
		if (!project) throw new Error("Projekt neexistuje.");

		const existing = await tx.select({ url: pages.url }).from(pages).where(eq(pages.projectId, projectId));
		const plan: ImportPlan = planImport({
			candidates,
			allowedHosts: project.allowedHosts,
			existingUrls: new Set(existing.map((row) => row.url)),
		});

		const [feed] = await tx
			.insert(feedSources)
			.values({
				projectId,
				format: source.format,
				sourceUrl: source.sourceUrl ?? null,
				fileName: source.fileName ?? null,
				report: {
					candidates: candidates.length,
					added: plan.toInsert.length,
					alreadyKnown: plan.alreadyKnown,
					invalid: plan.invalid,
					outsideAllowedHosts: plan.outsideAllowedHosts,
					duplicatesInFeed: plan.duplicatesInFeed,
					overLimit: plan.overLimit,
				},
			})
			.returning({ id: feedSources.id });

		for (let offset = 0; offset < plan.toInsert.length; offset += INSERT_CHUNK_SIZE) {
			const chunk = plan.toInsert.slice(offset, offset + INSERT_CHUNK_SIZE);
			await tx.insert(pages).values(chunk.map((url) => ({ projectId, url, sourceFeedId: feed.id })));
		}
		return { plan, feedSourceId: feed.id };
	});
}
