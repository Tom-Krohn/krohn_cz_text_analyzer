import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

export function parseEncryptionKey(base64Key: string): Buffer {
	const key = Buffer.from(base64Key, "base64");
	if (key.length !== 32) throw new Error("Šifrovací klíč musí mít 32 bajtů zakódovaných v base64.");
	return key;
}

export function encryptSecret(plaintext: string, key: Buffer): string {
	const iv = randomBytes(IV_BYTES);
	const cipher = createCipheriv(ALGORITHM, key, iv);
	const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
	return [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64")).join(".");
}

export function decryptSecret(payload: string, key: Buffer): string {
	const [iv, authTag, data] = payload.split(".").map((part) => Buffer.from(part, "base64"));
	if (!iv || !authTag || !data || iv.length !== IV_BYTES) throw new Error("Neplatný šifrovaný obsah.");
	const decipher = createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);
	return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
