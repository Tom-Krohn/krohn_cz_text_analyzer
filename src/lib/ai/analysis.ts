import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
	aiAnalysisRunEvents,
	aiAnalysisRuns,
	fieldAssessments,
	pageFields,
	pages,
	projects,
	textProposals,
} from "@/lib/db/schema";
import { isWeakScore } from "./assessment";
import { completeJson, ProviderError, type Provider } from "./providers";
import { buildReviewPrompt, parseReviewResponse, PROMPT_VERSION, type ReviewItem } from "./review";
import { resolveProviderForProject } from "./settings";

type ResolvedProvider = { provider: Provider; model: string; apiKey: string };
type Prompt = { system: string; user: string };

async function requestReview(
	resolved: ResolvedProvider,
	prompt: Prompt,
): Promise<{ items: ReviewItem[]; retried: boolean }> {
	const first = await completeJson({ ...resolved, ...prompt });
	try {
		return { items: parseReviewResponse(first), retried: false };
	} catch {
		const retry = await completeJson({
			...resolved,
			system: prompt.system,
			user: `${prompt.user}\n\nPředchozí odpověď nebyla validní JSON. Vrať pouze validní JSON podle zadaného tvaru.`,
		});
		return { items: parseReviewResponse(retry), retried: true };
	}
}

export async function analyzePage(projectId: string, pageId: string) {
	const db = getDb();
	const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
	const [page] = await db
		.select({ url: pages.url, scrapeStatus: pages.scrapeStatus })
		.from(pages)
		.where(and(eq(pages.id, pageId), eq(pages.projectId, projectId)));
	if (!project || !page) throw new Error("Stránka v projektu neexistuje.");

	const [run] = await db
		.insert(aiAnalysisRuns)
		.values({
			projectId,
			pageId,
			status: "running",
			provider: project.provider,
			model: project.model,
			promptVersion: PROMPT_VERSION,
		})
		.returning({ id: aiAnalysisRuns.id });
	if (!run) throw new Error("Nepodařilo se založit auditní záznam analýzy.");
	let eventSequence = 0;
	let activeStage: (typeof aiAnalysisRunEvents.$inferSelect)["stage"] = "input_preparation";
	const recordEvent = async (
		stage: (typeof aiAnalysisRunEvents.$inferSelect)["stage"],
		status: (typeof aiAnalysisRunEvents.$inferSelect)["status"],
		summary: string,
	) => {
		await db.insert(aiAnalysisRunEvents).values({
			runId: run.id,
			sequence: eventSequence,
			stage,
			status,
			summary,
		});
		eventSequence += 1;
	};

	try {
		if (page.scrapeStatus !== "scraped") throw new Error("Stránku nejprve úspěšně znovu načtěte.");

		const fields = await db.select().from(pageFields).where(eq(pageFields.pageId, pageId));
		const reviewable = fields.filter(
			(field) => field.extraction === "found" || (field.extraction === "missing" && field.field !== "body"),
		);
		if (reviewable.length === 0) throw new Error("Stránka nemá pole vhodná k analýze.");

		const prompt = buildReviewPrompt({
			pageUrl: page.url,
			language: project.language,
			audience: project.audience,
			tone: project.tone,
			rules: project.rules,
			threshold: project.qualityThreshold,
			fields: reviewable.map((field) => ({
				field: field.field,
				text: field.sourceText,
				extraction: field.extraction,
			})),
		});
		await recordEvent(
			"input_preparation",
			"completed",
			`Připraveno ${reviewable.length} polí. Do auditu se ukládá pouze počet polí, nikoli jejich text.`,
		);

		activeStage = "provider_setup";
		await recordEvent("provider_setup", "started", "Ověřuje se nastavení poskytovatele a modelu.");
		const resolved = await resolveProviderForProject(project.provider, project.model);
		await db
			.update(aiAnalysisRuns)
			.set({ provider: resolved.provider, model: resolved.model })
			.where(eq(aiAnalysisRuns.id, run.id));
		await recordEvent(
			"provider_setup",
			"completed",
			`Použit poskytovatel ${resolved.provider}, model ${resolved.model}.`,
		);

		activeStage = "model_evaluation";
		await recordEvent("model_evaluation", "started", "Požadavek na hodnocení a návrhy byl odeslán modelu.");
		let items: ReviewItem[];
		let retried = false;
		try {
			const result = await requestReview(resolved, prompt);
			items = result.items;
			retried = result.retried;
		} catch (error) {
			if (error instanceof ProviderError) throw error;
			throw new Error("Odpověď modelu neprošla validací. Zkuste analýzu znovu.");
		}

		await recordEvent(
			"model_evaluation",
			"completed",
			`Model vrátil výstup pro ${items.length} polí${retried ? " po jednom formátovacím opakování" : ""}.`,
		);
		activeStage = "response_validation";
		await recordEvent(
			"response_validation",
			"completed",
			"Odpověď odpovídá očekávanému tvaru. Ukládají se skóre, problémy a stručné důvody návrhů.",
		);

		const reviewableByName = new Map(reviewable.map((field) => [field.field, field]));
		let assessed = 0;
		let proposed = 0;
		activeStage = "result_persistence";
		await recordEvent("result_persistence", "started", "Výsledky se ukládají k jednotlivým textovým polím.");
		const finishedAt = new Date();
		await db.transaction(async (tx) => {
			for (const item of items) {
				const field = reviewableByName.get(item.field);
				if (!field) continue;
				const meta = {
					analysisRunId: run.id,
					provider: resolved.provider,
					model: resolved.model,
					promptVersion: PROMPT_VERSION,
				};

				if (field.extraction === "found" && item.score !== null) {
					await tx.insert(fieldAssessments).values({
						pageFieldId: field.id,
						sourceHash: field.sourceHash,
						score: item.score,
						issues: item.issues,
						...meta,
					});
					assessed += 1;
				}

				const proposal = item.proposal?.trim();
				const needsProposal =
					field.extraction === "missing"
						? Boolean(proposal)
						: item.score !== null && isWeakScore(item.score, project.qualityThreshold);
				if (proposal && needsProposal && proposal !== field.sourceText) {
					await tx.insert(textProposals).values({
						pageFieldId: field.id,
						sourceHash: field.sourceHash,
						proposedText: proposal,
						reason: item.reason,
						...meta,
					});
					proposed += 1;
				}
			}
			await tx.update(pages).set({ updatedAt: finishedAt, analyzedAt: finishedAt }).where(eq(pages.id, pageId));
			await tx.insert(aiAnalysisRunEvents).values({
				runId: run.id,
				sequence: eventSequence,
				stage: "result_persistence",
				status: "completed",
				summary: `Uloženo ${assessed} hodnocení a ${proposed} návrhů.`,
				createdAt: finishedAt,
			});
			await tx
				.update(aiAnalysisRuns)
				.set({
					status: "completed",
					provider: resolved.provider,
					model: resolved.model,
					assessed,
					proposed,
					finishedAt,
				})
				.where(eq(aiAnalysisRuns.id, run.id));
		});
		return { assessed, proposed };
	} catch (error) {
		const message = (error instanceof Error ? error.message : "Neznámá chyba při AI analýze.").slice(0, 1000);
		const failedAt = new Date();
		await db.transaction(async (tx) => {
			await tx.insert(aiAnalysisRunEvents).values({
				runId: run.id,
				sequence: eventSequence,
				stage: activeStage,
				status: "failed",
				summary: `Selhalo: ${message}`,
				createdAt: failedAt,
			});
			await tx
				.update(aiAnalysisRuns)
				.set({ status: "failed", errorMessage: message, finishedAt: failedAt })
				.where(eq(aiAnalysisRuns.id, run.id));
		});
		throw error;
	}
}

