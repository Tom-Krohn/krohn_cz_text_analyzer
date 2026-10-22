import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

export function hashPassword(password: string): string {
	const salt = randomBytes(16);
	const hash = scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
	return [
		"scrypt",
		SCRYPT_OPTIONS.N,
		SCRYPT_OPTIONS.r,
		SCRYPT_OPTIONS.p,
		salt.toString("base64"),
		hash.toString("base64"),
	].join(":");
}

export function verifyPassword(password: string, stored: string): boolean {
	const [algorithm, cost, blockSize, parallelism, saltB64, hashB64] = stored.split(":");
	if (algorithm !== "scrypt" || !saltB64 || !hashB64) return false;
	const expected = Buffer.from(hashB64, "base64");
	const actual = scryptSync(password, Buffer.from(saltB64, "base64"), expected.length, {
		N: Number(cost),
		r: Number(blockSize),
		p: Number(parallelism),
		maxmem: 64 * 1024 * 1024,
	});
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}
