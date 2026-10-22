import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { getServerEnv } from "@/lib/env";
import * as schema from "./schema";

let cachedPool: Pool | undefined;

export function getDb() {
	if (!cachedPool) {
		cachedPool = new Pool({ connectionString: getServerEnv().DATABASE_URL });
	}
	return drizzle({ client: cachedPool, schema });
}

export type Db = ReturnType<typeof getDb>;
