"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
	ANALYSIS_PROGRESS_ESTIMATE_MS,
	estimateAnalysisProgressPercent,
	formatElapsedAnalysisTime,
	MAX_ANALYSIS_PROGRESS_PERCENT,
} from "@/lib/ai/analysis-progress";
import { interpolate } from "@/lib/i18n/format";
import type { UiMessages } from "@/lib/i18n/messages";

type AnalyzePageSubmitButtonProps = {
	className: string;
	disabled: boolean;
	messages: UiMessages["analysisButton"];
};

const PROGRESS_UPDATE_INTERVAL_MS = 1_000;

export function AnalyzePageSubmitButton({ className, disabled, messages }: AnalyzePageSubmitButtonProps) {
	const { pending } = useFormStatus();
	const [elapsedMilliseconds, setElapsedMilliseconds] = useState(0);

	useEffect(() => {
		if (!pending) return;
		const startedAt = performance.now();
		const timer = window.setInterval(
			() => setElapsedMilliseconds(performance.now() - startedAt),
			PROGRESS_UPDATE_INTERVAL_MS,
		);
		return () => window.clearInterval(timer);
	}, [pending]);

	const progressPercent = estimateAnalysisProgressPercent(elapsedMilliseconds);

	return (
		<div className="flex flex-col items-start gap-2">
			<button
				aria-busy={pending}
				className={`${className} gap-2`}
				disabled={disabled || pending}
				onClick={() => setElapsedMilliseconds(0)}
				type="submit"
			>
				{pending ? (
					<>
						<span
							aria-hidden="true"
							className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
						/>
						{messages.pending}
					</>
				) : (
					messages.start
				)}
			</button>
			{pending ? (
				<div className="w-full max-w-md space-y-2">
					<div className="flex items-center justify-between gap-3 text-sm">
						<span className="text-muted">{messages.progress}</span>
						<span className="font-semibold tabular-nums">{progressPercent}%</span>
					</div>
					<div
						aria-label={messages.aria}
						aria-valuemax={100}
						aria-valuemin={0}
						aria-valuenow={progressPercent}
						aria-valuetext={interpolate(messages.percent, { percent: progressPercent })}
						className="h-2.5 w-full overflow-hidden rounded-full bg-surface-raised"
						role="progressbar"
					>
						<div
							aria-hidden="true"
							className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear"
							style={{ width: `${progressPercent}%` }}
						/>
					</div>
					<p className="text-sm text-muted" role="status">
						{messages.status}
					</p>
					<p aria-live="off" className="text-xs text-muted">
						{interpolate(messages.elapsed, { time: formatElapsedAnalysisTime(elapsedMilliseconds) })}{" "}
						{elapsedMilliseconds >= ANALYSIS_PROGRESS_ESTIMATE_MS
							? interpolate(messages.stopAtEstimate, { percent: MAX_ANALYSIS_PROGRESS_PERCENT })
							: interpolate(messages.stopAfterMinute, { percent: MAX_ANALYSIS_PROGRESS_PERCENT })}
					</p>
				</div>
			) : null}
		</div>
	);
}
