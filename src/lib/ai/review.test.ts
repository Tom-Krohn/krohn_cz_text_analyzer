import { describe, expect, it } from "vite-plus/test";
import { buildReviewPrompt, parseReviewResponse } from "./review";

describe("parseReviewResponse", () => {
	it("přijme validní odpověď uzavřenou v markdown bloku", () => {
		const raw =
			'```json\n{"fields":[{"field":"seo_title","score":42,"issues":["Krátký"],"proposal":"Nový titulek","reason":"Doplněno"}]}\n```';
		expect(parseReviewResponse(raw)).toEqual([
			{ field: "seo_title", score: 42, issues: ["Krátký"], proposal: "Nový titulek", reason: "Doplněno" },
		]);
	});

	it("vyřadí neznámá pole", () => {
		expect(parseReviewResponse('{"fields":[{"field":"cokoli","score":10}]}')).toEqual([]);
	});

	it("odmítne skóre mimo rozsah a text, který není JSON", () => {
		expect(() => parseReviewResponse('{"fields":[{"field":"h1","score":140}]}')).toThrow();
		expect(() => parseReviewResponse("není json vůbec")).toThrow();
	});

	it("opraví chybějící úvodní uvozovku u klíče", () => {
		const raw =
			'{"fields":[{"field":"h1","score":90,"issues":[],"proposal":"","reason": "OK"}, {"field":"meta_description", reason": "Doplněno"}]}';
		const items = parseReviewResponse(raw);
		expect(items[0]).toMatchObject({ field: "h1", score: 90, proposal: null, reason: "OK" });
		expect(items[1]).toMatchObject({ field: "meta_description", reason: "Doplněno" });
	});

	it("přijme issues jako text a zkrátí příliš dlouhé texty místo odmítnutí odpovědi", () => {
		const raw = JSON.stringify({
			fields: [
				{ field: "seo_title", score: "40", issues: "Příliš dlouhý titulek.", proposal: "a".repeat(2500), reason: null },
			],
		});
		expect(parseReviewResponse(raw)).toEqual([
			{ field: "seo_title", score: 40, issues: ["Příliš dlouhý titulek."], proposal: "a".repeat(2000), reason: "" },
		]);
	});
});

describe("buildReviewPrompt", () => {
	it("obsahuje hranici kvality a zakazuje domýšlení tvrzení", () => {
		const prompt = buildReviewPrompt({
			pageUrl: "https://shop.example.cz/a",
			language: "cs",
			audience: "",
			tone: "",
			rules: "",
			threshold: 70,
			fields: [{ field: "h1", text: "Bota", extraction: "found" }],
		});
		expect(prompt.system).toContain("pod 70");
		expect(prompt.system).toContain("Nikdy nevymýšlej");
		expect(prompt.system).toContain("neuváděj skrytý chain-of-thought");
		expect(prompt.user).toContain('"""\nBota\n"""');
	});
});
