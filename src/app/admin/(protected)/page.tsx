import Link from "next/link";
import { Notice, inputClass, primaryButtonClass } from "@/components/admin-ui";
import { OpenProjectFormButton } from "@/components/open-project-form-button";
import { interpolate } from "@/lib/i18n/format";
import { getRequestI18n } from "@/lib/i18n/server";
import type { UiMessages } from "@/lib/i18n/messages";
import { requireAdmin } from "@/lib/auth/session";
import { listProjects } from "@/lib/projects/queries";
import { getOnboardingProgress } from "@/lib/projects/onboarding";
import { createProjectAction } from "./actions";

export const instant = false;

const labelClass = "flex flex-col gap-1.5 text-sm font-medium";
const hintClass = "text-xs font-normal leading-relaxed text-muted";

function OnboardingChecklist({
	progress,
	messages,
}: {
	progress: ReturnType<typeof getOnboardingProgress>;
	messages: UiMessages["dashboard"]["onboarding"];
}) {
	return (
		<details className="group overflow-hidden rounded-2xl border border-line bg-surface" open={!progress.isComplete}>
			<summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 sm:px-6 [&::-webkit-details-marker]:hidden">
				<div className="min-w-0">
					<p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{messages.eyebrow}</p>
					<h2 className="mt-1 text-xl font-semibold tracking-tight">{messages.title}</h2>
					<p className="mt-1 text-sm text-muted">
						{interpolate(messages.progress, { completed: progress.completedCount, total: progress.totalCount })}
						{" · "}
						{progress.isComplete ? messages.completeHint : messages.openHint}
					</p>
				</div>
				<span
					aria-hidden="true"
					className="size-2.5 shrink-0 rotate-45 border-b-2 border-r-2 border-muted transition-transform duration-200 group-open:rotate-[225deg]"
				/>
			</summary>
			<ol className="grid gap-3 border-t border-line p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
				{progress.steps.map((step, index) => {
					const stepMessages = messages.steps[step.id];
					const actionClassName =
						"flex h-full min-h-36 gap-3 rounded-xl border border-line bg-background/40 p-4 transition-colors duration-200 hover:border-accent/40 hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
					const buttonClassName = `${actionClassName} w-full cursor-pointer text-left`;
					const content = (
						<>
							<span
								aria-hidden="true"
								className={`grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold ${
									step.done ? "bg-success/15 text-success" : "bg-surface-raised text-muted"
								}`}
							>
								{step.done ? "✓" : String(index + 1).padStart(2, "0")}
							</span>
							<span className="min-w-0">
								<span className="block text-sm font-semibold">{stepMessages.title}</span>
								<span className="mt-1 block text-xs leading-relaxed text-muted">{stepMessages.description}</span>
								<span className={`mt-3 block text-xs font-semibold ${step.done ? "text-success" : "text-accent"}`}>
									{step.done ? messages.done : step.href ? messages.continue : messages.createProject}
								</span>
							</span>
						</>
					);
					return (
						<li key={step.id} className="h-full">
							{step.href ? (
								step.id === "project" ? (
									<OpenProjectFormButton className={buttonClassName}>{content}</OpenProjectFormButton>
								) : (
									<Link href={step.href} className={actionClassName}>
										{content}
									</Link>
								)
							) : (
								<div
									aria-disabled="true"
									className="flex h-full min-h-36 gap-3 rounded-xl border border-line/70 bg-background/20 p-4 text-muted/70"
								>
									{content}
								</div>
							)}
						</li>
					);
				})}
			</ol>
		</details>
	);
}

