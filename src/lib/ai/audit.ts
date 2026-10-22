import { and, asc, count, desc, eq, ilike, inArray, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { aiAnalysisRunEvents, aiAnalysisRuns, pages, projects } from "@/lib/db/schema";

export const ANALYSIS_RUN_STATUSES = ["running", "completed", "failed"] as const;
export const ANALYSIS_RUN_PAGE_SIZE = 40;
const PAGE_HISTORY_LIMIT = 12;

export type AnalysisRunStatus = (typeof ANALYSIS_RUN_STATUSES)[number];

export type AnalysisRunFilters = {
	projectId?: string;
	status?: AnalysisRunStatus;
	q?: string;
	page?: number;
};

export type AnalysisRunWithEvents = {
	id: string;
	projectId: string;
	pageId: string;
	status: AnalysisRunStatus;
	provider: (typeof aiAnalysisRuns.$inferSelect)["provider"];
	model: string | null;
	promptVersion: string;
	assessed: number;
	proposed: number;
	errorMessage: string | null;
	startedAt: Date;
	finishedAt: Date | null;
	events: (typeof aiAnalysisRunEvents.$inferSelect)[];
};

function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function single(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value;
}

export function parseAnalysisRunFilters(
	query: Record<string, string | string[] | undefined>,
	projectIds: string[],
): { filters: AnalysisRunFilters; invalidProjectSelection: boolean } {
	const requestedProjectId = single(query.projectId);
	const projectId = requestedProjectId && projectIds.includes(requestedProjectId) ? requestedProjectId : undefined;
	const rawStatus = single(query.status);
	const status = ANALYSIS_RUN_STATUSES.find((value) => value === rawStatus);
	const rawPage = Number.parseInt(single(query.page) ?? "1", 10);
	const q = single(query.q)?.trim().slice(0, 200);

	return {
		filters: {
			projectId,
			status,
			q: q || undefined,
			page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
		},
		invalidProjectSelection: Boolean(requestedProjectId) && !projectId,
	};
}

export async function listAnalysisRuns(filters: AnalysisRunFilters) {
	const conditions: SQL[] = [];
	if (filters.projectId) conditions.push(eq(aiAnalysisRuns.projectId, filters.projectId));
	if (filters.status) conditions.push(eq(aiAnalysisRuns.status, filters.status));
	if (filters.q) conditions.push(ilike(pages.url, `%${escapeLike(filters.q)}%`));
	const where = conditions.length > 0 ? and(...conditions) : undefined;
	const db = getDb();

	const [totalRow] = await db
		.select({ total: count() })
		.from(aiAnalysisRuns)
		.innerJoin(pages, eq(pages.id, aiAnalysisRuns.pageId))
		.where(where);
	const total = totalRow.total;
	const lastPage = Math.max(1, Math.ceil(total / ANALYSIS_RUN_PAGE_SIZE));
	const currentPage = Math.min(Math.max(filters.page ?? 1, 1), lastPage);
	const offset = (currentPage - 1) * ANALYSIS_RUN_PAGE_SIZE;
	const rows = await db
		.select({
			id: aiAnalysisRuns.id,
			projectId: aiAnalysisRuns.projectId,
			pageId: aiAnalysisRuns.pageId,
			status: aiAnalysisRuns.status,
			provider: aiAnalysisRuns.provider,
			model: aiAnalysisRuns.model,
			promptVersion: aiAnalysisRuns.promptVersion,
			assessed: aiAnalysisRuns.assessed,
			proposed: aiAnalysisRuns.proposed,
			errorMessage: aiAnalysisRuns.errorMessage,
			startedAt: aiAnalysisRuns.startedAt,
			finishedAt: aiAnalysisRuns.finishedAt,
			projectName: projects.name,
			url: pages.url,
		})
		.from(aiAnalysisRuns)
		.innerJoin(projects, eq(projects.id, aiAnalysisRuns.projectId))
		.innerJoin(pages, eq(pages.id, aiAnalysisRuns.pageId))
		.where(where)
		.orderBy(desc(aiAnalysisRuns.startedAt), desc(aiAnalysisRuns.id))
		.limit(ANALYSIS_RUN_PAGE_SIZE)
		.offset(offset);

	return { rows, total, currentPage, pageSize: ANALYSIS_RUN_PAGE_SIZE, lastPage };
}

export async function getPageAnalysisAudit(projectId: string, pageId: string): Promise<AnalysisRunWithEvents[]> {
	const db = getDb();
	const runs = await db
		.select({
			id: aiAnalysisRuns.id,
			projectId: aiAnalysisRuns.projectId,
			pageId: aiAnalysisRuns.pageId,
			status: aiAnalysisRuns.status,
			provider: aiAnalysisRuns.provider,
			model: aiAnalysisRuns.model,
			promptVersion: aiAnalysisRuns.promptVersion,
			assessed: aiAnalysisRuns.assessed,
			proposed: aiAnalysisRuns.proposed,
			errorMessage: aiAnalysisRuns.errorMessage,
			startedAt: aiAnalysisRuns.startedAt,
			finishedAt: aiAnalysisRuns.finishedAt,
		})
		.from(aiAnalysisRuns)
		.where(and(eq(aiAnalysisRuns.projectId, projectId), eq(aiAnalysisRuns.pageId, pageId)))
		.orderBy(desc(aiAnalysisRuns.startedAt), desc(aiAnalysisRuns.id))
		.limit(PAGE_HISTORY_LIMIT);
	if (runs.length === 0) return [];

	const events = await db
		.select()
		.from(aiAnalysisRunEvents)
		.where(
			inArray(
				aiAnalysisRunEvents.runId,
				runs.map((run) => run.id),
			),
		)
		.orderBy(asc(aiAnalysisRunEvents.sequence));
	const eventsByRun = new Map<string, (typeof events)[number][]>();
	for (const event of events) {
		const runEvents = eventsByRun.get(event.runId);
		if (runEvents) runEvents.push(event);
		else eventsByRun.set(event.runId, [event]);
	}

	return runs.map((run) => ({ ...run, events: eventsByRun.get(run.id) ?? [] }));
}
