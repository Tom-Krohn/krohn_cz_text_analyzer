import { describe, expect, it } from "vite-plus/test";
import { extractFields, hashText } from "./extract";

const productPage = `<!doctype html><html><head>
<title>  Bota Trek   X  | Shop </title>
<meta name="description" content="Lehká treková bota">
</head><body><nav>Menu</nav><main><h1>Bota Trek X</h1>
<div class="short">Lehká bota pro hory.</div>
<div class="long"><p>Dlouhý popis.</p>
<p>Druhý odstavec.</p></div></main></body></html>`;

function byField(fields: ReturnType<typeof extractFields>, name: string) {
	const found = fields.find((field) => field.field === name);
	if (!found) throw new Error(`Chybí pole ${name}`);
	return found;
}

describe("extractFields", () => {
	it("načte titulek, meta description a H1 s normalizovanými mezerami", () => {
		const fields = extractFields(productPage);
		expect(byField(fields, "seo_title")).toMatchObject({ text: "Bota Trek X | Shop", extraction: "found" });
		expect(byField(fields, "meta_description")).toMatchObject({ text: "Lehká treková bota", extraction: "found" });
		expect(byField(fields, "h1")).toMatchObject({ text: "Bota Trek X", extraction: "found" });
	});

	it("rozlišuje skutečně chybějící pole a nejasnou extrakci", () => {
		const fields = extractFields("<html><body>Bez titulku</body></html>");
		expect(byField(fields, "seo_title").extraction).toBe("missing");
		expect(byField(fields, "short_description").extraction).toBe("uncertain");
	});

	it("použije projektové selektory a zachová odstavce", () => {
		const fields = extractFields(productPage, { short_description: ".short", long_description: ".long" });
		expect(byField(fields, "short_description")).toMatchObject({ text: "Lehká bota pro hory.", extraction: "found" });
		expect(byField(fields, "long_description").text).toBe("Dlouhý popis.\nDruhý odstavec.");
	});

	it("omezuje popisy a hlavní text na kořen a odstraňuje vyloučené prvky", () => {
		const page = `<html><body>
			<header>Společná hlavička</header>
			<div class="short">Propagační text mimo hlavní obsah</div>
			<main id="content">
				<h1>Bota Trek X</h1>
				<aside class="sidebar">Navigace a reklama</aside>
				<div class="short">Krátký popis produktu</div>
				<div class="long">${"Dlouhý popis produktu. ".repeat(12)}</div>
			</main>
			<footer>Společná patička</footer>
		</body></html>`;
		const fields = extractFields(page, {
			main_content: "#content",
			short_description: ".short",
			long_description: ".long",
			exclude: [".sidebar"],
		});

		expect(byField(fields, "short_description").text).toBe("Krátký popis produktu");
		expect(byField(fields, "long_description").text).toContain("Dlouhý popis produktu.");
		expect(byField(fields, "body").text).not.toContain("Společná hlavička");
		expect(byField(fields, "body").text).not.toContain("Společná patička");
		expect(byField(fields, "body").text).not.toContain("Navigace a reklama");
	});

	it("při chybějícím nastaveném kořeni nepadá zpět na celé tělo stránky", () => {
		const page = `<html><body><header>Hlavička</header><main><h1>Nadpis</h1><div class="short">Popis</div></main></body></html>`;
		const fields = extractFields(page, { main_content: "#missing", short_description: ".short" });

		expect(byField(fields, "h1")).toMatchObject({ text: "", extraction: "uncertain" });
		expect(byField(fields, "short_description")).toMatchObject({ text: "", extraction: "uncertain" });
		expect(byField(fields, "body")).toMatchObject({ text: "", extraction: "uncertain" });
	});

	it("označí extrakci z celého těla jako nejistou, pokud stránka nemá sémantický kořen", () => {
		const fields = extractFields(`<html><body><header>Menu</header>${"Obsah stránky. ".repeat(20)}</body></html>`);

		expect(byField(fields, "body").extraction).toBe("uncertain");
	});

	it("označí selektor, který nic nenašel, ke kontrole", () => {
		const fields = extractFields(productPage, { long_description: ".neexistuje" });
		expect(byField(fields, "long_description")).toMatchObject({ extraction: "uncertain" });
	});

	it("neobsahuje skripty ani styly v hlavním obsahu", () => {
		const page =
			"<html><body><script>var x = 1;</script><style>.a{}</style><main>Text bez skriptů.</main></body></html>";
		expect(byField(extractFields(page), "body").text).toBe("Text bez skriptů.");
	});
});

describe("hashText", () => {
	it("je deterministický a citlivý na změnu textu", () => {
		expect(hashText("a")).toBe(hashText("a"));
		expect(hashText("a")).not.toBe(hashText("b"));
	});
});
