import { and, asc, count, desc, eq, ilike, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pageFields, pages, projects } from "@/lib/db/schema";

export const PAGE_SIZE = 50;

export type PageFilters = {
	q?: string;
	kind?: "product" | "page" | "unknown";
	status?: "pending" | "scraping" | "scraped" | "failed" | "blocked" | "skipped";
	analysis?: "analyzed" | "not_analyzed";
	page?: number;
};

function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export function listProjects() {
	return getDb()
		.select({
			id: projects.id,
			name: projects.name,
			allowedHosts: projects.allowedHosts,
			qualityThreshold: projects.qualityThreshold,
			pageCount: count(pages.id),
			scrapedCount: sql<number>`count(*) filter (where ${pages.scrapeStatus} = 'scraped')`,
			analyzedCount: sql<number>`count(*) filter (where ${pages.analyzedAt} is not null)`,
		})
		.from(projects)
		.leftJoin(pages, eq(pages.projectId, projects.id))
		.groupBy(projects.id)
		.orderBy(asc(projects.name));
}

export async function getProject(projectId: string) {
	const [project] = await getDb().select().from(projects).where(eq(projects.id, projectId));
	return project ?? null;
}

export async function listPages(projectId: string, filters: PageFilters) {
	const conditions: SQL[] = [eq(pages.projectId, projectId)];
	if (filters.q) conditions.push(ilike(pages.url, `%${escapeLike(filters.q)}%`));
	if (filters.kind) conditions.push(eq(pages.kind, filters.kind));
	if (filters.status) conditions.push(eq(pages.scrapeStatus, filters.status));
	if (filters.analysis === "analyzed") conditions.push(isNotNull(pages.analyzedAt));
	if (filters.analysis === "not_analyzed") conditions.push(isNull(pages.analyzedAt));
	const where = and(...conditions);

	const db = getDb();
	const [totalRow] = await db.select({ total: count() }).from(pages).where(where);
	const total = totalRow.total;
	const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const currentPage = Math.min(Math.max(1, filters.page ?? 1), lastPage);
	const offset = (currentPage - 1) * PAGE_SIZE;
	const rows = await db
		.select({
			id: pages.id,
			url: pages.url,
			kind: pages.kind,
			scrapeStatus: pages.scrapeStatus,
			httpStatus: pages.httpStatus,
			errorMessage: pages.errorMessage,
			scrapedAt: pages.scrapedAt,
			analyzedAt: pages.analyzedAt,
		})
		.from(pages)
		.where(where)
		.orderBy(desc(pages.createdAt), asc(pages.url))
		.limit(PAGE_SIZE)
		.offset(offset);
	return { rows, total, pageSize: PAGE_SIZE, currentPage };
}

export async function getPageDetail(projectId: string, pageId: string) {
	const db = getDb();
	const [page] = await db
		.select()
		.from(pages)
		.where(and(eq(pages.id, pageId), eq(pages.projectId, projectId)));
	if (!page) return null;
	const fields = await db.select().from(pageFields).where(eq(pageFields.pageId, pageId)).orderBy(asc(pageFields.field));
	return { page, fields };
}

export async function countPages(projectId: string) {
	const [row] = await getDb().select({ total: count() }).from(pages).where(eq(pages.projectId, projectId));
	return row.total;
}

export function listSamplePages(projectId: string, limit = 50) {
	return getDb()
		.select({ id: pages.id, url: pages.url })
		.from(pages)
		.where(eq(pages.projectId, projectId))
		.orderBy(desc(pages.createdAt), asc(pages.url))
		.limit(limit);
}
