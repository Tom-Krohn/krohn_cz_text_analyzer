type EstimateRemainingMillisecondsInput = {
	completed: number;
	startedAt: Date;
	total: number;
	now?: Date;
};

export function estimateRemainingMilliseconds({
	completed,
	now = new Date(),
	startedAt,
	total,
}: EstimateRemainingMillisecondsInput): number | null {
	if (total <= 0 || completed <= 0 || completed >= total) return null;

	const elapsedMilliseconds = now.getTime() - startedAt.getTime();
	if (!Number.isFinite(elapsedMilliseconds) || elapsedMilliseconds <= 0) return null;

	const estimate = (elapsedMilliseconds / completed) * (total - completed);
	return Number.isFinite(estimate) && estimate > 0 ? Math.ceil(estimate) : null;
}

export function formatEstimatedDuration(milliseconds: number): string {
	if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
		throw new RangeError("Doba odhadu musí být kladné konečné číslo.");
	}

	const totalMinutes = Math.max(1, Math.ceil(milliseconds / 60_000));
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;

	if (hours === 0) return `${totalMinutes} min`;
	return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}
