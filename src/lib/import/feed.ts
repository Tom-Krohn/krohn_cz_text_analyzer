import { gunzipSync } from "node:zlib";
import { XMLParser } from "fast-xml-parser";
import { isHostAllowed, normalizeUrl } from "./url";

export const MAX_PROJECT_URLS = 10_000;

export type FeedFormat = "sitemap" | "heureka" | "zbozi";

export type ParsedFeed = {
	urls: string[];
	sitemapIndexUrls: string[];
};

const parser = new XMLParser({
	ignoreAttributes: true,
	parseTagValue: false,
	trimValues: true,
	isArray: (tagName) => ["url", "sitemap", "SHOPITEM"].includes(tagName),
});

export function decodeFeedBytes(bytes: Buffer, maxOutputBytes: number): string {
	const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
	const content = isGzip ? gunzipSync(bytes, { maxOutputLength: maxOutputBytes }) : bytes;
	return content.toString("utf8");
}

export function parseFeedXml(xml: string, format: FeedFormat): ParsedFeed {
	if (/<!(DOCTYPE|ENTITY)/i.test(xml)) throw new Error("XML s DTD nebo entitami není povolené.");
	const document = parser.parse(xml) as Record<string, unknown>;
	if (format === "sitemap") return parseSitemap(document);
	return { urls: collectShopItemUrls(document), sitemapIndexUrls: [] };
}

function parseSitemap(document: Record<string, unknown>): ParsedFeed {
	const urlset = document.urlset as { url?: Array<{ loc?: string }> } | undefined;
	if (urlset) {
		return { urls: (urlset.url ?? []).map((entry) => String(entry.loc ?? "")).filter(Boolean), sitemapIndexUrls: [] };
	}
	const index = document.sitemapindex as { sitemap?: Array<{ loc?: string }> } | undefined;
	if (index) {
		return {
			urls: [],
			sitemapIndexUrls: (index.sitemap ?? []).map((entry) => String(entry.loc ?? "")).filter(Boolean),
		};
	}
	throw new Error("Soubor není podporovaná sitemapa (chybí urlset nebo sitemapindex).");
}

function collectShopItemUrls(node: unknown, found: string[] = []): string[] {
	if (Array.isArray(node)) {
		for (const entry of node) collectShopItemUrls(entry, found);
		return found;
	}
	if (!node || typeof node !== "object") return found;
	for (const [key, value] of Object.entries(node)) {
		if (key === "SHOPITEM" && Array.isArray(value)) {
			for (const item of value as Array<{ URL?: unknown }>) {
				if (item.URL !== undefined) found.push(String(item.URL));
			}
		} else {
			collectShopItemUrls(value, found);
		}
	}
	return found;
}

export type ImportPlanInput = {
	candidates: string[];
	allowedHosts: string[];
	existingUrls: ReadonlySet<string>;
	limit?: number;
};

export type ImportPlan = {
	toInsert: string[];
	alreadyKnown: number;
	invalid: number;
	outsideAllowedHosts: number;
	duplicatesInFeed: number;
	overLimit: number;
};

export function planImport({
	candidates,
	allowedHosts,
	existingUrls,
	limit = MAX_PROJECT_URLS,
}: ImportPlanInput): ImportPlan {
	const plan: ImportPlan = {
		toInsert: [],
		alreadyKnown: 0,
		invalid: 0,
		outsideAllowedHosts: 0,
		duplicatesInFeed: 0,
		overLimit: 0,
	};
	const seen = new Set<string>();
	let projectSize = existingUrls.size;

	for (const candidate of candidates) {
		const normalized = normalizeUrl(candidate);
		if (!normalized) {
			plan.invalid += 1;
			continue;
		}
		if (!isHostAllowed(new URL(normalized).hostname, allowedHosts)) {
			plan.outsideAllowedHosts += 1;
			continue;
		}
		if (seen.has(normalized)) {
			plan.duplicatesInFeed += 1;
			continue;
		}
		seen.add(normalized);
		if (existingUrls.has(normalized)) {
			plan.alreadyKnown += 1;
			continue;
		}
		if (projectSize >= limit) {
			plan.overLimit += 1;
			continue;
		}
		projectSize += 1;
		plan.toInsert.push(normalized);
	}
	return plan;
}
