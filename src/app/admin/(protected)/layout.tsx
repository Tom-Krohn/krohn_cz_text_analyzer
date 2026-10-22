import Link from "next/link";
import { signOut } from "@/auth";
import { AccountPreferenceControls } from "@/components/account-preference-controls";
import { secondaryButtonClass } from "@/components/admin-ui";
import AdminNavigation from "@/components/admin-navigation";
import { requireAdmin } from "@/lib/auth/session";
import { getRequestI18n } from "@/lib/i18n/server";

export const instant = false;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
	const session = await requireAdmin();
	const { locale, theme, messages } = await getRequestI18n();
	const accountName = session.user?.email ?? messages.common.administrator;

	async function logout() {
		"use server";
		await signOut({ redirectTo: "/admin/login" });
	}

	return (
		<div className="min-h-[100dvh] bg-background text-foreground lg:flex">
			<a
				href="#main-content"
				className="sr-only fixed left-4 top-4 z-50 rounded-lg bg-accent px-4 py-2 font-semibold text-white shadow-lg focus:not-sr-only"
			>
				{messages.common.skipToContent}
			</a>
			<aside className="border-b border-line bg-sidebar px-4 py-4 lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:flex lg:w-[17rem] lg:flex-col lg:border-b-0 lg:border-r lg:px-6 lg:py-7">
				<Link
					href="/admin"
					className="flex items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
				>
					<span className="grid size-10 place-items-center rounded-xl bg-accent text-lg font-extrabold text-white shadow-md shadow-accent/15">
						K
					</span>
					<span>
						<span className="block text-sm font-bold tracking-tight">Krohn Labs</span>
						<span className="block text-xs tracking-wide text-muted">Text Analyzer</span>
					</span>
				</Link>
				<AdminNavigation messages={messages.navigation} />
				<div className="mt-5 flex flex-col gap-4 border-t border-line pt-4 lg:hidden">
					<div className="flex items-center gap-3">
						<span className="min-w-0 max-w-48 truncate text-xs text-muted">{accountName}</span>
						<form action={logout} className="ml-auto">
							<button className={`${secondaryButtonClass} min-h-9 px-3 py-1.5 text-xs`} type="submit">
								{messages.common.logout}
							</button>
						</form>
					</div>
					<AccountPreferenceControls locale={locale} theme={theme} messages={messages.common} />
				</div>
				<div className="mt-5 hidden border-t border-line pt-5 lg:mt-auto lg:block">
					<div className="flex items-center gap-3">
						<span
							aria-hidden="true"
							className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-raised text-xs font-semibold text-muted"
						>
							{session.user?.email?.slice(0, 1).toUpperCase() ?? accountName.slice(0, 1).toUpperCase()}
						</span>
						<div className="min-w-0">
							<p className="truncate text-sm font-semibold">{accountName}</p>
							<p className="mt-0.5 text-xs text-muted">{messages.common.workspaceRole}</p>
						</div>
					</div>
					<div className="mt-4">
						<AccountPreferenceControls locale={locale} theme={theme} messages={messages.common} />
					</div>
					<form action={logout} className="mt-4">
						<button className={`${secondaryButtonClass} w-full`} type="submit">
							{messages.common.logout}
						</button>
					</form>
				</div>
			</aside>

			<div className="min-w-0 flex-1 lg:pl-[17rem]">
				<main id="main-content" className="mx-auto w-full max-w-[92rem] px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
					{children}
				</main>
			</div>
		</div>
	);
}
