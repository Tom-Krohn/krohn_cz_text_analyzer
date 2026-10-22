import type { Locale } from "./types";

export function intlLocale(locale: Locale): string {
	return locale === "cs" ? "cs-CZ" : "en-US";
}

export function formatDateTime(date: Date, locale: Locale): string {
	return date.toLocaleString(intlLocale(locale));
}

export function interpolate(message: string, values: Record<string, string | number>): string {
	return message.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
		Object.hasOwn(values, key) ? String(values[key]) : placeholder,
	);
}

export function messageFor(messages: object, key: string): string | undefined {
	const message = Reflect.get(messages, key);
	return typeof message === "string" ? message : undefined;
}
