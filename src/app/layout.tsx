import type { Metadata } from "next";
import localFont from "next/font/local";
import { connection } from "next/server";
import { getRequestI18n } from "@/lib/i18n/server";
import "./theme.css";

const nunito = localFont({
	src: "./fonts/Nunito-Variable.woff2",
	variable: "--font-nunito",
	display: "swap",
	weight: "200 1000",
});

export async function generateMetadata(): Promise<Metadata> {
	await connection();
	const { messages } = await getRequestI18n();
	return {
		title: "Krohn Labs Text Analyzer",
		description: messages.metadata.description,
	};
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
	await connection();
	const { locale, theme } = await getRequestI18n();
	return (
		<html
			lang={locale}
			data-theme={theme}
			className={`${nunito.variable} ${theme === "dark" ? "dark" : ""} h-full antialiased`}
		>
			<body className="min-h-full flex flex-col">{children}</body>
		</html>
	);
}
