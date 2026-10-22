"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { previewExtractionAction, saveExtractionSettingsAction } from "@/app/admin/(protected)/actions";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/admin-ui";
import { interpolate, messageFor } from "@/lib/i18n/format";
import type { UiMessages } from "@/lib/i18n/messages";
import type { ProjectSelectors } from "@/lib/projects/selectors";
import type { ExtractionPreviewState } from "@/lib/scraping/preview";

const labelClass = "flex flex-col gap-1.5 text-sm font-medium";
const hintClass = "text-xs font-normal text-muted";

type SelectorValues = {
	mainContentSelector: string;
	shortDescriptionSelector: string;
	longDescriptionSelector: string;
	excludedSelectorsText: string;
};

type SamplePage = { id: string; url: string };

type SaveButtonProps = {
	action: (formData: FormData) => Promise<never>;
	disabled: boolean;
	messages: UiMessages["extraction"];
};

function SaveButton({ action, disabled, messages }: SaveButtonProps) {
	const { pending } = useFormStatus();

	return (
		<button className={primaryButtonClass} type="submit" formAction={action} disabled={disabled || pending}>
			{pending ? messages.savePending : messages.save}
		</button>
	);
}

const initialPreviewState: ExtractionPreviewState = { status: "idle", message: "" };

export function ExtractionSettingsForm({
	projectId,
	selectors,
	samplePages,
	destination,
	messages,
}: {
	projectId: string;
	selectors: ProjectSelectors;
	samplePages: SamplePage[];
	destination: "project" | "operations";
	messages: UiMessages["extraction"];
}) {
	const previewAction = previewExtractionAction.bind(null, projectId);
	const saveAction = saveExtractionSettingsAction.bind(null, projectId, destination);
	const [previewState, previewFormAction, isPreviewPending] = useActionState(previewAction, initialPreviewState);
	const [settings, setSettings] = useState<SelectorValues>({
		mainContentSelector: selectors.main_content ?? "",
		shortDescriptionSelector: selectors.short_description ?? "",
		longDescriptionSelector: selectors.long_description ?? "",
		excludedSelectorsText: selectors.exclude?.join("\n") ?? "",
	});
	const [samplePageId, setSamplePageId] = useState(samplePages[0]?.id ?? "");
	const [previewDirty, setPreviewDirty] = useState(false);
	const activeSamplePageId = samplePages.some((page) => page.id === samplePageId)
		? samplePageId
		: (samplePages[0]?.id ?? "");
	const previewIsStale =
		previewDirty || (previewState.status === "preview" && previewState.samplePageId !== activeSamplePageId);

	function updateSetting(field: keyof SelectorValues, value: string) {
		setSettings((current) => ({ ...current, [field]: value }));
		setPreviewDirty(true);
	}

	return (
		<section className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 sm:p-6">
			<div className="flex flex-col gap-1">
				<p className="text-xs font-semibold uppercase tracking-wide text-accent">{messages.eyebrow}</p>
				<h2 className="text-lg font-semibold">{messages.title}</h2>
				<p className="max-w-3xl text-sm leading-relaxed text-muted">{messages.description}</p>
			</div>

			<form action={previewFormAction} className="flex flex-col gap-4">
				<div className="grid gap-4 md:grid-cols-2">
					<label className={`${labelClass} md:col-span-2`}>
						{messages.mainSelector}
						<input
							className={inputClass}
							name="mainContentSelector"
							value={settings.mainContentSelector}
							onChange={(event) => updateSetting("mainContentSelector", event.target.value)}
							maxLength={300}
							placeholder={messages.mainPlaceholder}
							disabled={isPreviewPending}
						/>
						<span className={hintClass}>{messages.mainHint}</span>
					</label>

					<label className={labelClass}>
						{messages.shortSelector}
						<input
							className={inputClass}
							name="shortDescriptionSelector"
							value={settings.shortDescriptionSelector}
							onChange={(event) => updateSetting("shortDescriptionSelector", event.target.value)}
							maxLength={300}
							placeholder={messages.shortPlaceholder}
							disabled={isPreviewPending}
						/>
						<span className={hintClass}>{messages.selectorHint}</span>
					</label>

					<label className={labelClass}>
						{messages.longSelector}
						<input
							className={inputClass}
							name="longDescriptionSelector"
							value={settings.longDescriptionSelector}
							onChange={(event) => updateSetting("longDescriptionSelector", event.target.value)}
							maxLength={300}
							placeholder={messages.longPlaceholder}
							disabled={isPreviewPending}
						/>
						<span className={hintClass}>{messages.selectorHint}</span>
					</label>

					<label className={`${labelClass} md:col-span-2`}>
						{messages.excludedSelectors}
						<textarea
							className={inputClass}
							name="excludedSelectorsText"
							value={settings.excludedSelectorsText}
							onChange={(event) => updateSetting("excludedSelectorsText", event.target.value)}
							rows={4}
							maxLength={3000}
							placeholder={"header\nfooter\nnav\naside\n.cookie-banner"}
							disabled={isPreviewPending}
						/>
						<span className={hintClass}>{messages.excludedHint}</span>
					</label>

					<label className={labelClass}>
						{messages.sampleUrl}
						<select
							className={inputClass}
							name="samplePageId"
							value={activeSamplePageId}
							onChange={(event) => {
								setSamplePageId(event.target.value);
								setPreviewDirty(true);
							}}
							required={samplePages.length > 0}
							disabled={samplePages.length === 0 || isPreviewPending}
						>
							{samplePages.length === 0 ? <option value="">{messages.noSample}</option> : null}
							{samplePages.map((page) => (
								<option key={page.id} value={page.id}>
									{page.url}
								</option>
							))}
						</select>
						<span className={hintClass}>{messages.sampleHint}</span>
					</label>
				</div>

				<div className="flex flex-wrap gap-3">
					<button
						className={secondaryButtonClass}
						type="submit"
						disabled={samplePages.length === 0 || isPreviewPending}
						onClick={() => setPreviewDirty(false)}
					>
						{isPreviewPending ? messages.previewPending : messages.preview}
					</button>
					<SaveButton action={saveAction} disabled={isPreviewPending} messages={messages} />
				</div>

				{previewState.status === "error" ? (
					<p
						role="alert"
						className="rounded-lg border border-rose-700/25 border-l-2 border-l-rose-700/70 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-300/25 dark:border-l-rose-300/70 dark:bg-rose-300/[0.06] dark:text-rose-100"
					>
						{interpolate(messages.previewError, { message: previewState.message })}
					</p>
				) : null}

				{previewState.status === "preview" ? (
					<div
						aria-live="polite"
						className="flex flex-col gap-4 rounded-xl border border-line bg-background/40 p-4 sm:p-5"
					>
						<div className="flex flex-col gap-1">
							<p className="text-sm font-semibold">{messages.previewTitle}</p>
							<p className="break-all text-xs text-muted">
								{previewState.url} · {previewState.message}
							</p>
							{previewIsStale ? (
								<p className="mt-1 rounded-md bg-amber-300/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-100">
									{messages.previewStale}
								</p>
							) : null}
						</div>
						<div className="grid gap-3 md:grid-cols-2">
							{previewState.fields?.map((field) => (
								<article key={field.field} className="flex flex-col gap-2 rounded-lg bg-surface p-4">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<h3 className="text-xs font-semibold">{messageFor(messages.fields, field.field) ?? field.field}</h3>
										<span className="text-xs text-muted">
											{messageFor(messages.statuses, field.extraction) ?? field.extraction}
										</span>
									</div>
									<p className="whitespace-pre-wrap break-words text-xs leading-relaxed">
										{field.text ? `${field.text}${field.textTruncated ? "…" : ""}` : messages.noText}
									</p>
									{field.note ? <p className="text-xs text-muted">{field.note}</p> : null}
								</article>
							))}
						</div>
					</div>
				) : null}
			</form>
		</section>
	);
}
