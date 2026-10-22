import { cancelBatchAction, deleteBatchJobAction } from "@/app/admin/(protected)/actions";
import { DeleteBatchJobButton } from "@/components/delete-batch-job-button";
import { secondaryButtonClass } from "@/components/admin-ui";
import { ACTIVE_JOB_STATUSES, TERMINAL_JOB_STATUSES } from "@/lib/jobs/batch";
import { estimateRemainingMilliseconds, formatEstimatedDuration } from "@/lib/jobs/estimate";
import { processingJobs } from "@/lib/db/schema";
import { formatDateTime, interpolate } from "@/lib/i18n/format";
import type { UiMessages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/i18n/types";

const JOB_STATUS_CLASSES: Record<string, string> = {
	queued: "bg-surface-raised text-muted",
	running: "bg-accent/10 text-accent-hover",
	waiting_quota: "bg-amber-300/10 text-amber-800 dark:text-amber-100",
	done: "bg-success/10 text-success",
	failed: "bg-rose-300/10 text-rose-800 dark:text-rose-100",
	cancelled: "bg-surface-raised text-muted",
};

type ProcessingJob = typeof processingJobs.$inferSelect;
type ActionDestination = "project" | "operations";

export function BatchJobList({
	jobs,
	destination,
	selectedProjectId,
	locale,
	messages,
}: {
	jobs: ProcessingJob[];
	destination: ActionDestination;
	selectedProjectId?: string;
	locale: Locale;
	messages: UiMessages["jobs"];
}) {
	return (
		<ul className="divide-y divide-line">
			{jobs.map((job) => {
				const done = job.processed + job.failed;
				const percent = job.total > 0 ? Math.min(100, Math.round((done / job.total) * 100)) : 0;
				const isActive = ACTIVE_JOB_STATUSES.some((status) => status === job.status);
				const isTerminal = TERMINAL_JOB_STATUSES.some((status) => status === job.status);
				const jobLabel =
					job.kind === "scrape" ? messages.kinds.scrape : job.kind === "analyze" ? messages.kinds.analyze : job.kind;
				const estimateMilliseconds =
					job.status === "running"
						? estimateRemainingMilliseconds({
								completed: done,
								startedAt: job.createdAt,
								total: job.total,
							})
						: null;
				let estimateText: string | null = null;
				if (estimateMilliseconds !== null) {
					estimateText = interpolate(messages.remainingTime, {
						duration: formatEstimatedDuration(estimateMilliseconds),
					});
				} else if (job.status === "running" && done < job.total) {
					estimateText = messages.estimateAfterFirstUrl;
				} else if (job.status === "running") {
					estimateText = messages.finishing;
				} else if (job.status === "queued") {
					estimateText = messages.estimateAfterStart;
				} else if (job.status === "waiting_quota") {
					estimateText = messages.estimateAfterQuota;
				}
				const cancelThisJob = cancelBatchAction.bind(null, job.projectId, job.id, destination, selectedProjectId ?? "");
				const deleteThisJob = deleteBatchJobAction.bind(
					null,
					job.projectId,
					job.id,
					destination,
					selectedProjectId ?? "",
				);

				return (
					<li
						key={job.id}
						className="flex flex-col gap-3 rounded-xl border border-line/80 bg-background/30 p-4 text-sm"
					>
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div className="flex min-w-0 flex-wrap items-center gap-2">
								<span className="font-semibold">{jobLabel}</span>
								<span
									className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${
										JOB_STATUS_CLASSES[job.status] ?? "bg-surface-raised text-muted"
									}`}
								>
									{messages.statuses[job.status] ?? job.status}
								</span>
							</div>
							<span className="text-xs tabular-nums text-muted">
								{interpolate(messages.processed, { done, total: job.total, failed: job.failed })}
							</span>
							{isActive ? (
								<form action={cancelThisJob}>
									<button className={secondaryButtonClass} type="submit">
										{messages.cancel}
									</button>
								</form>
							) : null}
							{isTerminal ? (
								<form action={deleteThisJob}>
									<DeleteBatchJobButton className={secondaryButtonClass} messages={messages} />
								</form>
							) : null}
						</div>
						<div className="flex items-center gap-3">
							<div
								role="progressbar"
								aria-label={interpolate(messages.progress, { label: jobLabel })}
								aria-valuemin={0}
								aria-valuemax={100}
								aria-valuenow={percent}
								aria-valuetext={interpolate(messages.progressValue, { done, total: job.total })}
								className="h-2 flex-1 overflow-hidden rounded-full bg-surface-raised"
							>
								<div
									aria-hidden="true"
									className={`h-full w-full origin-left rounded-full transition-transform duration-300 ${
										job.status === "done" ? "bg-success" : job.status === "failed" ? "bg-rose-300" : "bg-accent"
									}`}
									style={{ transform: `scaleX(${percent / 100})` }}
								/>
							</div>
							<span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-muted">{percent}%</span>
						</div>
						{estimateText ? <p className="text-xs text-muted">{estimateText}</p> : null}
						{job.lastError ? (
							<p className="text-sm text-rose-700 dark:text-rose-300">
								{messages.errorLabel} {job.lastError}
							</p>
						) : null}
						<p className="text-xs text-muted">
							{messages.started} {formatDateTime(job.createdAt, locale)}
							{job.finishedAt ? ` · ${messages.finished} ${formatDateTime(job.finishedAt, locale)}` : ""}
						</p>
					</li>
				);
			})}
		</ul>
	);
}
