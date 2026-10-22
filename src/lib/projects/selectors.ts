import * as cheerio from "cheerio";

export type ProjectSelectors = {
	main_content?: string;
	short_description?: string;
	long_description?: string;
	exclude?: string[];
};

export function validateProjectSelectors(selectors: ProjectSelectors): void {
	const entries = [
		{ label: "hlavního obsahu", selector: selectors.main_content },
		{ label: "krátkého popisu", selector: selectors.short_description },
		{ label: "dlouhého popisu", selector: selectors.long_description },
		...(selectors.exclude ?? []).map((selector, index) => ({
			label: `vylučovacího ${index + 1}`,
			selector,
		})),
	];
	const $ = cheerio.load("");

	for (const { label, selector } of entries) {
		if (!selector?.trim()) continue;
		try {
			$.root().find(selector);
		} catch (error) {
			throw new Error(`Neplatný CSS selektor pro ${label}: ${selector}`, { cause: error });
		}
	}
}

export function normalizeProjectSelectors(selectors: ProjectSelectors): ProjectSelectors {
	const normalized: ProjectSelectors = {};
	const mainContent = selectors.main_content?.trim();
	const shortDescription = selectors.short_description?.trim();
	const longDescription = selectors.long_description?.trim();
	const excluded = selectors.exclude?.map((selector) => selector.trim()).filter(Boolean) ?? [];

	if (mainContent) normalized.main_content = mainContent;
	if (shortDescription) normalized.short_description = shortDescription;
	if (longDescription) normalized.long_description = longDescription;
	if (excluded.length > 0) normalized.exclude = excluded;

	return normalized;
}

export function projectSelectorsEqual(left: ProjectSelectors, right: ProjectSelectors): boolean {
	const normalizedLeft = normalizeProjectSelectors(left);
	const normalizedRight = normalizeProjectSelectors(right);

	return (
		normalizedLeft.main_content === normalizedRight.main_content &&
		normalizedLeft.short_description === normalizedRight.short_description &&
		normalizedLeft.long_description === normalizedRight.long_description &&
		JSON.stringify(normalizedLeft.exclude ?? []) === JSON.stringify(normalizedRight.exclude ?? [])
	);
}
