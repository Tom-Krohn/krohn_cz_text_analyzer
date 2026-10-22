import { z } from "zod";

const serverEnvSchema = z.object({
	DATABASE_URL: z.string().min(1),
	AUTH_SECRET: z.string().min(32),
	ADMIN_EMAIL: z.email(),
	ADMIN_PASSWORD_HASH: z.string().min(1),
	APP_ENCRYPTION_KEY: z.string().min(1),
	INNGEST_EVENT_KEY: z.string().optional(),
	INNGEST_SIGNING_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
	cachedEnv ??= serverEnvSchema.parse(process.env);
	return cachedEnv;
}
