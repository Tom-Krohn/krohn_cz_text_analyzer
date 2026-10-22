import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyPassword } from "@/lib/auth/password";
import { ADMIN_LOGIN_KEY, isLoginLocked, recordLoginFailure, resetLoginFailures } from "@/lib/auth/login-limiter";
import { getServerEnv } from "@/lib/env";

export const { handlers, auth, signIn, signOut } = NextAuth({
	session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
	pages: { signIn: "/admin/login" },
	providers: [
		Credentials({
			credentials: {
				email: { label: "E-mail", type: "email" },
				password: { label: "Heslo", type: "password" },
			},
			authorize: async (credentials) => {
				const env = getServerEnv();
				if (await isLoginLocked(ADMIN_LOGIN_KEY)) return null;
				const email = String(credentials.email ?? "")
					.trim()
					.toLowerCase();
				const password = String(credentials.password ?? "");
				const isValid = email === env.ADMIN_EMAIL.toLowerCase() && verifyPassword(password, env.ADMIN_PASSWORD_HASH);
				if (!isValid) {
					await recordLoginFailure(ADMIN_LOGIN_KEY);
					return null;
				}
				await resetLoginFailures(ADMIN_LOGIN_KEY);
				return { id: ADMIN_LOGIN_KEY, email: env.ADMIN_EMAIL };
			},
		}),
	],
});
