import { and, count, eq, inArray, isNotNull, or } from "drizzle-orm";
import { ACTIVE_JOB_STATUSES } from "@/lib/jobs/batch";
import { getDb } from "@/lib/db";
import { pages, processingJobs, projects } from "@/lib/db/schema";
import { projectSelectorsEqual, type ProjectSelectors } from "./selectors";

export async function saveProjectSelectors(projectId: string, selectors: ProjectSelectors) {
	const db = getDb();

	return db.transaction(async (tx) => {
		const [project] = await tx
			.select({ selectors: projects.selectors })
			.from(projects)
			.where(eq(projects.id, projectId))
			.for("update");
		if (!project) throw new Error("Projekt neexistuje.");
		if (projectSelectorsEqual(project.selectors, selectors)) {
			return { changed: false, pagesToRescrape: 0 };
		}

		const [activeJob] = await tx
			.select({ id: processingJobs.id })
			.from(processingJobs)
			.where(and(eq(processingJobs.projectId, projectId), inArray(processingJobs.status, [...ACTIVE_JOB_STATUSES])))
			.limit(1);
		if (activeJob) throw new Error("Selektory nelze změnit, dokud v projektu běží nebo čeká hromadná úloha.");

		const [scrapingPage] = await tx
			.select({ id: pages.id })
			.from(pages)
			.where(and(eq(pages.projectId, projectId), eq(pages.scrapeStatus, "scraping")))
			.limit(1);
		if (scrapingPage) throw new Error("Selektory nelze změnit, dokud se v projektu načítá stránka.");

		const previouslyScrapedPages = and(
			eq(pages.projectId, projectId),
			or(eq(pages.scrapeStatus, "scraped"), isNotNull(pages.scrapedAt)),
		);
		const [pageCount] = await tx.select({ total: count() }).from(pages).where(previouslyScrapedPages);

		await tx.update(projects).set({ selectors, updatedAt: new Date() }).where(eq(projects.id, projectId));
		if (pageCount.total > 0) {
			await tx
				.update(pages)
				.set({
					scrapeStatus: "pending",
					analyzedAt: null,
					errorMessage: null,
					updatedAt: new Date(),
				})
				.where(previouslyScrapedPages);
		}

		return { changed: true, pagesToRescrape: pageCount.total };
	});
}
