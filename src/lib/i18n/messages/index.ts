import type { Locale } from "../types";
import cs from "./cs";
import en from "./en";
import type { UiMessages } from "./types";

export type { UiMessages } from "./types";

const catalogs: Record<Locale, UiMessages> = { cs, en };

export function getMessages(locale: Locale): UiMessages {
	return catalogs[locale];
}
