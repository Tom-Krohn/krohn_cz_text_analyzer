import { describe, expect, it } from "vite-plus/test";
import { parseAllowedHosts, projectInputSchema, toProjectValues } from "./input";

describe("parseAllowedHosts", () => {
	it("přijme domény oddělené čárkou nebo novým řádkem a převede URL na hostitele", () => {
		expect(parseAllowedHosts("Shop.example.cz,\nhttps://www.example.cz/katalog\nexample.cz")).toEqual([
			"shop.example.cz",
			"www.example.cz",
			"example.cz",
		]);
	});

	it("odmítne neplatnou doménu", () => {
		expect(() => parseAllowedHosts("neplatna_domena")).toThrow("Neplatná doména");
	});

	it("vrátí uživatelsky srozumitelnou chybu pro neplatnou URL domény", () => {
		expect(() => parseAllowedHosts("https://[")).toThrow("Neplatná doména: https://[");
	});
});

describe("projectInputSchema", () => {
	it("doplní výchozí práh 70 a odmítne práh mimo rozsah", () => {
		const parsed = projectInputSchema.parse({ name: "Eshop", allowedHostsText: "example.cz" });
		expect(parsed.qualityThreshold).toBe(70);
		expect(
			projectInputSchema.safeParse({ name: "Eshop", allowedHostsText: "example.cz", qualityThreshold: 101 }).success,
		).toBe(false);
	});

	it("uloží pouze vyplněné selektory", () => {
		const input = projectInputSchema.parse({
			name: "Eshop",
			allowedHostsText: "example.cz",
			longDescriptionSelector: ".popis",
		});
		expect(toProjectValues(input).selectors).toEqual({ long_description: ".popis" });
	});

	it("uloží kořen obsahu a seznam vylučovacích selektorů", () => {
		const input = projectInputSchema.parse({
			name: "Eshop",
			allowedHostsText: "example.cz",
			mainContentSelector: " main#content ",
			shortDescriptionSelector: ".kratky",
			excludedSelectorsText: "\nheader\nfooter, .promo\n",
		});

		expect(toProjectValues(input).selectors).toEqual({
			main_content: "main#content",
			short_description: ".kratky",
			exclude: ["header", "footer, .promo"],
		});
	});

	it("odmítne syntakticky neplatný CSS selektor", () => {
		const input = projectInputSchema.parse({
			name: "Eshop",
			allowedHostsText: "example.cz",
			mainContentSelector: "main[",
		});

		expect(() => toProjectValues(input)).toThrow("Neplatný CSS selektor");
	});
});
