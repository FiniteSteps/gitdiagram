import * as schema from "./schema";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { neon } from "@neondatabase/serverless";
import postgres from "postgres";
import { config } from "dotenv";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

config({ path: ".env" });

// Define a type that can be either Neon or Postgres database
type DrizzleDatabase =
  | NeonHttpDatabase<typeof schema>
  | PostgresJsDatabase<typeof schema>;

// Cache the postgres client on globalThis to prevent HMR from creating
// duplicate connections and conflicting prepared statements in dev mode.
const globalForDb = globalThis as unknown as {
  pgClient: ReturnType<typeof postgres> | undefined;
};

// Check if we're using Neon/Vercel (production) or local Postgres
const isNeonConnection = process.env.POSTGRES_URL?.includes("neon.tech");

const db: DrizzleDatabase = (() => {
  if (isNeonConnection) {
    // Production: Use Neon HTTP connection
    const sql = neon(process.env.POSTGRES_URL!);
    return drizzleNeon(sql, { schema });
  } else {
    // Local development: Use standard Postgres connection.
    // Reuse the client across HMR reloads and disable prepared statements
    // to avoid "prepared statement already exists" errors.
    const client =
      globalForDb.pgClient ??
      postgres(process.env.POSTGRES_URL!, { prepare: false });
    if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;
    return drizzlePostgres(client, { schema });
  }
})();

export { db };
