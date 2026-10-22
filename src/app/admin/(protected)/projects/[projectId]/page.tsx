import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { BatchJobList } from "@/components/batch-job-list";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { Notice, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/admin-ui";
import { SelectInput } from "@/components/select-input";
import { requireAdmin } from "@/lib/auth/session";
import { countBatchCandidates, listActiveBatchJobs } from "@/lib/jobs/batch";
import { countPages, getProject, listPages, PAGE_SIZE, type PageFilters } from "@/lib/projects/queries";
import { interpolate } from "@/lib/i18n/format";
import { getRequestI18n } from "@/lib/i18n/server";
import { deleteProjectAction, startBatchAction } from "../../actions";

export const instant = false;

const KINDS = ["product", "page", "unknown"] as const;
const STATUSES = ["pending", "scraping", "scraped", "failed", "blocked", "skipped"] as const;
const ANALYSIS_STATUSES = ["analyzed", "not_analyzed"] as const;

const STATUS_CLASSES: Record<(typeof STATUSES)[number], string> = {
	pending: "bg-surface-raised text-muted",
	scraping: "bg-accent/10 text-accent-hover",
	scraped: "bg-success/10 text-success",
	failed: "bg-rose-300/10 text-rose-800 dark:text-rose-100",
	blocked: "bg-amber-300/10 text-amber-800 dark:text-amber-100",
	skipped: "bg-surface-raised text-muted",
};
const ANALYSIS_STATUS_CLASSES: Record<(typeof ANALYSIS_STATUSES)[number], string> = {
	analyzed: "bg-success/10 text-success",
	not_analyzed: "bg-surface-raised text-muted",
};

const paginationControlClass =
	"inline-flex min-h-9 items-center justify-center rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const disabledPaginationControlClass =
	"inline-flex min-h-9 cursor-not-allowed items-center justify-center rounded-lg border border-line px-3 text-xs font-semibold text-muted/50";

type PaginationItem = number | "ellipsis";

function single(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value;
}

function getPaginationItems(currentPage: number, lastPage: number): PaginationItem[] {
	const visiblePages = new Set([1, lastPage]);
	for (let page = Math.max(1, currentPage - 2); page <= Math.min(lastPage, currentPage + 2); page += 1) {
		visiblePages.add(page);
	}

	const pages = [...visiblePages].sort((left, right) => left - right);
	const items: PaginationItem[] = [];
	for (const [index, page] of pages.entries()) {
		const previousPage = pages[index - 1];
		if (previousPage !== undefined && page - previousPage > 2) {
			items.push("ellipsis");
		} else if (previousPage !== undefined && page - previousPage === 2) {
			items.push(previousPage + 1);
		}
		items.push(page);
	}
	return items;
}

function pageHref(filterQuery: URLSearchParams, page: number): string {
	const params = new URLSearchParams(filterQuery.toString());
	params.set("page", String(page));
	return `?${params.toString()}`;
}

function PaginationControl({ href, label, ariaLabel }: { href?: string; label: string; ariaLabel: string }) {
	if (!href) {
		return (
			<span aria-disabled="true" className={disabledPaginationControlClass}>
				{label}
			</span>
		);
	}
	return (
		<Link aria-label={ariaLabel} className={paginationControlClass} href={href}>
			{label}
		</Link>
	);
}

function parseFilters(query: Record<string, string | string[] | undefined>): PageFilters {
	const kind = KINDS.find((value) => value === single(query.kind));
	const status = STATUSES.find((value) => value === single(query.status));
	const analysis = ANALYSIS_STATUSES.find((value) => value === single(query.analysis));
	const page = Number.parseInt(single(query.page) ?? "1", 10);
	const q = single(query.q)?.trim();
	return { q: q || undefined, kind, status, analysis, page: Number.isFinite(page) && page > 0 ? page : 1 };
}

export default async function ProjectPage({ params, searchParams }: PageProps<"/admin/projects/[projectId]">) {
	await requireAdmin();
	const { locale, messages } = await getRequestI18n();
	const text = messages.project;
	const { projectId } = await params;
	const query = await searchParams;
	const project = await getProject(projectId);
	if (!project) notFound();

	const filters = parseFilters(query);
	const [workflowBeforeCommand, workflowAfterCommand] = text.workflowDescription.split("{command}");
	const { rows, total, currentPage } = await listPages(projectId, filters);
	const projectTotal = await countPages(projectId);
	const scrapeCount = await countBatchCandidates(projectId, "scrape");
	const analyzeCount = await countBatchCandidates(projectId, "analyze");
	const jobs = await listActiveBatchJobs(projectId);
	const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const paginationItems = getPaginationItems(currentPage, lastPage);
	const filterQuery = new URLSearchParams({
		...(filters.q ? { q: filters.q } : {}),
		...(filters.kind ? { kind: filters.kind } : {}),
		...(filters.status ? { status: filters.status } : {}),
		...(filters.analysis ? { analysis: filters.analysis } : {}),
	});

	const scrapeAll = startBatchAction.bind(null, projectId, "scrape");
	const analyzeAll = startBatchAction.bind(null, projectId, "analyze");
	const deleteThisProject = deleteProjectAction.bind(null, projectId);

	return (
		<div className="mx-auto flex w-full max-w-[88rem] flex-col gap-7">
			<header className="flex flex-col gap-3">
				<p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{text.eyebrow}</p>
				<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{project.name}</h1>
				<div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
					<span>{project.allowedHosts.join(", ")}</span>
					<span>{interpolate(text.qualityThreshold, { score: project.qualityThreshold })}</span>
					<span className="font-semibold tabular-nums text-foreground">
						{interpolate(text.pageCount, { count: projectTotal })}
					</span>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					<Link className={secondaryButtonClass} href={`/admin/ai-audit?projectId=${encodeURIComponent(projectId)}`}>
						{text.audit}
					</Link>
					<a className={secondaryButtonClass} href={`/admin/projects/${projectId}/export.csv`}>
						{text.export}
					</a>
					<form action={deleteThisProject}>
						<DeleteProjectButton projectName={project.name} messages={text} />
					</form>
				</div>
			</header>

			<Notice searchParams={query} />

			<section className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 sm:p-6">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div className="flex flex-col gap-1">
						<p className="text-xs font-semibold uppercase tracking-wide text-accent">{text.workflow}</p>
						<h2 className="text-lg font-semibold">{text.batchProcessing}</h2>
						<p className="text-sm text-muted">
							{workflowBeforeCommand}
							<code>pnpm jobs:dev</code>
							{workflowAfterCommand}
						</p>
					</div>
					{process.env.NODE_ENV === "development" ? (
						<a
							className={`${secondaryButtonClass} w-fit shrink-0`}
							href="http://localhost:8288"
							target="_blank"
							rel="noopener noreferrer"
						>
							{text.jobManager}
						</a>
					) : null}
				</div>

				<div className="flex flex-wrap gap-3">
					<form action={scrapeAll}>
						<button className={primaryButtonClass} type="submit" disabled={scrapeCount === 0}>
							{interpolate(text.scrapeAll, { count: scrapeCount })}
						</button>
					</form>
					<form action={analyzeAll}>
						<button className={primaryButtonClass} type="submit" disabled={analyzeCount === 0}>
							{interpolate(text.analyzeAll, { count: analyzeCount })}
						</button>
					</form>
				</div>

				{jobs.length === 0 ? (
					<p className="text-sm text-muted">{text.noActiveJobs}</p>
				) : (
					<BatchJobList
						jobs={jobs}
						destination="project"
						selectedProjectId={projectId}
						locale={locale}
						messages={messages.jobs}
					/>
				)}
				<AutoRefresh active={jobs.length > 0} />
			</section>

			<section className="flex flex-col gap-4">
				<form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_12rem_12rem_12rem_auto]" method="get">
					<input
						className={inputClass}
						name="q"
						defaultValue={filters.q ?? ""}
						placeholder={text.searchAria}
						aria-label={text.searchAria}
					/>
					<SelectInput
						key={`kind:${filters.kind ?? ""}`}
						name="kind"
						defaultValue={filters.kind ?? ""}
						aria-label={text.kindAria}
						options={[
							{ value: "", label: text.allKinds },
							...KINDS.map((kind) => ({ value: kind, label: text.kinds[kind] })),
						]}
					/>
					<SelectInput
						key={`status:${filters.status ?? ""}`}
						name="status"
						defaultValue={filters.status ?? ""}
						aria-label={text.scrapeStatusAria}
						options={[
							{ value: "", label: text.allScrapeStatuses },
							...STATUSES.map((status) => ({ value: status, label: text.scrapeStatuses[status] })),
						]}
					/>
					<SelectInput
						key={`analysis:${filters.analysis ?? ""}`}
						name="analysis"
						defaultValue={filters.analysis ?? ""}
						aria-label={text.analysisStatusAria}
						options={[
							{ value: "", label: text.allAnalysisStatuses },
							...ANALYSIS_STATUSES.map((analysis) => ({
								value: analysis,
								label: text.analysisStatuses[analysis],
							})),
						]}
					/>
					<button className={secondaryButtonClass} type="submit">
						{text.filter}
					</button>
				</form>

				<div className="overflow-x-auto rounded-xl border border-line bg-surface">
					<table className="w-full min-w-[48rem] text-left text-sm">
						<thead className="bg-surface-raised/80 text-xs font-semibold text-muted">
							<tr>
								<th scope="col" className="px-4 py-3 font-medium">
									{text.table.url}
								</th>
								<th scope="col" className="px-4 py-3 font-medium">
									{text.table.type}
								</th>
								<th scope="col" className="px-4 py-3 font-medium">
									{text.table.scrape}
								</th>
								<th scope="col" className="px-4 py-3 font-medium">
									{text.table.analysis}
								</th>
								<th scope="col" className="px-4 py-3 font-medium">
									{text.table.http}
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-line">
							{rows.length === 0 ? (
								<tr>
									<td className="px-4 py-8 text-center text-muted" colSpan={5}>
										{text.table.empty}
									</td>
								</tr>
							) : (
								rows.map((row) => (
									<tr key={row.id} className="transition-colors duration-150 hover:bg-surface-raised/70">
										<td className="max-w-md truncate px-4 py-3">
											<Link
												className="underline decoration-line underline-offset-4 transition-colors hover:text-accent-hover"
												href={`/admin/projects/${projectId}/pages/${row.id}`}
											>
												{row.url}
											</Link>
										</td>
										<td className="px-4 py-3">{text.kinds[row.kind]}</td>
										<td className="px-4 py-3">
											<span
												className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${STATUS_CLASSES[row.scrapeStatus]}`}
											>
												{text.scrapeStatuses[row.scrapeStatus]}
											</span>
										</td>
										<td className="px-4 py-3">
											<span
												className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${
													ANALYSIS_STATUS_CLASSES[row.analyzedAt ? "analyzed" : "not_analyzed"]
												}`}
											>
												{text.analysisStatuses[row.analyzedAt ? "analyzed" : "not_analyzed"]}
											</span>
										</td>
										<td className="px-4 py-3 tabular-nums">{row.httpStatus ?? "–"}</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>

				<nav className="flex flex-col gap-3 text-sm" aria-label={text.table.pagination}>
					<div className="flex items-center justify-between gap-3 lg:hidden">
						<PaginationControl
							href={currentPage > 1 ? pageHref(filterQuery, currentPage - 1) : undefined}
							label={text.table.previous}
							ariaLabel={text.table.previous}
						/>
						<span className="tabular-nums text-xs text-muted">
							{interpolate(text.table.page, { current: currentPage, total: lastPage })}
						</span>
						<PaginationControl
							href={currentPage < lastPage ? pageHref(filterQuery, currentPage + 1) : undefined}
							label={text.table.next}
							ariaLabel={text.table.next}
						/>
					</div>
					<div className="hidden flex-wrap items-center justify-between gap-3 lg:flex">
						<div className="flex items-center gap-1">
							<PaginationControl
								href={currentPage > 1 ? pageHref(filterQuery, 1) : undefined}
								label={text.table.first}
								ariaLabel={text.table.first}
							/>
							<PaginationControl
								href={currentPage > 1 ? pageHref(filterQuery, currentPage - 1) : undefined}
								label={text.table.previous}
								ariaLabel={text.table.previous}
							/>
						</div>
						<div className="flex items-center gap-1">
							{paginationItems.map((item, index) =>
								item === "ellipsis" ? (
									<span key={`ellipsis-${index}`} aria-hidden="true" className="px-1 text-muted">
										…
									</span>
								) : (
									<Link
										key={item}
										href={pageHref(filterQuery, item)}
										aria-label={interpolate(text.table.pageAria, { page: item })}
										aria-current={item === currentPage ? "page" : undefined}
										className={
											item === currentPage
												? "inline-flex size-9 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-white shadow-sm shadow-accent/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
												: "inline-flex size-9 items-center justify-center rounded-lg border border-line bg-surface text-sm font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
										}
									>
										{item}
									</Link>
								),
							)}
						</div>
						<div className="flex items-center gap-1">
							<PaginationControl
								href={currentPage < lastPage ? pageHref(filterQuery, currentPage + 1) : undefined}
								label={text.table.next}
								ariaLabel={text.table.next}
							/>
							<PaginationControl
								href={currentPage < lastPage ? pageHref(filterQuery, lastPage) : undefined}
								label={text.table.last}
								ariaLabel={text.table.last}
							/>
						</div>
					</div>
				</nav>
			</section>
		</div>
	);
}
