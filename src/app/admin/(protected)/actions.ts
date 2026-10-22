"use server";

import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { pages, processingJobs, projects } from "@/lib/db/schema";
import {
	collectFeedUrlsFromUpload,
	collectFeedUrlsFromUrl,
	importCandidateUrls,
	MAX_UPLOAD_BYTES,
} from "@/lib/import/service";
import { normalizeUrl } from "@/lib/import/url";
import type { FeedFormat, ImportPlan } from "@/lib/import/feed";
import {
	extractionSettingsSchema,
	projectInputSchema,
	toProjectSelectors,
	toProjectValues,
} from "@/lib/projects/input";
import { saveProjectSelectors } from "@/lib/projects/settings";
import { ACTIVE_JOB_STATUSES, cancelBatch, deleteFinishedBatchJob, startBatch, type BatchKind } from "@/lib/jobs/batch";
import type { ExtractionPreviewState } from "@/lib/scraping/preview";
import { previewPageExtraction, scrapePage } from "@/lib/scraping/service";
import { formatActionError, formatProjectInputIssue, UserFacingActionError } from "@/lib/i18n/action-errors";
import { interpolate } from "@/lib/i18n/format";
import { getRequestI18n } from "@/lib/i18n/server";
import type { UiMessages } from "@/lib/i18n/messages";

const MAX_PREVIEW_FIELD_CHARS = 1200;

function formText(formData: FormData, name: string): string {
	const value = formData.get(name);
	return typeof value === "string" ? value : "";
}

function extractionSettingsFromForm(formData: FormData) {
	return extractionSettingsSchema.safeParse({
		mainContentSelector: formText(formData, "mainContentSelector"),
		shortDescriptionSelector: formText(formData, "shortDescriptionSelector"),
		longDescriptionSelector: formText(formData, "longDescriptionSelector"),
		excludedSelectorsText: formText(formData, "excludedSelectorsText"),
	});
}

function parseFormat(value: string, messages: UiMessages): FeedFormat {
	if (value === "sitemap" || value === "heureka" || value === "zbozi") return value;
	throw new UserFacingActionError(messages.actions.unknownFeedFormat);
}

function summarizeImport(plan: ImportPlan, candidates: number, messages: UiMessages): string {
	return interpolate(messages.actions.importSummary, {
		inserted: plan.toInsert.length,
		candidates,
		known: plan.alreadyKnown,
		invalid: plan.invalid,
		outside: plan.outsideAllowedHosts,
		duplicates: plan.duplicatesInFeed,
		overLimit: plan.overLimit,
	});
}

async function redirectWithResult(
	target: string,
	task: () => Promise<string>,
	messages: UiMessages,
	errorTarget = target,
): Promise<never> {
	let key: "notice" | "error" = "notice";
	let message: string;
	let destination = target;
	try {
		message = await task();
	} catch (error) {
		key = "error";
		message = formatActionError(error, messages);
		destination = errorTarget;
	}
	const separator = destination.includes("?") ? "&" : "?";
	redirect(`${destination}${separator}${key}=${encodeURIComponent(message)}`);
}

type ActionDestination = "project" | "operations";

function actionTarget(projectId: string, destination: ActionDestination): string {
	const encodedProjectId = encodeURIComponent(projectId);
	switch (destination) {
		case "project":
			return `/admin/projects/${encodedProjectId}`;
		case "operations":
			return `/admin/operations?projectId=${encodedProjectId}`;
		default:
			throw new Error("Neznámé místo návratu.");
	}
}

function batchActionTarget(jobProjectId: string, destination: ActionDestination, selectedProjectId: string): string {
	if (destination === "operations") {
		return selectedProjectId ? actionTarget(selectedProjectId, "operations") : "/admin/operations";
	}
	return actionTarget(jobProjectId, destination);
}

