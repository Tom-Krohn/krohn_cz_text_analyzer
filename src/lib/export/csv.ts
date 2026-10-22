const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function toCsvCell(value: string | null | undefined): string {
	const text = value ?? "";
	const safe = FORMULA_PREFIX.test(text) ? `'${text}` : text;
	return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: Array<Array<string | null | undefined>>): string {
	return [header, ...rows].map((row) => row.map(toCsvCell).join(",")).join("\r\n") + "\r\n";
}
