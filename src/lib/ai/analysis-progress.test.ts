import { describe, expect, it } from "vite-plus/test";
import {
	ANALYSIS_PROGRESS_ESTIMATE_MS,
	estimateAnalysisProgressPercent,
	formatElapsedAnalysisTime,
	MAX_ANALYSIS_PROGRESS_PERCENT,
} from "./analysis-progress";

describe("estimateAnalysisProgressPercent", () => {
	it("odhadne průběh podle času a zastaví se na 90 %", () => {
		expect(estimateAnalysisProgressPercent(0)).toBe(0);
		expect(estimateAnalysisProgressPercent(30_000)).toBe(45);
		expect(estimateAnalysisProgressPercent(ANALYSIS_PROGRESS_ESTIMATE_MS)).toBe(MAX_ANALYSIS_PROGRESS_PERCENT);
		expect(estimateAnalysisProgressPercent(ANALYSIS_PROGRESS_ESTIMATE_MS * 2)).toBe(MAX_ANALYSIS_PROGRESS_PERCENT);
	});
});

describe("formatElapsedAnalysisTime", () => {
	it("zobrazí uplynulý čas v sekundách a minutách", () => {
		expect(formatElapsedAnalysisTime(59_000)).toBe("59 s");
		expect(formatElapsedAnalysisTime(60_000)).toBe("1 min");
		expect(formatElapsedAnalysisTime(90_000)).toBe("1 min 30 s");
	});
});
