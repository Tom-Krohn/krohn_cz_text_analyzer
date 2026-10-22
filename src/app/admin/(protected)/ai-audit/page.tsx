import Link from "next/link";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/admin-ui";
import { SelectInput } from "@/components/select-input";
import {
	ANALYSIS_RUN_STATUSES,
	listAnalysisRuns,
	parseAnalysisRunFilters,
	type AnalysisRunStatus,
} from "@/lib/ai/audit";
import { PROVIDER_LABELS } from "@/lib/ai/providers";
import { requireAdmin } from "@/lib/auth/session";
import { listProjects } from "@/lib/projects/queries";
import { formatDateTime, interpolate, intlLocale } from "@/lib/i18n/format";
import { getRequestI18n } from "@/lib/i18n/server";

export const instant = false;

const STATUS_CLASSES: Record<AnalysisRunStatus, string> = {
	running: "bg-amber-300/10 text-amber-800 dark:text-amber-100",
	completed: "bg-success/10 text-success",
	failed: "bg-rose-300/10 text-rose-800 dark:text-rose-100",
};

function auditHref(filters: { projectId?: string; status?: AnalysisRunStatus; q?: string }, page: number): string {
	const params = new URLSearchParams();
	if (filters.projectId) params.set("projectId", filters.projectId);
	if (filters.status) params.set("status", filters.status);
	if (filters.q) params.set("q", filters.q);
	params.set("page", String(page));
	return `/admin/ai-audit?${params.toString()}`;
}

function PageControl({ href, label, disabled }: { href: string; label: string; disabled: boolean }) {
	if (disabled) {
		return (
			<span
				aria-disabled="true"
				className="inline-flex min-h-9 items-center rounded-lg border border-line px-3 py-1.5 text-xs text-muted/50"
			>
				{label}
			</span>
		);
	}
	return (
		<Link className={`${secondaryButtonClass} min-h-9 px-3 py-1.5 text-xs`} href={href}>
			{label}
		</Link>
	);
}

export default async function AiAuditPage({ searchParams }: PageProps<"/admin/ai-audit">) {
	await requireAdmin();
	const { locale, messages } = await getRequestI18n();
	const text = messages.aiAudit;
	const query = await searchParams;
	const projects = await listProjects();
	const { filters, invalidProjectSelection } = parseAnalysisRunFilters(
		query,
		projects.map((project) => project.id),
	);
	const history = await listAnalysisRuns(filters);
	const countCategory = new Intl.PluralRules(intlLocale(locale)).select(history.total);
	const countTemplate =
		countCategory === "one" ? text.countOne : countCategory === "few" ? text.countFew : text.countMany;

	return (
		<div className="flex w-full flex-col gap-8">
			<header className="flex flex-col gap-3">
				<p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{text.eyebrow}</p>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{text.title}</h1>
						<p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{text.description}</p>
					</div>
					<p className="shrink-0 text-sm font-medium tabular-nums text-muted">
						{interpolate(countTemplate, { count: history.total })}
					</p>
				</div>
			</header>

			{invalidProjectSelection ? (
				<p
					role="alert"
					className="rounded-lg border border-rose-700/25 border-l-2 border-l-rose-700/70 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-300/25 dark:border-l-rose-300/70 dark:bg-rose-300/[0.06] dark:text-rose-100"
				>
					{text.invalidProject}
				</p>
			) : null}

			<section className="rounded-2xl border border-line bg-surface p-4 sm:p-5" aria-label={text.filters}>
				<form
					className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,1fr)_minmax(14rem,1.3fr)_12rem_auto_auto]"
					method="get"
				>
					<SelectInput
						key={`project:${filters.projectId ?? ""}`}
						name="projectId"
						aria-label={text.projectFilter}
						defaultValue={filters.projectId ?? ""}
						options={[
							{ value: "", label: text.allProjects },
							...projects.map((project) => ({ value: project.id, label: project.name })),
						]}
					/>
					<input
						className={inputClass}
						name="q"
						defaultValue={filters.q ?? ""}
						maxLength={200}
						placeholder={text.searchPlaceholder}
						aria-label={text.searchAria}
					/>
					<SelectInput
						key={`status:${filters.status ?? ""}`}
						name="status"
						aria-label={text.statusFilter}
						defaultValue={filters.status ?? ""}
						options={[
							{ value: "", label: text.allStatuses },
							...ANALYSIS_RUN_STATUSES.map((status) => ({ value: status, label: text.statuses[status] })),
						]}
					/>
					<button className={primaryButtonClass} type="submit">
						{text.filter}
					</button>
					<Link className={`${secondaryButtonClass} w-fit`} href="/admin/ai-audit">
						{text.clear}
					</Link>
				</form>
			</section>

			<section className="flex flex-col gap-4" aria-label={text.history}>
				{history.rows.length === 0 ? (
					<div className="rounded-2xl border border-dashed border-line bg-surface/60 px-5 py-8 text-center">
						<h2 className="text-base font-semibold">{text.emptyTitle}</h2>
						<p className="mt-2 text-sm text-muted">{text.emptyDescription}</p>
					</div>
				) : (
					<ol className="flex flex-col gap-3">
						{history.rows.map((run) => (
							<li key={run.id}>
								<article className="rounded-2xl border border-line bg-surface p-4 transition-colors duration-200 hover:border-muted/40 sm:p-5">
									<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
										<div className="min-w-0">
											<Link
												className="block truncate text-sm font-semibold text-foreground underline decoration-line underline-offset-4 transition-colors hover:text-accent-hover"
												href={`/admin/projects/${run.projectId}/pages/${run.pageId}`}
											>
												{run.url}
											</Link>
											<p className="mt-1 text-xs text-muted">
												{run.projectName} <span aria-hidden="true">·</span> {formatDateTime(run.startedAt, locale)}
											</p>
										</div>
										<span
											className={`inline-flex w-fit shrink-0 items-center rounded-md px-2.5 py-1 text-xs font-semibold ${STATUS_CLASSES[run.status]}`}
										>
											{text.statuses[run.status]}
										</span>
									</div>

									<div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-3 text-xs text-muted">
										<span>
											{run.provider ? PROVIDER_LABELS[run.provider] : text.providerNotSet}
											{run.model ? ` · ${run.model}` : ""}
										</span>
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
										<p className="mt-3 rounded-lg border border-rose-700/20 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-300/20 dark:bg-rose-300/[0.05] dark:text-rose-100">
											<strong>{text.errorLabel}</strong> {run.errorMessage}
										</p>
									) : null}
								</article>
							</li>
						))}
					</ol>
				)}

				{history.lastPage > 1 ? (
					<nav className="flex items-center justify-between gap-4 text-sm" aria-label={text.pagination}>
						<PageControl
							disabled={history.currentPage === 1}
							href={auditHref(filters, history.currentPage - 1)}
							label={text.previous}
						/>
						<span className="tabular-nums text-xs text-muted">
							{interpolate(text.page, { current: history.currentPage, total: history.lastPage })}
						</span>
						<PageControl
							disabled={history.currentPage === history.lastPage}
							href={auditHref(filters, history.currentPage + 1)}
							label={text.next}
						/>
					</nav>
				) : null}
			</section>
		</div>
	);
}
