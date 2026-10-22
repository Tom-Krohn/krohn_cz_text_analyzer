"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UiMessages } from "@/lib/i18n/messages";

const linkClass =
	"flex min-h-10 min-w-max items-center rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-[background-color,color,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:w-full";
const activeClass = "bg-accent/15 text-foreground ring-1 ring-inset ring-accent/30";
const inactiveClass = "text-muted hover:bg-surface-raised hover:text-foreground";

export default function AdminNavigation({ messages }: { messages: UiMessages["navigation"] }) {
	const pathname = usePathname();
	const projectsActive = pathname === "/admin" || pathname.startsWith("/admin/projects/");
	const projectId = pathname.match(/^\/admin\/projects\/([^/]+)/)?.[1];
	const operationsHref = projectId
		? `/admin/operations?projectId=${encodeURIComponent(projectId)}`
		: "/admin/operations";
	const operationsActive = pathname.startsWith("/admin/operations");
	const auditActive = pathname.startsWith("/admin/ai-audit");
	const auditHref = projectId ? `/admin/ai-audit?projectId=${encodeURIComponent(projectId)}` : "/admin/ai-audit";
	const settingsActive = pathname.startsWith("/admin/settings");

	return (
		<nav aria-label={messages.label} className="mt-5 flex gap-2 overflow-x-auto lg:flex-col">
			<Link
				href="/admin"
				aria-current={projectsActive ? "page" : undefined}
				className={`${linkClass} ${projectsActive ? activeClass : inactiveClass}`}
			>
				{messages.projects}
			</Link>
			<Link
				href={operationsHref}
				aria-current={operationsActive ? "page" : undefined}
				className={`${linkClass} ${operationsActive ? activeClass : inactiveClass}`}
			>
				{messages.operations}
			</Link>
			<Link
				href={auditHref}
				aria-current={auditActive ? "page" : undefined}
				className={`${linkClass} ${auditActive ? activeClass : inactiveClass}`}
			>
				{messages.audit}
			</Link>
			<Link
				href="/admin/settings"
				aria-current={settingsActive ? "page" : undefined}
				className={`${linkClass} ${settingsActive ? activeClass : inactiveClass}`}
			>
				{messages.settings}
			</Link>
		</nav>
	);
}
