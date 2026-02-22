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
  serial,
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
    branch: varchar("branch", { length: 512 }).notNull().default(""),
    diagram: text("diagram").notNull(),
    explanation: text("explanation")
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
    pk: primaryKey({ columns: [table.username, table.repo, table.branch] }),
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

// ── Admin audit log ─────────────────────────────────────────────────
export const adminAuditLog = createTable("admin_audit_log", {
  id: serial("id").primaryKey(),
  action: varchar("action", { length: 64 }).notNull(), // e.g. "settings_update"
  changedFields: text("changed_fields"), // JSON string of field names that changed
  details: text("details"), // optional human-readable summary
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});
