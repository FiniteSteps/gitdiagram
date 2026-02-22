// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { sql } from "drizzle-orm";
import {
  pgTableCreator,
  timestamp,
  varchar,
  primaryKey,
  boolean,
  text,
} from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `gitdiagram_${name}`);

export const diagramCache = createTable(
  "diagram_cache",
  {
    username: varchar("username", { length: 256 }).notNull(),
    repo: varchar("repo", { length: 256 }).notNull(),
    diagram: varchar("diagram", { length: 10000 }).notNull(), // Adjust length as needed
    explanation: varchar("explanation", { length: 10000 })
      .notNull()
      .default("No explanation provided"), // Default explanation to avoid data loss of existing rows
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
    usedOwnKey: boolean("used_own_key").default(false),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.username, table.repo] }),
  }),
);

// ── Admin settings (singleton row, key = "default") ─────────────────
export const adminSettings = createTable("admin_settings", {
  key: varchar("key", { length: 64 }).primaryKey().default("default"),
  // OpenAI / Azure OpenAI
  openaiApiKey: text("openai_api_key"),
  openaiModel: varchar("openai_model", { length: 128 }),
  llmProvider: varchar("llm_provider", { length: 32 }).default("openai"), // "openai" | "azure_openai"
  azureEndpoint: text("azure_endpoint"),
  azureDeployment: varchar("azure_deployment", { length: 256 }),
  azureApiVersion: varchar("azure_api_version", { length: 64 }),
  // GitHub
  githubPat: text("github_pat"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
    () => new Date(),
  ),
});
