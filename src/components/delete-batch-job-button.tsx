"use client";

import { useFormStatus } from "react-dom";
import type { UiMessages } from "@/lib/i18n/messages";

export function DeleteBatchJobButton({ className, messages }: { className: string; messages: UiMessages["jobs"] }) {
	const { pending } = useFormStatus();

	return (
		<button
			aria-busy={pending}
			className={className}
			disabled={pending}
			onClick={(event) => {
				if (!window.confirm(messages.deleteConfirmation)) event.preventDefault();
			}}
			type="submit"
		>
			{pending ? messages.removing : messages.removeFromHistory}
		</button>
	);
}
