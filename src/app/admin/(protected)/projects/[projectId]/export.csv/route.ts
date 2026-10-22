import { auth } from "@/auth";
import { toCsv } from "@/lib/export/csv";
import { listApprovedRows } from "@/lib/export/approved";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: RouteContext<"/admin/projects/[projectId]/export.csv">) {
	const session = await auth();
	if (!session?.user) return new Response("Unauthorized", { status: 401 });

	const { projectId } = await params;
	if (!UUID_PATTERN.test(projectId)) return new Response("Not found", { status: 404 });

	const rows = await listApprovedRows(projectId);
	const csv = toCsv(
		["url", "pole", "puvodni_text", "schvaleny_text", "schvaleno"],
		rows.map((row) => [row.url, row.field, row.sourceText, row.approvedText, row.decidedAt]),
	);
	return new Response(`\uFEFF${csv}`, {
		headers: {
			"content-type": "text/csv; charset=utf-8",
			"content-disposition": `attachment; filename="schvalene-texty-${projectId}.csv"`,
		},
	});
}