export default async function AdminHomePage({ searchParams }: PageProps<"/admin">) {
	await requireAdmin();
	const { messages } = await getRequestI18n();
	const query = await searchParams;
	const projects = await listProjects();
	const onboarding = getOnboardingProgress(projects);

	return (
		<div className="flex w-full flex-col gap-8">
			<header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
				<div className="max-w-2xl">
					<p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{messages.dashboard.eyebrow}</p>
					<h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{messages.dashboard.title}</h1>
					<p className="mt-2 text-sm leading-relaxed text-muted">{messages.dashboard.description}</p>
				</div>
				<OpenProjectFormButton className={`${primaryButtonClass} w-fit gap-2`}>
					<svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 16 16">
						<path d="M8 3v10M3 8h10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.75" />
					</svg>
					<span>{messages.dashboard.newProject}</span>
				</OpenProjectFormButton>
			</header>

			<OnboardingChecklist progress={onboarding} messages={messages.dashboard.onboarding} />

			<section className="flex flex-col gap-5">
				<Notice searchParams={query} />
				{projects.length === 0 ? (
					<div className="rounded-xl border border-dashed border-line bg-surface/60 px-5 py-4">
						<p className="text-sm font-semibold">{messages.dashboard.emptyTitle}</p>
						<p className="mt-1 text-sm text-muted">{messages.dashboard.emptyDescription}</p>
					</div>
				) : (
					<ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
						{projects.map((project) => (
							<li key={project.id}>
								<Link
									className="group flex w-full items-center justify-between gap-5 px-4 py-4 transition-colors duration-200 hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent sm:px-5"
									href={`/admin/projects/${project.id}`}
								>
									<span className="min-w-0">
										<span className="block truncate text-base font-semibold text-foreground transition-colors group-hover:text-accent-hover">
											{project.name}
										</span>
										<span className="mt-1 block truncate text-xs text-muted">{project.allowedHosts.join(", ")}</span>
										<span className="mt-2 block text-xs text-muted">
											{interpolate(messages.dashboard.projectCounts.scraped, { count: project.scrapedCount })}{" "}
											<span aria-hidden="true">·</span>{" "}
											{interpolate(messages.dashboard.projectCounts.analyzed, { count: project.analyzedCount })}
										</span>
									</span>
									<span className="flex shrink-0 items-center gap-3">
										<span className="rounded-lg bg-surface-raised px-3 py-2 text-sm font-semibold tabular-nums text-foreground">
											{interpolate(messages.dashboard.projectCounts.urls, { count: project.pageCount })}
										</span>
										<span
											aria-hidden="true"
											className="text-lg text-muted transition-transform group-hover:translate-x-0.5"
										>
											&rarr;
										</span>
									</span>
								</Link>
							</li>
						))}
					</ul>
				)}

				<details
					id="new-project"
					className="group rounded-2xl border border-line bg-surface"
					open={projects.length === 0}
				>
					<summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 text-base font-semibold transition-colors hover:bg-surface-raised group-open:rounded-b-none [&::-webkit-details-marker]:hidden sm:px-6">
						<span>{messages.dashboard.projectForm.heading}</span>
						<span
							aria-hidden="true"
							className="size-2.5 shrink-0 rotate-45 border-b-2 border-r-2 border-muted transition-transform duration-200 group-open:rotate-[225deg]"
						/>
					</summary>
					<form action={createProjectAction} className="grid gap-5 border-t border-line p-5 md:grid-cols-2 sm:p-6">
						<label className={labelClass}>
							{messages.dashboard.projectForm.name}
							<input className={inputClass} name="name" required maxLength={120} />
						</label>
						<label className={labelClass}>
							{messages.dashboard.projectForm.allowedHosts}
							<textarea
								className={inputClass}
								name="allowedHostsText"
								rows={2}
								required
								placeholder="shop.example.cz"
							/>
							<span className={hintClass}>{messages.dashboard.projectForm.allowedHostsHint}</span>
						</label>
						<label className={`${labelClass} md:col-span-2`}>
							{messages.dashboard.projectForm.audience}
							<textarea className={inputClass} name="audience" rows={4} maxLength={500} />
						</label>
						<label className={`${labelClass} md:col-span-2`}>
							{messages.dashboard.projectForm.tone}
							<textarea className={inputClass} name="tone" rows={3} maxLength={300} />
						</label>
						<label className={`${labelClass} md:col-span-2`}>
							{messages.dashboard.projectForm.rules}
							<textarea className={inputClass} name="rules" rows={10} maxLength={4000} />
						</label>
						<label className={labelClass}>
							{messages.dashboard.projectForm.qualityThreshold}
							<input className={inputClass} name="qualityThreshold" type="number" min={0} max={100} defaultValue={70} />
						</label>
						<div aria-hidden className="hidden md:block" />
						<label className={`${labelClass} md:col-span-2`}>
							{messages.dashboard.projectForm.mainContentSelector}
							<input
								className={inputClass}
								name="mainContentSelector"
								maxLength={300}
								placeholder={messages.dashboard.projectForm.mainPlaceholder}
							/>
							<span className={hintClass}>{messages.dashboard.projectForm.mainContentHint}</span>
						</label>
						<label className={labelClass}>
							{messages.dashboard.projectForm.shortDescriptionSelector}
							<input
								className={inputClass}
								name="shortDescriptionSelector"
								maxLength={300}
								placeholder={messages.dashboard.projectForm.shortPlaceholder}
							/>
							<span className={hintClass}>{messages.dashboard.projectForm.selectorHint}</span>
						</label>
						<label className={labelClass}>
							{messages.dashboard.projectForm.longDescriptionSelector}
							<input
								className={inputClass}
								name="longDescriptionSelector"
								maxLength={300}
								placeholder={messages.dashboard.projectForm.longPlaceholder}
							/>
							<span className={hintClass}>{messages.dashboard.projectForm.selectorHint}</span>
						</label>
						<label className={`${labelClass} md:col-span-2`}>
							{messages.dashboard.projectForm.excludedSelectors}
							<textarea
								className={inputClass}
								name="excludedSelectorsText"
								rows={4}
								maxLength={3000}
								placeholder={"header\nfooter\nnav\naside\n.cookie-banner"}
							/>
							<span className={hintClass}>{messages.dashboard.projectForm.excludedSelectorsHint}</span>
						</label>
						<div className="md:col-span-2">
							<button className={primaryButtonClass} type="submit">
								{messages.dashboard.projectForm.create}
							</button>
						</div>
					</form>
				</details>
			</section>
		</div>
	);
}
