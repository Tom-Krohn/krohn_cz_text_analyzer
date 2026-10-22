export type OnboardingProject = {
	id: string;
	name: string;
	pageCount: number;
	scrapedCount: number;
	analyzedCount: number;
};

export type OnboardingStep = {
	id: "project" | "import" | "scrape" | "analyze";
	done: boolean;
	href?: string;
};

export function getOnboardingProgress(projects: OnboardingProject[]) {
	const setupProject =
		projects.find((project) => project.pageCount > project.scrapedCount) ??
		projects.find((project) => project.scrapedCount > project.analyzedCount) ??
		projects.find((project) => project.pageCount === 0) ??
		projects[0] ??
		null;
	const projectHref = setupProject ? `/admin/projects/${encodeURIComponent(setupProject.id)}` : undefined;
	const operationsHref = setupProject
		? `/admin/operations?projectId=${encodeURIComponent(setupProject.id)}`
		: undefined;
	const steps: OnboardingStep[] = [
		{
			id: "project",
			done: projects.length > 0,
			href: "/admin#new-project",
		},
		{
			id: "import",
			done: projects.some((project) => project.pageCount > 0),
			href: operationsHref,
		},
		{
			id: "scrape",
			done: projects.some((project) => project.scrapedCount > 0),
			href: projectHref,
		},
		{
			id: "analyze",
			done: projects.some((project) => project.analyzedCount > 0),
			href: projectHref,
		},
	];

	const completedCount = steps.filter((step) => step.done).length;

	return {
		steps,
		completedCount,
		totalCount: steps.length,
		isComplete: completedCount === steps.length,
	};
}
