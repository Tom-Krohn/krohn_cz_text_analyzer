import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { BatchJobList } from "@/components/batch-job-list";
import { ExtractionSettingsForm } from "@/components/extraction-settings-form";
import { Notice, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/admin-ui";
import { SelectInput } from "@/components/select-input";
import { requireAdmin } from "@/lib/auth/session";
import { listBatchJobsAcrossProjects, ACTIVE_JOB_STATUSES } from "@/lib/jobs/batch";
import { listProjects, getProject, listSamplePages } from "@/lib/projects/queries";
import { interpolate } from "@/lib/i18n/format";
import { getRequestI18n } from "@/lib/i18n/server";
import { importFeedFileAction, importFeedUrlAction } from "../actions";

export const instant = false;

function single(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value;
}

export default async function OperationsPage({ searchParams }: PageProps<"/admin/operations">) {
	await requireAdmin();
	const { locale, messages } = await getRequestI18n();
	const text = messages.operations;
	const query = await searchParams;
	const requestedProjectId = single(query.projectId);
	const [projects, historyRows] = await Promise.all([listProjects(), listBatchJobsAcrossProjects()]);
	const selectedProjectId = requestedProjectId
		? projects.find((project) => project.id === requestedProjectId)?.id
		: projects.length === 1
			? projects[0].id
			: undefined;
	const invalidProjectSelection = Boolean(requestedProjectId) && !selectedProjectId;
	const project = selectedProjectId ? await getProject(selectedProjectId) : null;
	if (selectedProjectId && !project) notFound();
	const samplePages = selectedProjectId ? await listSamplePages(selectedProjectId) : [];
	const projectOptions = [
		{ value: "", label: projects.length === 0 ? text.noProjects : text.selectProject },
		...projects.map((item) => ({ value: item.id, label: item.name })),
	];
	const historyGroups = new Map<
		string,
		{ projectId: string; projectName: string; jobs: (typeof historyRows)[number]["job"][] }
	>();

	for (const { job, projectName } of historyRows) {
		const group = historyGroups.get(job.projectId);
		if (group) {
			group.jobs.push(job);
		} else {
			historyGroups.set(job.projectId, { projectId: job.projectId, projectName, jobs: [job] });
		}
	}

	const groups = [...historyGroups.values()];
	const importUrl = project ? importFeedUrlAction.bind(null, project.id, "operations") : null;
	const importFile = project ? importFeedFileAction.bind(null, project.id, "operations") : null;

	return (
		<div className="mx-auto flex w-full max-w-[88rem] flex-col gap-8">
			<header className="flex flex-col gap-2">
				<p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{text.eyebrow}</p>
				<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{text.title}</h1>
				<p className="max-w-3xl text-sm leading-relaxed text-muted">{text.description}</p>
			</header>

			<Notice searchParams={query} />

			<section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
				<div className="flex flex-col gap-1">
					<h2 className="text-base font-semibold">{text.projectSection}</h2>
					<p className="text-sm text-muted">{text.projectSectionHint}</p>
				</div>
				<form action="/admin/operations" className="flex flex-col gap-3 sm:flex-row sm:items-end" method="get">
					<label className="flex w-full max-w-xl flex-col gap-1.5 text-sm font-medium">
						{text.project}
						<SelectInput
							key={selectedProjectId ?? "no-project"}
							name="projectId"
							aria-label={text.projectAria}
							defaultValue={selectedProjectId ?? ""}
							options={projectOptions}
						/>
					</label>
					<button className={`${secondaryButtonClass} w-fit`} type="submit" disabled={projects.length === 0}>
						{text.showProject}
					</button>
				</form>
				{invalidProjectSelection ? (
					<p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
						{text.invalidProject}
					</p>
				) : null}
				{projects.length === 0 ? (
					<p className="text-sm text-muted">
						{text.createProjectBeforeImport}{" "}
						<Link className="underline" href="/admin">
							{messages.navigation.projects}
						</Link>
						.
					</p>
				) : null}
			</section>

			{project && importUrl && importFile ? (
				<>
					<div className="flex flex-col gap-4">
						<p className="rounded-lg border border-accent/20 bg-accent/[0.05] px-4 py-3 text-sm text-muted">
							{text.activeProject} <span className="font-semibold text-foreground">{project.name}</span>
							<span aria-hidden="true"> · </span>
							{text.allowedDomains}: {project.allowedHosts.join(", ")}
						</p>
						<div className="grid gap-6 lg:grid-cols-2">
							<form
								action={importUrl}
								className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6"
							>
								<div>
									<p className="text-xs font-semibold uppercase tracking-wide text-accent">{text.fromUrl}</p>
									<h2 className="mt-1 text-base font-semibold">{text.urlImport}</h2>
								</div>
								<SelectInput
									name="format"
									aria-label={text.urlFormat}
									defaultValue="sitemap"
									options={[
										{ value: "sitemap", label: text.formats.sitemapUrl },
										{ value: "heureka", label: text.formats.heureka },
										{ value: "zbozi", label: text.formats.zbozi },
									]}
								/>
								<input
									className={inputClass}
									name="feedUrl"
									type="url"
									required
									placeholder={text.feedUrlPlaceholder}
								/>
								<button className={primaryButtonClass} type="submit">
									{text.importUrl}
								</button>
							</form>

							<form
								action={importFile}
								className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6"
							>
								<div>
									<p className="text-xs font-semibold uppercase tracking-wide text-accent">{text.fromDevice}</p>
									<h2 className="mt-1 text-base font-semibold">{text.fileImport}</h2>
								</div>
								<SelectInput
									name="format"
									aria-label={text.fileFormat}
									defaultValue="sitemap"
									options={[
										{ value: "sitemap", label: text.formats.sitemapFile },
										{ value: "heureka", label: text.formats.heureka },
										{ value: "zbozi", label: text.formats.zbozi },
									]}
								/>
								<input
									className={inputClass}
									name="feedFile"
									type="file"
									accept=".xml,.gz,application/xml,application/gzip"
									required
								/>
								<button className={primaryButtonClass} type="submit">
									{text.uploadAndImport}
								</button>
							</form>
						</div>
					</div>

					<ExtractionSettingsForm
						key={`${project.id}:${JSON.stringify(project.selectors)}`}
						projectId={project.id}
						selectors={project.selectors}
						samplePages={samplePages}
						destination="operations"
						messages={messages.extraction}
					/>
				</>
			) : (
				<p className="rounded-2xl border border-dashed border-line bg-surface/60 p-5 text-sm text-muted">
					{text.noProjectSelected}
				</p>
			)}

			<section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
				<div className="flex flex-col gap-1">
					<p className="text-xs font-semibold uppercase tracking-wide text-accent">{text.automation}</p>
					<h2 className="text-base font-semibold">{text.history}</h2>
					<p className="text-sm text-muted">{text.historyHint}</p>
				</div>
				{groups.length === 0 ? (
					<p className="rounded-xl border border-dashed border-line px-4 py-5 text-sm text-muted">{text.noHistory}</p>
				) : groups.length === 1 ? (
					<div>
						<h3 className="mb-2 text-sm font-semibold">{groups[0].projectName}</h3>
						<BatchJobList
							jobs={groups[0].jobs}
							destination="operations"
							selectedProjectId={selectedProjectId}
							locale={locale}
							messages={messages.jobs}
						/>
					</div>
				) : (
					<div className="flex flex-col gap-3">
						{groups.map((group) => {
							const activeCount = group.jobs.filter((job) =>
								ACTIVE_JOB_STATUSES.some((status) => status === job.status),
							).length;
							return (
								<details
									key={group.projectId}
									className="group rounded-xl border border-line bg-background/40 px-4"
									open={group.projectId === selectedProjectId}
								>
									<summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
										<span className="min-w-0 truncate">{group.projectName}</span>
										<span className="flex shrink-0 items-center gap-3 text-xs font-normal text-muted">
											<span>{interpolate(text.recordCount, { count: group.jobs.length })}</span>
											{activeCount > 0 ? <span>{interpolate(text.activeCount, { count: activeCount })}</span> : null}
											<span
												aria-hidden="true"
												className="size-2 rotate-45 border-b-2 border-r-2 border-accent transition-transform group-open:rotate-[225deg]"
											/>
										</span>
									</summary>
									<BatchJobList
										jobs={group.jobs}
										destination="operations"
										selectedProjectId={selectedProjectId}
										locale={locale}
										messages={messages.jobs}
									/>
								</details>
							);
						})}
					</div>
				)}
				<AutoRefresh
					active={historyRows.some(({ job }) => ACTIVE_JOB_STATUSES.some((status) => status === job.status))}
				/>
			</section>
		</div>
	);
}
