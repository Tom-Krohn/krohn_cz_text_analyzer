import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { appSettings, providerCredentials } from "@/lib/db/schema";
import { getServerEnv } from "@/lib/env";
import { decryptSecret, encryptSecret, parseEncryptionKey } from "@/lib/security/crypto";
import { PROVIDERS, type Provider } from "./providers";

const DEFAULTS_KEY = "ai_defaults";

export type AiDefaults = { provider: Provider; model: string };

function encryptionKey() {
	return parseEncryptionKey(getServerEnv().APP_ENCRYPTION_KEY);
}

export async function getProviderKeyStatus(): Promise<Record<Provider, boolean>> {
	const rows = await getDb().select({ provider: providerCredentials.provider }).from(providerCredentials);
	const configured = new Set(rows.map((row) => row.provider));
	return Object.fromEntries(PROVIDERS.map((provider) => [provider, configured.has(provider)])) as Record<
		Provider,
		boolean
	>;
}

export async function saveProviderKey(provider: Provider, apiKey: string): Promise<void> {
	const ciphertext = encryptSecret(apiKey.trim(), encryptionKey());
	await getDb()
		.insert(providerCredentials)
		.values({ provider, ciphertext })
		.onConflictDoUpdate({ target: providerCredentials.provider, set: { ciphertext, updatedAt: new Date() } });
}

export async function deleteProviderKey(provider: Provider): Promise<void> {
	await getDb().delete(providerCredentials).where(eq(providerCredentials.provider, provider));
}

export async function getProviderKey(provider: Provider): Promise<string | null> {
	const [row] = await getDb()
		.select({ ciphertext: providerCredentials.ciphertext })
		.from(providerCredentials)
		.where(eq(providerCredentials.provider, provider));
	return row ? decryptSecret(row.ciphertext, encryptionKey()) : null;
}

export async function getAiDefaults(): Promise<AiDefaults | null> {
	const [row] = await getDb().select().from(appSettings).where(eq(appSettings.key, DEFAULTS_KEY));
	if (!row) return null;
	const value = row.value as Partial<AiDefaults>;
	return value.provider && value.model ? { provider: value.provider, model: value.model } : null;
}

export async function saveAiDefaults(defaults: AiDefaults): Promise<void> {
	await getDb()
		.insert(appSettings)
		.values({ key: DEFAULTS_KEY, value: defaults })
		.onConflictDoUpdate({ target: appSettings.key, set: { value: defaults, updatedAt: new Date() } });
}

export async function resolveProviderForProject(projectProvider: Provider | null, projectModel: string | null) {
	const defaults = await getAiDefaults();
	const provider = projectProvider ?? defaults?.provider ?? null;
	const model = projectModel ?? defaults?.model ?? null;
	if (!provider || !model) throw new Error("Nejprve v nastavení vyberte poskytovatele a model.");
	const apiKey = await getProviderKey(provider);
	if (!apiKey) throw new Error(`Chybí API klíč pro poskytovatele ${provider}. Doplňte jej v nastavení.`);
	return { provider, model, apiKey };
}
