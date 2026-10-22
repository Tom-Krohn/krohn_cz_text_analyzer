"use client";

import type { ReactNode } from "react";

type OpenProjectFormButtonProps = {
	className: string;
	children: ReactNode;
};

export function OpenProjectFormButton({ children, className }: OpenProjectFormButtonProps) {
	function openProjectForm() {
		const projectDetails = document.getElementById("new-project");
		if (!(projectDetails instanceof HTMLDetailsElement)) {
			throw new Error("The new project form section is unavailable.");
		}

		projectDetails.open = true;
		projectDetails.scrollIntoView({ behavior: "smooth", block: "start" });
		projectDetails.querySelector("summary")?.focus({ preventScroll: true });
	}

	return (
		<button className={className} type="button" onClick={openProjectForm}>
			{children}
		</button>
	);
}
