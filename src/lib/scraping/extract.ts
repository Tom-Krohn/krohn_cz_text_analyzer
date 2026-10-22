import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { ProjectSelectors } from "@/lib/projects/selectors";

export const FIELD_NAMES = [
	"seo_title",
	"meta_description",
	"h1",
	"short_description",
	"long_description",
	"body",
] as const;

export type FieldName = (typeof FIELD_NAMES)[number];
export type ExtractionState = "found" | "missing" | "uncertain";
export type FieldSelectors = ProjectSelectors;

export type ExtractedField = {
	field: FieldName;
	text: string;
	extraction: ExtractionState;
	note: string | null;
};

const MIN_BODY_LENGTH = 200;

export function hashText(text: string): string {
	return createHash("sha256").update(text, "utf8").digest("hex");
}

export function detectPageKind(html: string): "product" | "page" {
	const $ = cheerio.load(html);
	const jsonLd = $('script[type="application/ld+json"]')
		.map((_, element) => $(element).text())
		.get()
		.join(" ");
	const isProductJsonLd = /"@type"\s*:\s*"(Product|ItemPage)"/.test(jsonLd);
	const isProductOpenGraph = $('meta[property="og:type"]').attr("content") === "product";
	return isProductJsonLd || isProductOpenGraph ? "product" : "page";
}

function normalizeText(raw: string): string {
	return raw
		.split("\n")
		.map((line) => line.replace(/\s+/g, " ").trim())
		.filter(Boolean)
		.join("\n");
}

function headingLikeField(field: FieldName, text: string, missingNote: string): ExtractedField {
	return text
		? { field, text, extraction: "found", note: null }
		: { field, text: "", extraction: "missing", note: missingNote };
}

export function extractFields(html: string, selectors: ProjectSelectors = {}): ExtractedField[] {
	const $ = cheerio.load(html);
	$("script, style, noscript").remove();
	const fields: ExtractedField[] = [
		headingLikeField("seo_title", normalizeText($("title").first().text()), "Element <title> chybí."),
		headingLikeField(
			"meta_description",
			normalizeText($('meta[name="description"]').attr("content") ?? ""),
			"Meta description chybí.",
		),
	];

	const configuredMainContent = selectors.main_content?.trim();
	const semanticRoot = $("main, article, [role=main]").first();
	const selectedRoot = configuredMainContent
		? $(configuredMainContent).first()
		: semanticRoot.length > 0
			? semanticRoot
			: $("body");
	const contentRoot = selectedRoot.length > 0 ? selectedRoot.clone() : null;
	const reliableRoot = Boolean(contentRoot && (configuredMainContent || semanticRoot.length > 0));
	const rootNote =
		configuredMainContent && !contentRoot
			? "Selektor hlavního obsahu nenašel žádný prvek; pole vyžaduje kontrolu."
			: "Hlavní obsah nebyl bezpečně vymezen; pole vyžaduje kontrolu.";

	if (contentRoot) {
		for (const selector of selectors.exclude ?? []) contentRoot.find(selector).remove();
	}

	const h1Match = contentRoot ? (contentRoot.is("h1") ? contentRoot : contentRoot.find("h1").first()) : null;
	const h1Text = h1Match ? normalizeText(h1Match.text()) : "";
	fields.push(
		reliableRoot
			? headingLikeField("h1", h1Text, "Nadpis H1 v hlavním obsahu chybí.")
			: { field: "h1", text: h1Text, extraction: "uncertain", note: rootNote },
	);

	for (const field of ["short_description", "long_description"] as const) {
		const selector = selectors[field]?.trim();
		if (!selector) {
			fields.push({ field, text: "", extraction: "uncertain", note: "Chybí CSS selektor; pole vyžaduje kontrolu." });
			continue;
		}
		if (!contentRoot) {
			fields.push({ field, text: "", extraction: "uncertain", note: rootNote });
			continue;
		}
		const matched = contentRoot.is(selector) ? contentRoot : contentRoot.find(selector).first();
		const text = matched.length ? normalizeText(matched.text()) : "";
		fields.push(
			!reliableRoot
				? { field, text, extraction: "uncertain", note: rootNote }
				: text
					? { field, text, extraction: "found", note: null }
					: { field, text: "", extraction: "uncertain", note: "Selektor nenašel text; pole vyžaduje kontrolu." },
		);
	}

	const mainContent = contentRoot ? normalizeText(contentRoot.text()) : "";
	fields.push(
		!reliableRoot
			? { field: "body", text: mainContent, extraction: "uncertain", note: rootNote }
			: mainContent.length >= MIN_BODY_LENGTH
				? { field: "body", text: mainContent, extraction: "found", note: null }
				: { field: "body", text: mainContent, extraction: "uncertain", note: "Hlavní obsah je krátký nebo nejasný." },
	);

	return fields;
}
