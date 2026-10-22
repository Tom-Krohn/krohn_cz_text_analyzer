import { describe, expect, it } from "vite-plus/test";
import { estimateRemainingMilliseconds, formatEstimatedDuration } from "./estimate";

describe("estimateRemainingMilliseconds", () => {
	it("odhadne zbývající dobu podle dosavadního tempa", () => {
		const startedAt = new Date("2026-10-16T13:00:00.000Z");
		const now = new Date("2026-10-16T13:10:00.000Z");

		expect(estimateRemainingMilliseconds({ completed: 20, now, startedAt, total: 100 })).toBe(40 * 60_000);
	});

	it("neodhaduje dobu bez průběhu, po dokončení ani bez uplynulého času", () => {
		const startedAt = new Date("2026-10-16T13:00:00.000Z");
		const now = new Date("2026-10-16T13:10:00.000Z");

		expect(estimateRemainingMilliseconds({ completed: 0, now, startedAt, total: 100 })).toBeNull();
		expect(estimateRemainingMilliseconds({ completed: 100, now, startedAt, total: 100 })).toBeNull();
		expect(estimateRemainingMilliseconds({ completed: 1, now: startedAt, startedAt, total: 100 })).toBeNull();
	});
});

describe("formatEstimatedDuration", () => {
	it("zobrazí délku v minutách a hodinách", () => {
		expect(formatEstimatedDuration(59_000)).toBe("1 min");
		expect(formatEstimatedDuration(60 * 60_000)).toBe("1 h");
		expect(formatEstimatedDuration(90 * 60_000)).toBe("1 h 30 min");
	});
});
