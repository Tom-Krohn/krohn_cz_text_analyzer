import { describe, expect, it } from "vite-plus/test";
import { parseAnalysisRunFilters } from "./audit";

describe("parseAnalysisRunFilters", () => {
	const projectIds = ["11111111-1111-4111-8111-111111111111"];

	it("accepts only known project and run status filters", () => {
		const parsed = parseAnalysisRunFilters(
			{
				projectId: projectIds[0],
				status: "failed",
				q: " /product ",
				page: "3",
			},
			projectIds,
		);

		expect(parsed).toEqual({
			filters: { projectId: projectIds[0], status: "failed", q: "/product", page: 3 },
			invalidProjectSelection: false,
		});
	});

	it("drops invalid project/status/page values and reports the invalid project filter", () => {
		const parsed = parseAnalysisRunFilters({ projectId: "not-a-uuid", status: "unknown", page: "-1" }, projectIds);

		expect(parsed).toEqual({
			filters: { projectId: undefined, status: undefined, q: undefined, page: 1 },
			invalidProjectSelection: true,
		});
	});

	it("bounds URL search text", () => {
		const parsed = parseAnalysisRunFilters({ q: "x".repeat(250) }, projectIds);

		expect(parsed.filters.q).toHaveLength(200);
	});
});
