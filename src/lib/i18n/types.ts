import { z } from "zod";

export const locales = ["cs", "en"] as const;
export const localeSchema = z.enum(locales);
export type Locale = z.infer<typeof localeSchema>;
export const localeLabels = { cs: "CS", en: "EN" } satisfies Record<Locale, string>;

export const themes = ["light", "dark"] as const;
export const themeSchema = z.enum(themes);
export type Theme = z.infer<typeof themeSchema>;

export const uiPreferencesSchema = z.object({
	locale: localeSchema,
	theme: themeSchema,
});
export type UiPreferences = z.infer<typeof uiPreferencesSchema>;

export const DEFAULT_UI_PREFERENCES: UiPreferences = { locale: "cs", theme: "dark" };
