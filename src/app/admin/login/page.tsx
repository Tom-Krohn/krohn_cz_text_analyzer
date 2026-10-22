import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { inputClass, primaryButtonClass } from "@/components/admin-ui";
import { getRequestI18n } from "@/lib/i18n/server";

export const instant = false;

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
	const { error } = await searchParams;
	const { messages } = await getRequestI18n();

	async function login(formData: FormData) {
		"use server";
		try {
			await signIn("credentials", {
				email: formData.get("email"),
				password: formData.get("password"),
				redirectTo: "/admin",
			});
		} catch (caught) {
			if (caught instanceof AuthError) redirect("/admin/login?error=1");
			throw caught;
		}
	}

	return (
		<main className="grid min-h-[100dvh] bg-background lg:grid-cols-[minmax(0,1fr)_minmax(26rem,36rem)]">
			<section className="hidden flex-col justify-between border-r border-line bg-sidebar px-12 py-10 lg:flex xl:px-16 xl:py-12">
				<div className="flex items-center gap-3">
					<span className="grid size-10 place-items-center rounded-xl bg-accent text-lg font-extrabold text-white shadow-md shadow-accent/15">
						K
					</span>
					<span>
						<span className="block text-sm font-bold tracking-tight">Krohn Labs</span>
						<span className="block text-xs tracking-wide text-muted">Text Analyzer</span>
					</span>
				</div>
				<div className="max-w-2xl">
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{messages.login.heroEyebrow}</p>
					<h2 className="mt-5 text-5xl font-semibold leading-[1.05] tracking-tight xl:text-6xl">
						{messages.login.heroTitle}
						<br />
						<span className="text-muted">{messages.login.heroTitleAccent}</span>
					</h2>
					<p className="mt-6 max-w-xl text-base leading-relaxed text-muted">{messages.login.heroDescription}</p>
				</div>
				<p className="text-xs text-muted">{messages.login.heroFooter}</p>
			</section>

			<section className="flex min-h-[100dvh] items-center justify-center px-4 py-10 sm:px-8">
				<div className="w-full max-w-md">
					<div className="mb-6 flex items-center gap-3 lg:hidden">
						<span className="grid size-10 place-items-center rounded-xl bg-accent text-lg font-extrabold text-white">
							K
						</span>
						<span className="text-sm font-bold tracking-tight">Krohn Labs Text Analyzer</span>
					</div>
					<section className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
						<div className="mb-7 flex flex-col gap-2">
							<p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{messages.login.eyebrow}</p>
							<h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{messages.login.title}</h1>
							<p className="text-sm leading-relaxed text-muted">{messages.login.description}</p>
						</div>
						<form action={login} className="flex flex-col gap-4">
							<label className="flex flex-col gap-1.5 text-sm font-semibold">
								{messages.login.email}
								<input className={inputClass} name="email" type="email" autoComplete="username" required />
							</label>
							<label className="flex flex-col gap-1.5 text-sm font-semibold">
								{messages.login.password}
								<input
									className={inputClass}
									name="password"
									type="password"
									autoComplete="current-password"
									required
								/>
							</label>
							{error ? (
								<p
									role="alert"
									className="rounded-lg border border-rose-700/25 border-l-2 border-l-rose-700/70 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-300/25 dark:border-l-rose-300/70 dark:bg-rose-300/[0.06] dark:text-rose-100"
								>
									{messages.login.loginFailed}
								</p>
							) : null}
							<button className={`${primaryButtonClass} mt-1 w-full`} type="submit">
								{messages.login.submit}
							</button>
						</form>
					</section>
				</div>
			</section>
		</main>
	);
}
