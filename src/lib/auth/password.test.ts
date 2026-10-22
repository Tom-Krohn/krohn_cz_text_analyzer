import { describe, expect, it } from "vite-plus/test";
import { selectFieldsForProposal } from "../ai/assessment";
import { hashPassword, verifyPassword } from "./password";

describe("hash hesla", () => {
	it("ověří správné heslo a odmítne špatné", () => {
		const stored = hashPassword("dlouhe-heslo-123");
		expect(verifyPassword("dlouhe-heslo-123", stored)).toBe(true);
		expect(verifyPassword("jine-heslo", stored)).toBe(false);
	});

	it("odmítne neznámý formát uloženého hashe", () => {
		expect(verifyPassword("heslo", "plain-text")).toBe(false);
	});
});

describe("výběr polí pro návrh", () => {
	it("vybere pouze nalezená pole pod hranicí", () => {
		const fields = [
			{ field: "seo_title", extraction: "found" as const, score: 69 },
			{ field: "meta_description", extraction: "found" as const, score: 70 },
			{ field: "h1", extraction: "uncertain" as const, score: 10 },
			{ field: "long_description", extraction: "missing" as const, score: null },
		];
		expect(selectFieldsForProposal(fields, 70)).toEqual(["seo_title"]);
	});
});
