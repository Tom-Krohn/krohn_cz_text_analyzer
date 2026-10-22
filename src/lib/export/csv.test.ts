import { describe, expect, it } from "vite-plus/test";
import { toCsv, toCsvCell } from "./csv";

describe("toCsv", () => {
	it("escapuje uvozovky a zachová češtinu", () => {
		expect(toCsvCell('Bota "Trek" X')).toBe('"Bota ""Trek"" X"');
		expect(toCsv(["url", "text"], [["https://a.cz", "Žluťoučký"]])).toBe(
			'"url","text"\r\n"https://a.cz","Žluťoučký"\r\n',
		);
	});

	it("neutralizuje hodnoty začínající vzorcem", () => {
		expect(toCsvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
		expect(toCsvCell("+1")).toBe('"\'+1"');
	});

	it("vynechá null jako prázdnou buňku", () => {
		expect(toCsvCell(null)).toBe('""');
	});
});
