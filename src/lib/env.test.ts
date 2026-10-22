import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const validEnv = {
	DATABASE_URL: "postgresql://user:pass@host/db",
	AUTH_SECRET: "x".repeat(32),
	ADMIN_EMAIL: "admin@example.com",
	ADMIN_PASSWORD_HASH: "hash",
	APP_ENCRYPTION_KEY: "key",
};

describe("getServerEnv", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	it("vrátí validované proměnné prostředí", async () => {
		for (const [key, value] of Object.entries(validEnv)) vi.stubEnv(key, value);
		const { getServerEnv } = await import("./env");
		expect(getServerEnv().ADMIN_EMAIL).toBe("admin@example.com");
	});

	it("selže při chybějící databázové adrese", async () => {
		for (const [key, value] of Object.entries(validEnv)) vi.stubEnv(key, value);
		vi.stubEnv("DATABASE_URL", "");
		const { getServerEnv } = await import("./env");
		expect(() => getServerEnv()).toThrow();
	});
});
