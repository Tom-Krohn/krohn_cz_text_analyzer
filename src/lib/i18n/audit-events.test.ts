import { describe, expect, it } from "vite-plus/test";
import { getMessages } from "./messages";
import { localizeAuditEvent } from "./audit-events";

describe("localizeAuditEvent", () => {
	it("localizes stored analysis progress summaries without translating model output", () => {
		const messages = getMessages("en");
		expect(
			localizeAuditEvent(
				{
					stage: "input_preparation",
					status: "completed",
					summary: "Připraveno 3 polí. Do auditu se ukládá pouze počet polí, nikoli jejich text.",
				},
				messages,
			),
		).toBe("Prepared 3 fields. Only the field count, not their text, is stored in the audit.");
	});

	it("localizes proposal decisions and field labels", () => {
		const messages = getMessages("en");
		expect(
			localizeAuditEvent(
				{
					stage: "proposal_decision",
					status: "completed",
					summary: "Návrh pro pole „seo_title“ byl schválen. Text byl před rozhodnutím upraven.",
				},
				messages,
			),
		).toBe("The suggestion for “SEO title” was approved. The text was edited before the decision.");
	});

	it("preserves unknown summaries instead of changing stored content", () => {
		const summary = "User-provided diagnostic text";
		expect(localizeAuditEvent({ stage: "model_evaluation", status: "completed", summary }, getMessages("en"))).toBe(
			summary,
		);
	});
});
