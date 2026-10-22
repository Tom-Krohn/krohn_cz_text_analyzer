import { describe, expect, it } from "vite-plus/test";
import { getOnboardingProgress } from "./onboarding";

describe("getOnboardingProgress", () => {
	it("starts with project creation and disables later steps", () => {
		const progress = getOnboardingProgress([]);

		expect(progress.completedCount).toBe(0);
		expect(progress.isComplete).toBe(false);
		expect(progress.steps.map((step) => step.done)).toEqual([false, false, false, false]);
		expect(progress.steps[0].href).toBe("/admin#new-project");
		expect(progress.steps.slice(1).every((step) => step.href === undefined)).toBe(true);
	});

	it("returns the ordered, locale-independent onboarding step identifiers", () => {
		const progress = getOnboardingProgress([]);

		expect(progress.steps.map((step) => step.id)).toEqual(["project", "import", "scrape", "analyze"]);
	});

	it("derives progress from project data and links into the next workflow step", () => {
		const progress = getOnboardingProgress([
			{ id: "project-id", name: "Testovací projekt", pageCount: 12, scrapedCount: 7, analyzedCount: 2 },
		]);

		expect(progress.completedCount).toBe(4);
		expect(progress.isComplete).toBe(true);
		expect(progress.steps.map((step) => step.done)).toEqual([true, true, true, true]);
		expect(progress.steps[1].href).toBe("/admin/operations?projectId=project-id");
		expect(progress.steps[2].href).toBe("/admin/projects/project-id");
	});

	it("encodes project identifiers in action links", () => {
		const progress = getOnboardingProgress([
			{ id: "project id", name: "Testovací projekt", pageCount: 0, scrapedCount: 0, analyzedCount: 0 },
		]);

		expect(progress.steps[1].href).toBe("/admin/operations?projectId=project%20id");
		expect(progress.steps[2].href).toBe("/admin/projects/project%20id");
	});

	it("prioritizes the project that can continue the most complete unfinished step", () => {
		const progress = getOnboardingProgress([
			{ id: "empty-project", name: "Empty", pageCount: 0, scrapedCount: 0, analyzedCount: 0 },
			{ id: "ready-to-scrape", name: "Imported", pageCount: 8, scrapedCount: 0, analyzedCount: 0 },
		]);

		expect(progress.steps[1].href).toBe("/admin/operations?projectId=ready-to-scrape");
		expect(progress.steps[2].href).toBe("/admin/projects/ready-to-scrape");
	});
});
