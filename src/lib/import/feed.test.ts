import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vite-plus/test";
import { MAX_PROJECT_URLS, decodeFeedBytes, parseFeedXml, planImport } from "./feed";

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
	<url><loc>https://shop.example.cz/produkt-1</loc></url>
	<url><loc>https://shop.example.cz/produkt-2</loc></url>
</urlset>`;

const heureka = `<?xml version="1.0" encoding="utf-8"?>
<SHOP>
	<SHOPITEM><ITEM_ID>1</ITEM_ID><URL>https://shop.example.cz/a</URL></SHOPITEM>
	<SHOPITEM><ITEM_ID>2</ITEM_ID><URL>https://shop.example.cz/b</URL></SHOPITEM>
</SHOP>`;

describe("parseFeedXml", () => {
	it("načte URL z běžné sitemapy", () => {
		expect(parseFeedXml(sitemap, "sitemap").urls).toEqual([
			"https://shop.example.cz/produkt-1",
			"https://shop.example.cz/produkt-2",
		]);
	});

	it("vrátí podřízené sitemapy ze sitemap indexu", () => {
		const index = `<sitemapindex><sitemap><loc>https://shop.example.cz/s1.xml</loc></sitemap></sitemapindex>`;
		expect(parseFeedXml(index, "sitemap")).toEqual({ urls: [], sitemapIndexUrls: ["https://shop.example.cz/s1.xml"] });
	});

	it("načte URL z produktového feedu Heureka", () => {
		expect(parseFeedXml(heureka, "heureka").urls).toEqual(["https://shop.example.cz/a", "https://shop.example.cz/b"]);
	});

	it("odmítne DTD a entity", () => {
		const malicious = `<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><urlset></urlset>`;
		expect(() => parseFeedXml(malicious, "sitemap")).toThrow("DTD");
	});

	it("odmítne neznámý formát sitemapy", () => {
		expect(() => parseFeedXml("<html></html>", "sitemap")).toThrow("podporovaná sitemapa");
	});
});

describe("decodeFeedBytes", () => {
	it("rozbalí gzip a respektuje limit výstupu", () => {
		const packed = gzipSync(sitemap);
		expect(decodeFeedBytes(packed, 10_000)).toBe(sitemap);
		expect(() => decodeFeedBytes(packed, 10)).toThrow();
	});
});

describe("planImport", () => {
	const allowedHosts = ["shop.example.cz"];

	it("rozdělí kandidáty podle důvodu vyřazení", () => {
		const plan = planImport({
			candidates: [
				"https://shop.example.cz/a#fragment",
				"https://shop.example.cz/a",
				"https://shop.example.cz/b",
				"https://cizi.example.com/c",
				"neplatna adresa",
				"https://www.shop.example.cz/d",
			],
			allowedHosts,
			existingUrls: new Set(["https://shop.example.cz/b"]),
		});
		expect(plan).toEqual({
			toInsert: ["https://shop.example.cz/a", "https://www.shop.example.cz/d"],
			alreadyKnown: 1,
			invalid: 1,
			outsideAllowedHosts: 1,
			duplicatesInFeed: 1,
			overLimit: 0,
		});
	});

	it("nepřidá více URL než povolený limit projektu", () => {
		const existing = new Set(
			Array.from({ length: MAX_PROJECT_URLS - 1 }, (_, index) => `https://shop.example.cz/old-${index}`),
		);
		const plan = planImport({
			candidates: ["https://shop.example.cz/new-1", "https://shop.example.cz/new-2"],
			allowedHosts,
			existingUrls: existing,
		});
		expect(plan.toInsert).toEqual(["https://shop.example.cz/new-1"]);
		expect(plan.overLimit).toBe(1);
	});
});