export async function createProjectAction(formData: FormData): Promise<never> {
	const { messages } = await getRequestI18n();
	await requireAdmin();
	let createdId: string | null = null;
	let failure = "";
	try {
		const parsed = projectInputSchema.safeParse({
			name: formText(formData, "name"),
			allowedHostsText: formText(formData, "allowedHostsText"),
			audience: formText(formData, "audience"),
			tone: formText(formData, "tone"),
			rules: formText(formData, "rules"),
			qualityThreshold: formText(formData, "qualityThreshold") || undefined,
			mainContentSelector: formText(formData, "mainContentSelector"),
			shortDescriptionSelector: formText(formData, "shortDescriptionSelector"),
			longDescriptionSelector: formText(formData, "longDescriptionSelector"),
			excludedSelectorsText: formText(formData, "excludedSelectorsText"),
		});
		if (!parsed.success) {
			throw new UserFacingActionError(formatProjectInputIssue(parsed.error.issues[0], messages));
		}
		const [created] = await getDb()
			.insert(projects)
			.values(toProjectValues(parsed.data))
			.returning({ id: projects.id });
		createdId = created.id;
	} catch (error) {
		failure = formatActionError(error, messages);
	}
	if (createdId) redirect(`/admin/projects/${createdId}`);
	redirect(`/admin?error=${encodeURIComponent(failure)}`);
}

export async function deleteProjectAction(projectId: string, _formData: FormData): Promise<never> {
	const { messages } = await getRequestI18n();
	await requireAdmin();
	void _formData;
	return redirectWithResult(
		"/admin",
		async () => {
			const projectName = await getDb().transaction(async (tx) => {
				const [project] = await tx
					.select({ id: projects.id, name: projects.name })
					.from(projects)
					.where(eq(projects.id, projectId))
					.for("update");
				if (!project) throw new UserFacingActionError(messages.actions.projectMissing);

				const [activeJob] = await tx
					.select({ id: processingJobs.id })
					.from(processingJobs)
					.where(and(eq(processingJobs.projectId, projectId), inArray(processingJobs.status, [...ACTIVE_JOB_STATUSES])))
					.limit(1);
				if (activeJob) {
					throw new UserFacingActionError(interpolate(messages.actions.projectDeleteActiveJob, { name: project.name }));
				}

				const [scrapingPage] = await tx
					.select({ id: pages.id })
					.from(pages)
					.where(and(eq(pages.projectId, projectId), eq(pages.scrapeStatus, "scraping")))
					.limit(1);
				if (scrapingPage) {
					throw new UserFacingActionError(interpolate(messages.actions.projectDeleteScraping, { name: project.name }));
				}

				const [deleted] = await tx.delete(projects).where(eq(projects.id, projectId)).returning({ id: projects.id });
				if (!deleted) throw new UserFacingActionError(messages.actions.projectDeleteFailed);
				return project.name;
			});

			return interpolate(messages.actions.projectDeleted, { name: projectName });
		},
		messages,
		`/admin/projects/${encodeURIComponent(projectId)}`,
	);
}

export async function previewExtractionAction(
	projectId: string,
	_previousState: ExtractionPreviewState,
	formData: FormData,
): Promise<ExtractionPreviewState> {
	const { messages } = await getRequestI18n();
	await requireAdmin();
	const parsed = extractionSettingsFromForm(formData);
	if (!parsed.success) {
		return { status: "error", message: formatProjectInputIssue(parsed.error.issues[0], messages) };
	}

	try {
		const samplePageId = formText(formData, "samplePageId");
		if (!samplePageId) throw new UserFacingActionError(messages.actions.selectSamplePage);
		const preview = await previewPageExtraction(projectId, samplePageId, toProjectSelectors(parsed.data));

		return {
			status: "preview",
			message: preview.htmlTruncated ? messages.extraction.previewReadyTruncated : messages.extraction.previewReady,
			samplePageId,
			url: preview.finalUrl,
			htmlTruncated: preview.htmlTruncated,
			fields: preview.fields.map((field) => ({
				...field,
				text: field.text.slice(0, MAX_PREVIEW_FIELD_CHARS),
				textTruncated: field.text.length > MAX_PREVIEW_FIELD_CHARS,
			})),
		};
	} catch (error) {
		return { status: "error", message: formatActionError(error, messages) };
	}
}

