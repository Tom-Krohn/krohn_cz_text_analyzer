export function normalizeUrl(rawUrl: string): string | null {
	let url: URL;
	try {
		url = new URL(rawUrl.trim());
	} catch {
		return null;
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") return null;
	url.username = "";
	url.password = "";
	url.hash = "";
	const isDefaultPort =
		(url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443");
	if (isDefaultPort) url.port = "";
	return url.toString();
}

export function isHostAllowed(hostname: string, allowedHosts: string[]): boolean {
	const normalizedHost = hostname.toLowerCase();
	return allowedHosts.some((allowed) => {
		const normalizedAllowed = allowed.toLowerCase();
		return normalizedHost === normalizedAllowed || normalizedHost.endsWith(`.${normalizedAllowed}`);
	});
}
