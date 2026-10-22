import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { loginAttempts } from "@/lib/db/schema";

export const ADMIN_LOGIN_KEY = "admin";
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

export async function isLoginLocked(key: string, now = new Date()): Promise<boolean> {
	const [row] = await getDb()
		.select({ lockedUntil: loginAttempts.lockedUntil })
		.from(loginAttempts)
		.where(eq(loginAttempts.key, key))
		.limit(1);
	return Boolean(row?.lockedUntil && row.lockedUntil > now);
}

export async function recordLoginFailure(key: string, now = new Date()): Promise<void> {
	const db = getDb();
	const [row] = await db
		.insert(loginAttempts)
		.values({ key, failures: 1 })
		.onConflictDoUpdate({
			target: loginAttempts.key,
			set: { failures: sql`${loginAttempts.failures} + 1`, updatedAt: now },
		})
		.returning({ failures: loginAttempts.failures });
	if (row.failures >= MAX_FAILURES) {
		await db
			.update(loginAttempts)
			.set({ failures: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000), updatedAt: now })
			.where(eq(loginAttempts.key, key));
	}
}

export async function resetLoginFailures(key: string): Promise<void> {
	await getDb().delete(loginAttempts).where(eq(loginAttempts.key, key));
}
