import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";

export async function requireAdmin() {
	await connection();
	const session = await auth();
	if (!session?.user) redirect("/admin/login");
	return session;
}
