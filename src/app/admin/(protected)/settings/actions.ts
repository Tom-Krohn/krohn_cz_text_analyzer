"use server";

import { redirect } from "next/navigation";
import { PROVIDERS, type Provider } from "@/lib/ai/providers";
import { deleteProviderKey, getProviderKeyStatus, saveAiDefaults, saveProviderKey } from "@/lib/ai/settings";
import { requireAdmin } from "@/lib/auth/session";
import { formatActionError } from "@/lib/i18n/action-errors";
import { getRequestI18n } from "@/lib/i18n/server";
import type { UiMessages } from "@/lib/i18n/messages";

const SETTINGS_PATH = "/admin/settings";

function formText(formData: FormData, name: string): string {
	const value = formData.get(name);
	return typeof value === "string" ? value : "";
}

function parseProvider(value: string): Provider | null {
	const provider = PROVIDERS.find((item) => item === value);
	return provider ?? null;
}

function errorFeedback(error: unknown, messages: UiMessages): string {
	return formatActionError(error, messages);
}

function redirectWithMessage(key: "notice" | "error", message: string): never {
	redirect(`${SETTINGS_PATH}?${key}=${encodeURIComponent(message)}`);
}

export async function saveProviderKeyAction(formData: FormData): Promise<never> {
	await requireAdmin();
	const { messages } = await getRequestI18n();
	const text = messages.actions;
	const provider = parseProvider(formText(formData, "provider"));
	if (!provider) redirectWithMessage("error", text.unknownProvider);
	const apiKey = formText(formData, "apiKey").trim();
	if (apiKey.length < 8) redirectWithMessage("error", text.apiKeyTooShort);

	try {
		await saveProviderKey(provider, apiKey);
	} catch (error) {
		redirectWithMessage("error", errorFeedback(error, messages));
	}
	redirectWithMessage("notice", text.apiKeySaved);
}

export async function deleteProviderKeyAction(formData: FormData): Promise<never> {
	await requireAdmin();
	const { messages } = await getRequestI18n();
	const text = messages.actions;
	const provider = parseProvider(formText(formData, "provider"));
	if (!provider) redirectWithMessage("error", text.unknownProvider);
	try {
		await deleteProviderKey(provider);
	} catch (error) {
		redirectWithMessage("error", errorFeedback(error, messages));
	}
	redirectWithMessage("notice", text.apiKeyRemoved);
}

export async function saveAiDefaultsAction(formData: FormData): Promise<never> {
	await requireAdmin();
	const { messages } = await getRequestI18n();
	const text = messages.actions;
	const provider = parseProvider(formText(formData, "provider"));
	if (!provider) redirectWithMessage("error", text.unknownProvider);
	const model = formText(formData, "model").trim();
	if (!model) redirectWithMessage("error", text.modelRequired);

	let configured: boolean;
	try {
		configured = (await getProviderKeyStatus())[provider];
	} catch (error) {
		redirectWithMessage("error", errorFeedback(error, messages));
	}
	if (!configured) redirectWithMessage("error", text.providerKeyRequired);

	try {
		await saveAiDefaults({ provider, model });
	} catch (error) {
		redirectWithMessage("error", errorFeedback(error, messages));
	}
	redirectWithMessage("notice", text.modelSaved);
}
