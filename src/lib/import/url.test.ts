import { describe, expect, it } from "vite-plus/test";
import { isHostAllowed, normalizeUrl } from "./url";

describe("normalizeUrl", () => {
	it("odstraní fragment, přihlašovací údaje a výchozí port", () => {
		expect(normalizeUrl("https://user:pass@Shop.Example.cz:443/produkt?id=7#sekce")).toBe(
			"https://shop.example.cz/produkt?id=7",
		);
	});

	it("zachová query parametry a cestu", () => {
		expect(normalizeUrl("https://shop.example.cz/a?variant=red&utm_source=feed")).toBe(
			"https://shop.example.cz/a?variant=red&utm_source=feed",
		);
	});

	it("odmítne jiná schémata a nesmyslné řetězce", () => {
		expect(normalizeUrl("javascript:alert(1)")).toBeNull();
		expect(normalizeUrl("ftp://shop.example.cz/a")).toBeNull();
		expect(normalizeUrl("nejde o url")).toBeNull();
	});
});

describe("isHostAllowed", () => {
	it("povolí přesnou doménu a subdomény, ale ne podobně znějící hostitele", () => {
		const allowed = ["example.cz"];
		expect(isHostAllowed("example.cz", allowed)).toBe(true);
		expect(isHostAllowed("www.example.cz", allowed)).toBe(true);
		expect(isHostAllowed("badexample.cz", allowed)).toBe(false);
		expect(isHostAllowed("example.cz.evil.com", allowed)).toBe(false);
	});
});