export async function saveExtractionSettingsAction(
	projectId: string,
	destination: ActionDestination,
	formData: FormData,
): Promise<never> {
	const { messages } = await getRequestI18n();
	await requireAdmin();
	return redirectWithResult(
		actionTarget(projectId, destination),
		async () => {
			const parsed = extractionSettingsFromForm(formData);
			if (!parsed.success) {
				throw new UserFacingActionError(formatProjectInputIssue(parsed.error.issues[0], messages));
			}
			const result = await saveProjectSelectors(projectId, toProjectSelectors(parsed.data));
			if (!result.changed) return messages.actions.extractionUnchanged;
			if (result.pagesToRescrape === 0) {
				return messages.actions.extractionSavedNoPages;
			}
			return interpolate(messages.actions.extractionSavedPages, { count: result.pagesToRescrape });
		},
		messages,
	);
}

export async function importFeedUrlAction(
	projectId: string,
	destination: ActionDestination,
	formData: FormData,
): Promise<never> {
	const { messages } = await getRequestI18n();
	await requireAdmin();
	return redirectWithResult(
		actionTarget(projectId, destination),
		async () => {
			const format = parseFormat(formText(formData, "format"), messages);
			const feedUrl = normalizeUrl(formText(formData, "feedUrl"));
			if (!feedUrl) throw new UserFacingActionError(messages.actions.invalidFeedUrl);
			const candidates = await collectFeedUrlsFromUrl(feedUrl, format);
			const { plan } = await importCandidateUrls(projectId, { format, sourceUrl: feedUrl }, candidates);
			return summarizeImport(plan, candidates.length, messages);
		},
		messages,
	);
}

export async function importFeedFileAction(
	projectId: string,
	destination: ActionDestination,
	formData: FormData,
): Promise<never> {
	const { messages } = await getRequestI18n();
	await requireAdmin();
	return redirectWithResult(
		actionTarget(projectId, destination),
		async () => {
			const format = parseFormat(formText(formData, "format"), messages);
			const file = formData.get("feedFile");
			if (!(file instanceof File) || file.size === 0) throw new UserFacingActionError(messages.actions.selectFeedFile);
			if (file.size > MAX_UPLOAD_BYTES) throw new UserFacingActionError(messages.actions.feedTooLarge);
			const candidates = await collectFeedUrlsFromUpload(Buffer.from(await file.arrayBuffer()), format);
			const { plan } = await importCandidateUrls(projectId, { format, fileName: file.name }, candidates);
			return summarizeImport(plan, candidates.length, messages);
		},
		messages,
	);
}

export async function scrapePageAction(projectId: string, pageId: string): Promise<never> {
	const { messages } = await getRequestI18n();
	await requireAdmin();
	return redirectWithResult(
		`/admin/projects/${projectId}/pages/${pageId}`,
		async () => {
			const outcome = await scrapePage(projectId, pageId);
			return formatActionError(new Error(outcome.message), messages);
		},
		messages,
	);
}

export async function startBatchAction(projectId: string, kind: BatchKind): Promise<never> {
	const { messages } = await getRequestI18n();
	await requireAdmin();
	return redirectWithResult(
		`/admin/projects/${projectId}`,
		async () => {
			const { total } = await startBatch(projectId, kind);
			return interpolate(messages.actions.batchQueued, { count: total });
		},
		messages,
	);
}

export async function cancelBatchAction(
	projectId: string,
	jobId: string,
	destination: ActionDestination,
	selectedProjectId: string,
	_formData: FormData,
): Promise<never> {
	const { messages } = await getRequestI18n();
	await requireAdmin();
	void _formData;
	return redirectWithResult(
		batchActionTarget(projectId, destination, selectedProjectId),
		async () => {
			await cancelBatch(projectId, jobId);
			return messages.actions.batchCancelled;
		},
		messages,
	);
}

export async function deleteBatchJobAction(
	projectId: string,
	jobId: string,
	destination: ActionDestination,
	selectedProjectId: string,
	_formData: FormData,
): Promise<never> {
	const { messages } = await getRequestI18n();
	await requireAdmin();
	void _formData;
	return redirectWithResult(
		batchActionTarget(projectId, destination, selectedProjectId),
		async () => {
			await deleteFinishedBatchJob(projectId, jobId);
			return messages.actions.batchRemoved;
		},
		messages,
	);
}
