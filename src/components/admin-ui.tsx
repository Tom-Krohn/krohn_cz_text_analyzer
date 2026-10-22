export { fieldClass, inputClass } from "./admin-ui-classes";

export const primaryButtonClass =
	"inline-flex min-h-10 items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-accent/15 transition-[background-color,box-shadow,transform] duration-200 hover:bg-accent-button-hover active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
	"inline-flex min-h-10 items-center justify-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-foreground transition-[background-color,border-color,transform] duration-200 hover:border-muted/50 hover:bg-surface-raised active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";

export function Notice({ searchParams }: { searchParams: { notice?: string; error?: string } }) {
	const message = searchParams.error ?? searchParams.notice;
	if (!message) return null;
	const isError = Boolean(searchParams.error);
	return (
		<div
			role={isError ? "alert" : "status"}
			aria-live={isError ? "assertive" : "polite"}
			className={
				isError
					? "rounded-lg border border-rose-700/25 border-l-2 border-l-rose-700/70 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-300/25 dark:border-l-rose-300/70 dark:bg-rose-300/[0.06] dark:text-rose-100"
					: "rounded-lg border border-line border-l-2 border-l-accent bg-surface-raised px-4 py-3 text-sm text-foreground"
			}
		>
			{message}
		</div>
	);
}
