import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pageFields, pages, textProposals } from "@/lib/db/schema";

export async function listApprovedRows(projectId: string) {
	const rows = await getDb()
		.select({
			pageFieldId: textProposals.pageFieldId,
			url: pages.url,
			field: pageFields.field,
			sourceText: pageFields.sourceText,
			proposedText: textProposals.proposedText,
			editedText: textProposals.editedText,
			decidedAt: textProposals.decidedAt,
		})
		.from(textProposals)
		.innerJoin(pageFields, eq(pageFields.id, textProposals.pageFieldId))
		.innerJoin(pages, eq(pages.id, pageFields.pageId))
		.where(and(eq(pages.projectId, projectId), eq(textProposals.status, "approved")))
		.orderBy(desc(textProposals.decidedAt));

	const seenFields = new Set<string>();
	return rows
		.filter((row) => {
			if (seenFields.has(row.pageFieldId)) return false;
			seenFields.add(row.pageFieldId);
			return true;
		})
		.map((row) => ({
			url: row.url,
			field: row.field,
			sourceText: row.sourceText,
			approvedText: row.editedText ?? row.proposedText,
			decidedAt: row.decidedAt?.toISOString() ?? "",
		}));
}
