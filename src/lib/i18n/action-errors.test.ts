import { describe, expect, it } from "vite-plus/test";
import { formatActionError, formatProjectInputIssue } from "./action-errors";
import { getMessages } from "./messages";

describe("formatActionError", () => {
	const messages = getMessages("en");

	it("localizes feed errors while preserving their URL and status", () => {
		expect(formatActionError(new Error("Feed https://example.com/feed.xml vrátil HTTP 503."), messages)).toBe(
			"Feed https://example.com/feed.xml returned HTTP 503.",
		);
	});

	it("localizes invalid selectors and their field names", () => {
		expect(formatActionError(new Error("Neplatný CSS selektor pro vylučovacího 2: [data-test"), messages)).toBe(
			"Invalid CSS selector for exclusion 2: [data-test",
		);
	});

	it("localizes the provider error label without hiding its diagnostic detail", () => {
		expect(formatActionError(new Error("Poskytovatel vrátil chybu: quota exceeded"), messages)).toBe(
			"The provider returned an error: quota exceeded",
		);
	});

	it("localizes project form validation errors", () => {
		expect(formatProjectInputIssue({ path: ["audience"], code: "too_big", message: "Too big" }, messages)).toBe(
			"The target audience can be up to 500 characters long.",
		);
		expect(
			formatProjectInputIssue({ path: ["qualityThreshold"], code: "invalid_type", message: "Invalid input" }, messages),
		).toBe("The quality threshold must be a whole number from 0 to 100.");
	});
});
