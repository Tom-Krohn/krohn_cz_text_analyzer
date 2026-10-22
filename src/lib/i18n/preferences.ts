import { cache } from "react";
import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { DEFAULT_UI_PREFERENCES, localeSchema, themeSchema, uiPreferencesSchema } from "./types";
import type { UiPreferences } from "./types";

const PREFERENCES_KEY_PREFIX = "account_ui_preferences:";
const LOCALE_COOKIE = "krohn-ui-locale";
const THEME_COOKIE = "krohn-ui-theme";

function preferencesKey(email: string): string {
	return `${PREFERENCES_KEY_PREFIX}${email.trim().toLowerCase()}`;
}

function storedPreferences(value: Record<string, unknown>): UiPreferences {
	const parsed = uiPreferencesSchema.safeParse(value);
	if (!parsed.success) {
		throw new Error(`Stored UI preferences are invalid: ${parsed.error.message}`);
	}
	return parsed.data;
}

async function getAccountPreferences(email: string): Promise<UiPreferences> {
	const [row] = await getDb()
		.select({ value: appSettings.value })
		.from(appSettings)
		.where(eq(appSettings.key, preferencesKey(email)))
		.limit(1);
	return row ? storedPreferences(row.value) : DEFAULT_UI_PREFERENCES;
}

export const getRequestPreferences = cache(async (): Promise<UiPreferences> => {
	const session = await auth();
	if (session?.user) {
		const email = session.user.email;
		if (!email) throw new Error("Authenticated account has no email for UI preferences.");
		return getAccountPreferences(email);
	}

	const cookieStore = await cookies();
	const locale = localeSchema.safeParse(cookieStore.get(LOCALE_COOKIE)?.value);
	const theme = themeSchema.safeParse(cookieStore.get(THEME_COOKIE)?.value);
	return {
		locale: locale.success ? locale.data : DEFAULT_UI_PREFERENCES.locale,
		theme: theme.success ? theme.data : DEFAULT_UI_PREFERENCES.theme,
	};
});

export async function saveAccountPreferences(email: string, patch: Partial<UiPreferences>): Promise<UiPreferences> {
	const initial = uiPreferencesSchema.parse({ ...DEFAULT_UI_PREFERENCES, ...patch });
	const key = preferencesKey(email);
	const [row] = await getDb()
		.insert(appSettings)
		.values({ key, value: initial })
		.onConflictDoUpdate({
			target: appSettings.key,
			set: {
				value: sql`${appSettings.value} || ${JSON.stringify(patch)}::jsonb`,
				updatedAt: new Date(),
			},
		})
		.returning({ value: appSettings.value });
	if (!row) throw new Error("UI preferences were not returned after saving.");
	return storedPreferences(row.value);
}

export async function writePreferenceCookies(preferences: UiPreferences): Promise<void> {
	const cookieStore = await cookies();
	const options = {
		httpOnly: true,
		maxAge: 60 * 60 * 24 * 365,
		path: "/",
		sameSite: "lax" as const,
		secure: process.env.NODE_ENV === "production",
	};
	cookieStore.set(LOCALE_COOKIE, preferences.locale, options);
	cookieStore.set(THEME_COOKIE, preferences.theme, options);
}

export function parsePreferenceValue(locale: unknown, theme: unknown): Partial<UiPreferences> {
	const patch: Partial<UiPreferences> = {};
	if (locale !== null && locale !== undefined) patch.locale = localeSchema.parse(locale);
	if (theme !== null && theme !== undefined) patch.theme = themeSchema.parse(theme);
	if (patch.locale === undefined && patch.theme === undefined) {
		throw new Error("No UI preference was provided.");
	}
	return patch;
}
