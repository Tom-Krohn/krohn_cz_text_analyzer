"use client";

import { useFormStatus } from "react-dom";
import { interpolate } from "@/lib/i18n/format";
import type { UiMessages } from "@/lib/i18n/messages";

const DELETE_PROJECT_BUTTON_CLASS =
	"inline-flex min-h-10 items-center justify-center rounded-lg border border-rose-700/35 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 transition-colors hover:bg-rose-100 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-200 dark:hover:bg-rose-400/20 dark:focus-visible:outline-rose-300";

export function DeleteProjectButton({
	projectName,
	messages,
}: {
	projectName: string;
	messages: UiMessages["project"];
}) {
	const { pending } = useFormStatus();

	return (
		<button
			aria-busy={pending}
			className={DELETE_PROJECT_BUTTON_CLASS}
			disabled={pending}
			onClick={(event) => {
				const message = interpolate(messages.deleteConfirmation, { name: projectName });
				if (!window.confirm(message)) event.preventDefault();
			}}
			type="submit"
		>
			{pending ? messages.deletePending : messages.delete}
		</button>
	);
}
