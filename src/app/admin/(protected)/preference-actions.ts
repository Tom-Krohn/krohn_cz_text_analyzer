"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { parsePreferenceValue, saveAccountPreferences, writePreferenceCookies } from "@/lib/i18n/preferences";

function getSafeReturnPath(referer: string | null, requestHost: string | null): string {
	if (!referer || !requestHost || !URL.canParse(referer)) return "/admin";
	const target = new URL(referer);
	if (target.host !== requestHost || (target.pathname !== "/admin" && !target.pathname.startsWith("/admin/"))) {
		return "/admin";
	}
	target.searchParams.delete("notice");
	target.searchParams.delete("error");
	return `${target.pathname}${target.search}`;
}

export async function saveUiPreferenceAction(formData: FormData): Promise<never> {
	const session = await requireAdmin();
	const email = session.user?.email;
	if (!email) throw new Error("Authenticated account has no email for UI preferences.");

	const patch = parsePreferenceValue(formData.get("locale"), formData.get("theme"));
	const preferences = await saveAccountPreferences(email, patch);
	await writePreferenceCookies(preferences);
	revalidatePath("/", "layout");

	const requestHeaders = await headers();
	redirect(getSafeReturnPath(requestHeaders.get("referer"), requestHeaders.get("host")));
}
