import { lookup as dnsLookup } from "node:dns";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch, type Response as UndiciResponse } from "undici";

const BLOCKED_IPV4_RANGES: Array<[string, number]> = [
	["0.0.0.0", 8],
	["10.0.0.0", 8],
	["100.64.0.0", 10],
	["127.0.0.0", 8],
	["169.254.0.0", 16],
	["172.16.0.0", 12],
	["192.0.0.0", 24],
	["192.0.2.0", 24],
	["192.168.0.0", 16],
	["198.18.0.0", 15],
	["198.51.100.0", 24],
	["203.0.113.0", 24],
	["224.0.0.0", 4],
	["240.0.0.0", 4],
];

function ipv4ToInt(address: string): number {
	return address.split(".").reduce((total, octet) => (total << 8) + Number(octet), 0) >>> 0;
}

function isInIpv4Range(address: string, [base, prefix]: [string, number]): boolean {
	const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
	return (ipv4ToInt(address) & mask) === (ipv4ToInt(base) & mask);
}

function expandIpv6(address: string): number[] | null {
	let normalized = address;
	const lastColon = normalized.lastIndexOf(":");
	const tail = normalized.slice(lastColon + 1);
	if (tail.includes(".")) {
		const octets = tail.split(".").map(Number);
		const high = ((octets[0] << 8) | octets[1]).toString(16);
		const low = ((octets[2] << 8) | octets[3]).toString(16);
		normalized = `${normalized.slice(0, lastColon + 1)}${high}:${low}`;
	}
	const [head, rest] = normalized.split("::");
	const headGroups = head ? head.split(":") : [];
	const restGroups = rest ? rest.split(":") : [];
	const missing = 8 - headGroups.length - restGroups.length;
	if (rest === undefined ? headGroups.length !== 8 : missing < 0) return null;
	const groups = [...headGroups, ...Array(rest === undefined ? 0 : missing).fill("0"), ...restGroups];
	const numbers = groups.map((group) => Number.parseInt(group, 16));
	return numbers.every((value) => Number.isInteger(value) && value >= 0 && value <= 0xffff) ? numbers : null;
}

function isPublicIpv4(address: string): boolean {
	return !BLOCKED_IPV4_RANGES.some((range) => isInIpv4Range(address, range));
}

function isPublicIpv6(address: string): boolean {
	const groups = expandIpv6(address);
	if (!groups) return false;
	const isMappedIpv4 = groups.slice(0, 5).every((value) => value === 0) && groups[5] === 0xffff;
	if (isMappedIpv4) {
		const ipv4 = [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join(".");
		return isPublicIpv4(ipv4);
	}
	const isUnspecifiedOrLoopback = groups.slice(0, 7).every((value) => value === 0) && groups[7] <= 1;
	const isUniqueLocal = (groups[0] & 0xfe00) === 0xfc00;
	const isLinkLocal = (groups[0] & 0xffc0) === 0xfe80;
	const isMulticast = (groups[0] & 0xff00) === 0xff00;
	const isDocumentation = groups[0] === 0x2001 && groups[1] === 0x0db8;
	return !(isUnspecifiedOrLoopback || isUniqueLocal || isLinkLocal || isMulticast || isDocumentation);
}

export function isPublicIpAddress(address: string): boolean {
	const family = isIP(address);
	if (family === 4) return isPublicIpv4(address);
	if (family === 6) return isPublicIpv6(address);
	return false;
}

type ResolvedAddress = { address: string; family: number };

function resolvePublicAddresses(hostname: string): Promise<ResolvedAddress[]> {
	return new Promise((resolve, reject) => {
		dnsLookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
			if (error) return reject(error);
			const publicAddresses = addresses.filter((entry) => isPublicIpAddress(entry.address));
			if (publicAddresses.length === 0 || publicAddresses.length !== addresses.length) {
				return reject(new Error(`Adresa ${hostname} nevede na veřejnou IP adresu.`));
			}
			resolve(publicAddresses);
		});
	});
}

function createPinnedAgent() {
	return new Agent({
		connect: {
			lookup: (hostname, options, callback) => {
				resolvePublicAddresses(hostname).then(
					(addresses) => {
						if (options.all) return callback(null, addresses);
						const [first] = addresses;
						callback(null, first.address, first.family);
					},
					(error: Error) => callback(error, "", 0),
				);
			},
		},
	});
}

export type PublicFetchResult = {
	status: number;
	finalUrl: string;
	contentType: string;
	body: Buffer;
	truncated: boolean;
};

export type PublicFetchOptions = {
	maxBytes: number;
	timeoutMs: number;
	maxRedirects?: number;
	userAgent?: string;
	acceptedHosts?: (hostname: string) => boolean;
};

export async function fetchPublicUrl(startUrl: string, options: PublicFetchOptions): Promise<PublicFetchResult> {
	const maxRedirects = options.maxRedirects ?? 5;
	const agent = createPinnedAgent();
	try {
		let currentUrl = new URL(startUrl);
		for (let hop = 0; hop <= maxRedirects; hop += 1) {
			if (!["http:", "https:"].includes(currentUrl.protocol)) throw new Error("Nepodporované schéma URL.");
			if (options.acceptedHosts && !options.acceptedHosts(currentUrl.hostname)) {
				throw new Error("Doména není povolena pro tento projekt.");
			}
			const response = await undiciFetch(currentUrl, {
				dispatcher: agent,
				redirect: "manual",
				signal: AbortSignal.timeout(options.timeoutMs),
				headers: {
					"user-agent": options.userAgent ?? "KrohnLabsTextAnalyzer/1.0",
					accept: "text/html,application/xml,text/xml,*/*;q=0.5",
				},
			});
			const location = response.headers.get("location");
			if (response.status >= 300 && response.status < 400 && location) {
				await response.body?.cancel();
				currentUrl = new URL(location, currentUrl);
				continue;
			}
			const { body, truncated } = await readLimited(response, options.maxBytes);
			return {
				status: response.status,
				finalUrl: currentUrl.toString(),
				contentType: response.headers.get("content-type") ?? "",
				body,
				truncated,
			};
		}
		throw new Error("Příliš mnoho přesměrování.");
	} finally {
		await agent.close();
	}
}

async function readLimited(response: UndiciResponse, maxBytes: number): Promise<{ body: Buffer; truncated: boolean }> {
	if (!response.body) return { body: Buffer.alloc(0), truncated: false };
	const chunks: Buffer[] = [];
	let total = 0;
	const reader = response.body.getReader();
	while (total < maxBytes) {
		const { done, value } = await reader.read();
		if (done) return { body: Buffer.concat(chunks), truncated: false };
		const chunk = Buffer.from(value.subarray(0, maxBytes - total));
		chunks.push(chunk);
		total += chunk.length;
	}
	await reader.cancel();
	return { body: Buffer.concat(chunks), truncated: true };
}
