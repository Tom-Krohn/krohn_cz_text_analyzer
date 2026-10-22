import { z } from "zod";
import { normalizeProjectSelectors, validateProjectSelectors, type ProjectSelectors } from "./selectors";

const HOST_PATTERN = /^(?=.{1,253}$)([a-z0-9-]+\.)+[a-z]{2,63}$/;

const extractionSettingsFields = {
	mainContentSelector: z.string().trim().max(300).default(""),
	shortDescriptionSelector: z.string().trim().max(300).default(""),
	longDescriptionSelector: z.string().trim().max(300).default(""),
	excludedSelectorsText: z.string().trim().max(3000).default(""),
};

export const extractionSettingsSchema = z.object(extractionSettingsFields);

export function parseAllowedHosts(raw: string): string[] {
	const hosts = raw
		.split(/[\s,;]+/)
		.map((entry) => entry.trim().toLowerCase())
		.filter(Boolean)
		.map((entry) => {
			if (!entry.includes("://")) return entry;
			if (!URL.canParse(entry)) throw new Error(`Neplatná doména: ${entry}`);
			return new URL(entry).hostname;
		});
	const invalid = hosts.find((host) => !HOST_PATTERN.test(host));
	if (invalid) throw new Error(`Neplatná doména: ${invalid}`);
	return [...new Set(hosts)];
}

export const projectInputSchema = z.object({
	name: z.string().trim().min(1, "Zadejte název projektu.").max(120),
	allowedHostsText: z.string().trim().min(1, "Zadejte alespoň jednu doménu."),
	audience: z.string().trim().max(500).default(""),
	tone: z.string().trim().max(300).default(""),
	rules: z.string().trim().max(4000).default(""),
	qualityThreshold: z.coerce.number().int().min(0).max(100).default(70),
	...extractionSettingsFields,
});

export type ProjectInput = z.infer<typeof projectInputSchema>;

export function toProjectSelectors(input: z.infer<typeof extractionSettingsSchema>): ProjectSelectors {
	const selectors: ProjectSelectors = {};
	const mainContent = input.mainContentSelector.trim();
	const shortDescription = input.shortDescriptionSelector.trim();
	const longDescription = input.longDescriptionSelector.trim();
	const excluded = input.excludedSelectorsText
		.split(/\r?\n/)
		.map((selector) => selector.trim())
		.filter(Boolean);

	if (mainContent) selectors.main_content = mainContent;
	if (shortDescription) selectors.short_description = shortDescription;
	if (longDescription) selectors.long_description = longDescription;
	if (excluded.length > 0) selectors.exclude = excluded;

	validateProjectSelectors(selectors);
	return normalizeProjectSelectors(selectors);
}

export function toProjectValues(input: ProjectInput) {
	return {
		name: input.name,
		allowedHosts: parseAllowedHosts(input.allowedHostsText),
		audience: input.audience,
		tone: input.tone,
		rules: input.rules,
		qualityThreshold: input.qualityThreshold,
		selectors: toProjectSelectors(input),
	};
}
