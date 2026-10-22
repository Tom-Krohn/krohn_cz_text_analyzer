import Link from "next/link";
import { notFound } from "next/navigation";
import { AnalyzePageSubmitButton } from "@/components/analyze-page-submit-button";
import { Notice, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/admin-ui";
import { getPageAnalysisAudit } from "@/lib/ai/audit";
import { getPageReview } from "@/lib/ai/analysis";
import { PROVIDER_LABELS } from "@/lib/ai/providers";
import { requireAdmin } from "@/lib/auth/session";
import { getPageDetail } from "@/lib/projects/queries";
import { localizeAuditEvent } from "@/lib/i18n/audit-events";
import { localizeExtractionNote } from "@/lib/i18n/extraction-notes";
import { formatDateTime, interpolate, messageFor } from "@/lib/i18n/format";
import { getRequestI18n } from "@/lib/i18n/server";
import { scrapePageAction } from "../../../../actions";
import { analyzePageAction, decideProposalAction } from "../../../../review-actions";

const RUN_STATUS_CLASSES = {
	running: "bg-amber-300/10 text-amber-800 dark:text-amber-100",
	completed: "bg-success/10 text-success",
	failed: "bg-rose-300/10 text-rose-800 dark:text-rose-100",
} as const;

export const instant = false;

export default async function PageDetail({
	params,
	searchParams,
}: PageProps<"/admin/projects/[projectId]/pages/[pageId]">) {
	await requireAdmin();
	const { locale, messages } = await getRequestI18n();
	const text = messages.pageDetail;
	const { projectId, pageId } = await params;
	const query = await searchParams;
	const detail = await getPageDetail(projectId, pageId);
	if (!detail) notFound();
	const [review, analysisRuns] = await Promise.all([getPageReview(pageId), getPageAnalysisAudit(projectId, pageId)]);

	const { page } = detail;
	const scrapeThisPage = scrapePageAction.bind(null, projectId, pageId);
	const analyzeThisPage = analyzePageAction.bind(null, projectId, pageId);
	const decideThisProposal = decideProposalAction.bind(null, projectId, pageId);
	const reviewByField = new Map(review.map((item) => [item.field.field, item]));
	const canAnalyze = page.scrapeStatus === "scraped" && detail.fields.some((field) => field.extraction !== "uncertain");

	return (
		<div className="mx-auto flex w-full max-w-[88rem] flex-col gap-7">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Link
					className="text-sm font-semibold text-accent underline decoration-accent/40 underline-offset-4 hover:text-accent-hover"
					href={`/admin/projects/${projectId}`}
				>
					{text.backToProject}
				</Link>
				<Link
					className="text-sm font-semibold text-muted underline decoration-line underline-offset-4 transition-colors hover:text-foreground"
					href={`/admin/ai-audit?projectId=${encodeURIComponent(projectId)}`}
				>
					{text.openAudit}
				</Link>
			</div>

			<header className="flex flex-col gap-3">
				<p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{text.eyebrow}</p>
				<h1 className="break-all text-2xl font-semibold tracking-tight sm:text-3xl">{page.url}</h1>
				<div className="flex flex-wrap items-center gap-2 text-xs text-muted">
					<span className="rounded-md bg-surface-raised px-2.5 py-1 font-semibold text-foreground">
						{messages.project.scrapeStatuses[page.scrapeStatus] ?? page.scrapeStatus}
					</span>
					<span>{messages.project.kinds[page.kind] ?? page.kind}</span>
					{page.httpStatus ? <span>HTTP {page.httpStatus}</span> : null}
					{page.scrapedAt ? (
						<span>
							{text.loaded} {formatDateTime(page.scrapedAt, locale)}
						</span>
					) : null}
					{page.analyzedAt ? (
						<span>
							{text.analyzed} {formatDateTime(page.analyzedAt, locale)}
						</span>
					) : null}
				</div>
				{page.errorMessage ? (
					<p className="max-w-3xl rounded-lg border border-rose-700/20 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-300/20 dark:bg-rose-300/[0.05] dark:text-rose-100">
						<strong>{text.errorLabel}</strong> {page.errorMessage}
					</p>
				) : null}
			</header>

			<Notice searchParams={query} />

			{page.scrapeStatus !== "scraped" ? <p className="text-sm text-muted"> {text.analysisUnavailable}</p> : null}

			<div className="flex flex-wrap gap-3">
				<form action={scrapeThisPage}>
					<button className={secondaryButtonClass} type="submit">
						{text.rescrape}
					</button>
				</form>
				<form action={analyzeThisPage}>
					<AnalyzePageSubmitButton
						className={primaryButtonClass}
						disabled={!canAnalyze}
						messages={messages.analysisButton}
					/>
				</form>
			</div>

			<section
				className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6"
				aria-labelledby="analysis-history-title"
			>
				<header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{text.aiProcess}</p>
						<h2 id="analysis-history-title" className="mt-1 text-lg font-semibold tracking-tight">
							{text.analysisHistory}
						</h2>
						<p className="mt-1 max-w-2xl text-sm text-muted">{text.analysisHistoryDescription}</p>
					</div>
					<span className="shrink-0 text-xs text-muted">
						{analysisRuns.length > 0 ? interpolate(text.runCount, { count: analysisRuns.length }) : text.noRuns}
					</span>
				</header>
				{analysisRuns.length === 0 ? (
					<div className="rounded-xl border border-dashed border-line bg-background/40 px-4 py-5">
						<p className="text-sm font-medium">{text.noRunsTitle}</p>
						<p className="mt-1 text-sm text-muted">{text.noRunsDescription}</p>
					</div>
				) : (
					<ol className="flex flex-col gap-3">
						{analysisRuns.map((run, index) => (
							<li key={run.id}>
								<details className="group rounded-xl border border-line bg-background/30" open={index === 0}>
									<summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 [&::-webkit-details-marker]:hidden">
										<span className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
											<span
												className={`inline-flex w-fit shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${RUN_STATUS_CLASSES[run.status]}`}
											>
												{text.runStatuses[run.status]}
											</span>
											<span className="truncate text-sm font-semibold">{formatDateTime(run.startedAt, locale)}</span>
											<span className="truncate text-xs text-muted">
												{run.provider ? PROVIDER_LABELS[run.provider] : text.providerNotSet}
												{run.model ? ` · ${run.model}` : ""}
											</span>
										</span>
										<span
											aria-hidden="true"
											className="size-2 shrink-0 rotate-45 border-b-2 border-r-2 border-muted transition-transform duration-200 group-open:rotate-[225deg]"
										/>
									</summary>
									<div className="flex flex-col gap-4 border-t border-line px-4 py-4">
										<div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
											<span>{interpolate(text.prompt, { version: run.promptVersion })}</span>
											<span className="tabular-nums">
												{interpolate(text.assessmentCount, { count: run.assessed })} <span aria-hidden="true">·</span>{" "}
												{interpolate(text.proposalCount, { count: run.proposed })}
											</span>
											{run.finishedAt ? (
												<span>
													{text.finished} {formatDateTime(run.finishedAt, locale)}
												</span>
											) : null}
										</div>
										{run.errorMessage ? (
											<p className="rounded-lg border border-rose-700/20 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-300/20 dark:bg-rose-300/[0.05] dark:text-rose-100">
												<strong>{text.errorLabel}</strong> {run.errorMessage}
											</p>
										) : null}
										{run.events.length > 0 ? (
											<ol className="flex flex-col gap-4 border-l border-line pl-5">
												{run.events.map((event) => (
													<li key={event.id} className="relative">
														<span
															aria-hidden="true"
															className={`absolute -left-[1.38rem] top-1.5 size-2.5 rounded-full ring-4 ring-background ${
																event.status === "failed"
																	? "bg-rose-300"
																	: event.status === "completed"
																		? "bg-success"
																		: "bg-accent"
															}`}
														/>
														<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
															<h3 className="text-sm font-semibold">{text.eventStages[event.stage] ?? event.stage}</h3>
															<span className="text-xs text-muted">
																{text.eventStatuses[event.status] ?? event.status} ·{" "}
																{formatDateTime(event.createdAt, locale)}
															</span>
														</div>
														<p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">
															{localizeAuditEvent(event, messages)}
														</p>
													</li>
												))}
											</ol>
										) : (
											<p className="text-sm text-muted">{text.noEvents}</p>
										)}
									</div>
								</details>
							</li>
						))}
					</ol>
				)}
			</section>

			<section className="flex flex-col gap-5" aria-label={text.textsAndProposals}>
				{detail.fields.length === 0 ? (
					<p className="rounded-xl border border-dashed border-line px-5 py-6 text-sm text-muted">{text.noFields}</p>
				) : (
					detail.fields.map((field) => {
						const item = reviewByField.get(field.field);
						const assessment = item?.assessment ?? null;
						const proposal = item?.proposal ?? null;
						const isAssessmentStale = Boolean(assessment && assessment.sourceHash !== field.sourceHash);
						return (
							<article
								key={field.id}
								className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 sm:p-6"
							>
								<div className="flex flex-wrap items-center justify-between gap-3">
									<h2 className="text-base font-semibold">{messageFor(text.fields, field.field) ?? field.field}</h2>
									<div className="flex flex-wrap items-center gap-3 text-xs text-muted">
										<span>{text.extractionStatuses[field.extraction]}</span>
										{assessment ? (
											<span className="rounded-md bg-accent/15 px-2.5 py-1 font-semibold tabular-nums text-accent-hover">
												{interpolate(text.score, { score: assessment.score })}
											</span>
										) : null}
										{isAssessmentStale ? <span>{text.staleAssessment}</span> : null}
									</div>
								</div>

								<div className="grid gap-5 lg:grid-cols-2">
									<div className="flex flex-col gap-3 rounded-xl bg-background/45 p-4">
										<h3 className="text-sm font-semibold">{text.sourceText}</h3>
										{field.sourceText ? (
											<p className="whitespace-pre-line text-sm leading-relaxed text-muted">{field.sourceText}</p>
										) : (
											<p className="text-sm text-muted">{localizeExtractionNote(field.extractionNote, messages)}</p>
										)}
										{assessment && assessment.issues.length > 0 ? (
											<div className="border-t border-line pt-3">
												<h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{text.issues}</h4>
												<ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
													{assessment.issues.map((issue) => (
														<li key={issue}>{issue}</li>
													))}
												</ul>
											</div>
										) : null}
									</div>

									<div className="flex flex-col gap-3 rounded-xl bg-background/45 p-4">
										<h3 className="text-sm font-semibold">
											{text.proposal}
											{proposal ? ` · ${text.proposalStatuses[proposal.status]}` : ""}
										</h3>
										{proposal ? (
											<form action={decideThisProposal} className="flex flex-col gap-3">
												<input type="hidden" name="proposalId" value={proposal.id} />
												{proposal.reason ? (
													<p className="rounded-lg border border-accent/20 bg-accent/[0.06] px-3 py-2 text-sm leading-relaxed text-muted">
														<span className="mb-1 block text-xs font-semibold text-foreground">{text.reason}</span>
														{proposal.reason}
													</p>
												) : null}
												<textarea
													className={inputClass}
													name="editedText"
													rows={4}
													defaultValue={proposal.editedText ?? proposal.proposedText}
													aria-label={interpolate(text.editProposal, {
														field: messageFor(text.fields, field.field) ?? field.field,
													})}
												/>
												<div className="flex flex-wrap gap-2">
													<button className={primaryButtonClass} type="submit" name="decision" value="approved">
														{text.approve}
													</button>
													<button className={secondaryButtonClass} type="submit" name="decision" value="rejected">
														{text.reject}
													</button>
												</div>
											</form>
										) : (
											<p className="text-sm text-muted">{text.noProposal}</p>
										)}
									</div>
								</div>
							</article>
						);
					})
				)}
			</section>
		</div>
	);
}
