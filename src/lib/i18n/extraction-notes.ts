import type { UiMessages } from "./messages";

const noteKeys: Record<string, keyof UiMessages["pageDetail"]["extractionNotes"]> = {
	"Element <title> chybí.": "titleMissing",
	"Meta description chybí.": "metaDescriptionMissing",
	"Selektor hlavního obsahu nenašel žádný prvek; pole vyžaduje kontrolu.": "mainSelectorMissing",
	"Hlavní obsah nebyl bezpečně vymezen; pole vyžaduje kontrolu.": "mainContentUncertain",
	"Nadpis H1 v hlavním obsahu chybí.": "h1Missing",
	"Chybí CSS selektor; pole vyžaduje kontrolu.": "cssSelectorMissing",
	"Selektor nenašel text; pole vyžaduje kontrolu.": "selectorTextMissing",
	"Hlavní obsah je krátký nebo nejasný.": "mainContentUnclear",
};

export function localizeExtractionNote(note: string | null, messages: UiMessages): string | null {
	if (!note) return note;
	const key = noteKeys[note];
	return key ? messages.pageDetail.extractionNotes[key] : note;
}
