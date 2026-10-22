import Link from "next/link";
import { getRequestI18n } from "@/lib/i18n/server";

export default async function HomePage() {
	const { messages } = await getRequestI18n();
	return (
		<main className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col justify-center gap-4 px-6 py-16">
			<h1 className="text-2xl font-semibold tracking-tight">Krohn Labs Text Analyzer</h1>
			<p className="text-sm text-muted">{messages.home.description}</p>
			<Link className="w-fit text-sm font-medium underline underline-offset-4" href="/admin">
				{messages.home.openAdmin}
			</Link>
		</main>
	);
}
