import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vite-plus/test";
import { decryptSecret, encryptSecret } from "./crypto";

describe("šifrování tajemství", () => {
	const key = randomBytes(32);

	it("obnoví původní hodnotu a nezapisuje ji v čitelné podobě", () => {
		const encrypted = encryptSecret("sk-test-123", key);
		expect(encrypted).not.toContain("sk-test-123");
		expect(decryptSecret(encrypted, key)).toBe("sk-test-123");
	});

	it("odmítne změněný šifrovaný obsah", () => {
		const [iv, tag, data] = encryptSecret("tajemstvi", key).split(".");
		const tampered = [iv, tag, data.slice(0, -2) + "AA"].join(".");
		expect(() => decryptSecret(tampered, key)).toThrow();
	});
});
