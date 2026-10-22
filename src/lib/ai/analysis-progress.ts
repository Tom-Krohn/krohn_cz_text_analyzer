export const ANALYSIS_PROGRESS_ESTIMATE_MS = 60_000;
export const MAX_ANALYSIS_PROGRESS_PERCENT = 90;

export function estimateAnalysisProgressPercent(elapsedMilliseconds: number): number {
	const elapsedPercent = Math.floor(
		(elapsedMilliseconds / ANALYSIS_PROGRESS_ESTIMATE_MS) * MAX_ANALYSIS_PROGRESS_PERCENT,
	);
	return Math.max(0, Math.min(MAX_ANALYSIS_PROGRESS_PERCENT, elapsedPercent));
}

export function formatElapsedAnalysisTime(elapsedMilliseconds: number): string {
	const totalSeconds = Math.max(0, Math.floor(elapsedMilliseconds / 1_000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;

	if (minutes === 0) return `${seconds} s`;
	return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`;
}
