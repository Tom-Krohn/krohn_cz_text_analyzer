import { describe, expect, it } from "vite-plus/test";
import { getMessages } from "./messages";
import { localizeExtractionNote } from "./extraction-notes";

describe("localizeExtractionNote", () => {
	it("translates stored extraction diagnostics", () => {
		expect(localizeExtractionNote("Meta description chybí.", getMessages("en"))).toBe(
			"The meta description is missing.",
		);
	});

	it("preserves unknown or empty notes", () => {
		expect(localizeExtractionNote("Site-specific note", getMessages("en"))).toBe("Site-specific note");
		expect(localizeExtractionNote(null, getMessages("en"))).toBeNull();
	});
});
