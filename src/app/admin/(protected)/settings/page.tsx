import { Notice, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/admin-ui";
import { SelectInput } from "@/components/select-input";
import { requireAdmin } from "@/lib/auth/session";
import { PROVIDER_LABELS, PROVIDERS } from "@/lib/ai/providers";
import { getAiDefaults, getProviderKeyStatus } from "@/lib/ai/settings";
import { deleteProviderKeyAction, saveAiDefaultsAction, saveProviderKeyAction } from "./actions";
import { getRequestI18n } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/format";

export const instant = false;

export default async function SettingsPage({ searchParams }: PageProps<"/admin/settings">) {
	await requireAdmin();
	const { messages } = await getRequestI18n();
	const text = messages.aiSettings;
	const query = await searchParams;
	const [keyStatus, defaults] = await Promise.all([getProviderKeyStatus(), getAiDefaults()]);

	return (
		<div className="flex w-full max-w-5xl flex-col gap-8">
			<header className="flex flex-col gap-2">
				<p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{text.eyebrow}</p>
				<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{text.title}</h1>
				<p className="max-w-2xl text-sm leading-relaxed text-muted">{text.description}</p>
			</header>
			<Notice searchParams={query} />

			<section className="flex flex-col gap-4" aria-labelledby="provider-keys-title">
				<div>
					<p className="text-xs font-semibold uppercase tracking-wide text-accent">{text.access}</p>
					<h2 id="provider-keys-title" className="mt-1 text-lg font-semibold">
						{text.providerKeys}
					</h2>
				</div>
				<p className="max-w-[65ch] text-sm leading-relaxed text-muted">{text.keyDescription}</p>
				<ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
					{PROVIDERS.map((provider) => (
						<li key={provider} className="grid gap-4 p-5 sm:grid-cols-[12rem_1fr] sm:items-start sm:px-6">
							<div className="flex flex-col gap-1">
								<span className="text-sm font-semibold">{PROVIDER_LABELS[provider]}</span>
								<span
									className={`inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${
										keyStatus[provider] ? "bg-success/10 text-success" : "bg-surface-raised text-muted"
									}`}
								>
									<span
										aria-hidden="true"
										className={`size-1.5 rounded-full ${keyStatus[provider] ? "bg-success" : "bg-muted"}`}
									/>
									{keyStatus[provider] ? text.keySaved : text.keyMissing}
								</span>
							</div>
							<div className="flex flex-col gap-2">
								<form action={saveProviderKeyAction} className="flex flex-col gap-2 sm:flex-row">
									<input type="hidden" name="provider" value={provider} />
									<input
										className={inputClass}
										name="apiKey"
										type="password"
										autoComplete="off"
										placeholder={keyStatus[provider] ? text.newKeyPlaceholder : text.keyPlaceholder}
										aria-label={interpolate(text.keyAria, { provider: PROVIDER_LABELS[provider] })}
									/>
									<button className={primaryButtonClass} type="submit">
										{text.save}
									</button>
								</form>
								{keyStatus[provider] ? (
									<form action={deleteProviderKeyAction}>
										<input type="hidden" name="provider" value={provider} />
										<button className={secondaryButtonClass} type="submit">
											{text.removeKey}
										</button>
									</form>
								) : null}
							</div>
						</li>
					))}
				</ul>
			</section>

			<section className="flex flex-col gap-4" aria-labelledby="default-model-title">
				<div>
					<p className="text-xs font-semibold uppercase tracking-wide text-accent">{text.analysis}</p>
					<h2 id="default-model-title" className="mt-1 text-lg font-semibold">
						{text.defaultModel}
					</h2>
				</div>
				<p className="max-w-[65ch] text-sm leading-relaxed text-muted">
					{interpolate(text.current, {
						value: defaults ? `${PROVIDER_LABELS[defaults.provider]} · ${defaults.model}` : text.notConfigured,
					})}{" "}
					{text.modelDescription}
				</p>
				<form
					action={saveAiDefaultsAction}
					className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-[14rem_minmax(16rem,1fr)_auto] sm:items-end sm:p-6"
				>
					<label className="flex flex-col gap-1 text-sm font-medium">
						{text.provider}
						<SelectInput
							key={defaults?.provider ?? "openai"}
							name="provider"
							aria-label={text.provider}
							defaultValue={defaults?.provider ?? "openai"}
							options={PROVIDERS.map((provider) => ({ value: provider, label: PROVIDER_LABELS[provider] }))}
						/>
					</label>
					<label className="flex flex-col gap-1 text-sm font-medium">
						{text.modelId}
						<input
							className={inputClass}
							name="model"
							required
							defaultValue={defaults?.model ?? ""}
							placeholder={text.modelPlaceholder}
						/>
					</label>
					<button className={primaryButtonClass} type="submit">
						{text.saveModel}
					</button>
				</form>
			</section>
		</div>
	);
}