export async function saveProposalDecision(
	projectId: string,
	proposalId: string,
	decision: { status: "approved" | "rejected" | "pending"; editedText?: string },
) {
	const editedText = decision.editedText?.trim();
	await getDb().transaction(async (tx) => {
		const [owned] = await tx
			.select({
				id: textProposals.id,
				analysisRunId: textProposals.analysisRunId,
				field: pageFields.field,
				proposedText: textProposals.proposedText,
			})
			.from(textProposals)
			.innerJoin(pageFields, eq(pageFields.id, textProposals.pageFieldId))
			.innerJoin(pages, eq(pages.id, pageFields.pageId))
			.where(and(eq(textProposals.id, proposalId), eq(pages.projectId, projectId)))
			.for("update");
		if (!owned) throw new Error("Návrh v projektu neexistuje.");

		await tx
			.update(textProposals)
			.set({
				status: decision.status,
				editedText: editedText ? editedText : null,
				decidedAt: decision.status === "pending" ? null : new Date(),
			})
			.where(eq(textProposals.id, proposalId));

		if (!owned.analysisRunId) return;
		await tx
			.select({ id: aiAnalysisRuns.id })
			.from(aiAnalysisRuns)
			.where(eq(aiAnalysisRuns.id, owned.analysisRunId))
			.for("update");
		const [lastEvent] = await tx
			.select({ sequence: aiAnalysisRunEvents.sequence })
			.from(aiAnalysisRunEvents)
			.where(eq(aiAnalysisRunEvents.runId, owned.analysisRunId))
			.orderBy(desc(aiAnalysisRunEvents.sequence))
			.limit(1);
		const decisionLabel = {
			approved: "schválen",
			rejected: "zamítnut",
			pending: "vrácen k rozhodnutí",
		}[decision.status];
		const textWasEdited = Boolean(editedText && editedText !== owned.proposedText);
		await tx.insert(aiAnalysisRunEvents).values({
			runId: owned.analysisRunId,
			sequence: (lastEvent?.sequence ?? -1) + 1,
			stage: "proposal_decision",
			status: "completed",
			summary: `Návrh pro pole „${owned.field}“ byl ${decisionLabel}.${textWasEdited ? " Text byl před rozhodnutím upraven." : ""}`,
		});
	});
}

export async function getPageReview(pageId: string) {
	const db = getDb();
	const fields = await db.select().from(pageFields).where(eq(pageFields.pageId, pageId));
	const fieldIds = fields.map((field) => field.id);
	if (fieldIds.length === 0) return [];

	const assessments = await db
		.select()
		.from(fieldAssessments)
		.where(inArray(fieldAssessments.pageFieldId, fieldIds))
		.orderBy(desc(fieldAssessments.createdAt));
	const proposals = await db
		.select()
		.from(textProposals)
		.where(inArray(textProposals.pageFieldId, fieldIds))
		.orderBy(desc(textProposals.createdAt));

	return fields.map((field) => ({
		field,
		assessment: assessments.find((item) => item.pageFieldId === field.id) ?? null,
		proposal: proposals.find((item) => item.pageFieldId === field.id) ?? null,
	}));
}
