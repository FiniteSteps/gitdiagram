"use server";

import { db } from "~/server/db";
import { eq, desc, sql, count } from "drizzle-orm";
import { adminSettings, adminAuditLog, diagramCache } from "~/server/db/schema";
import { invalidateAdminConfigCache } from "~/server/generate/admin-config";

const SETTINGS_KEY = "default";

export interface AdminSettingsData {
  openaiApiKey?: string | null;
  openaiModel?: string | null;
  llmProvider?: string | null;
  azureEndpoint?: string | null;
  azureDeployment?: string | null;
  azureApiVersion?: string | null;
  githubPat?: string | null;
  updatedAt?: Date | null;
}

/** Read the singleton admin settings row. */
export async function getAdminSettings(): Promise<AdminSettingsData | null> {
  try {
    const rows = await db
      .select()
      .from(adminSettings)
      .where(eq(adminSettings.key, SETTINGS_KEY))
      .limit(1);
    if (!rows[0]) return null;
    return {
      openaiApiKey: rows[0].openaiApiKey,
      openaiModel: rows[0].openaiModel,
      llmProvider: rows[0].llmProvider,
      azureEndpoint: rows[0].azureEndpoint,
      azureDeployment: rows[0].azureDeployment,
      azureApiVersion: rows[0].azureApiVersion,
      githubPat: rows[0].githubPat,
      updatedAt: rows[0].updatedAt,
    };
  } catch (error) {
    console.error("Error reading admin settings:", error);
    return null;
  }
}

/** Upsert admin settings (insert-or-update on key = "default") with audit log. */
export async function saveAdminSettings(
  data: Omit<AdminSettingsData, "updatedAt">,
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Fetch current settings to diff for audit log
    const current = await getAdminSettings();
    const changedFields: string[] = [];
    const fields: (keyof Omit<AdminSettingsData, "updatedAt">)[] = [
      "openaiApiKey",
      "openaiModel",
      "llmProvider",
      "azureEndpoint",
      "azureDeployment",
      "azureApiVersion",
      "githubPat",
    ];
    for (const f of fields) {
      const oldVal = current?.[f] ?? null;
      const newVal = data[f] ?? null;
      if (oldVal !== newVal) changedFields.push(f);
    }

    await db
      .insert(adminSettings)
      .values({
        key: SETTINGS_KEY,
        openaiApiKey: data.openaiApiKey ?? null,
        openaiModel: data.openaiModel ?? null,
        llmProvider: data.llmProvider ?? "openai",
        azureEndpoint: data.azureEndpoint ?? null,
        azureDeployment: data.azureDeployment ?? null,
        azureApiVersion: data.azureApiVersion ?? null,
        githubPat: data.githubPat ?? null,
      })
      .onConflictDoUpdate({
        target: adminSettings.key,
        set: {
          openaiApiKey: data.openaiApiKey ?? null,
          openaiModel: data.openaiModel ?? null,
          llmProvider: data.llmProvider ?? "openai",
          azureEndpoint: data.azureEndpoint ?? null,
          azureDeployment: data.azureDeployment ?? null,
          azureApiVersion: data.azureApiVersion ?? null,
          githubPat: data.githubPat ?? null,
          updatedAt: new Date(),
        },
      });

    // Write audit log entry (#13)
    if (changedFields.length > 0) {
      await db.insert(adminAuditLog).values({
        action: "settings_update",
        changedFields: JSON.stringify(changedFields),
        details: `Updated: ${changedFields.join(", ")}`,
      });
    }

    // Invalidate the in-memory config cache so generation routes
    // pick up the new settings immediately instead of waiting 30s.
    invalidateAdminConfigCache();

    return { ok: true };
  } catch (error) {
    console.error("Error saving admin settings:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ── Dashboard stats (#6) ────────────────────────────────────────────

export interface AdminDashboardStats {
  totalCachedDiagrams: number;
  provider: string;
  model: string;
  hasGithubPat: boolean;
  lastSettingsUpdate: Date | null;
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  try {
    const [cacheCount] = await db
      .select({ value: count() })
      .from(diagramCache);

    const settings = await getAdminSettings();

    return {
      totalCachedDiagrams: cacheCount?.value ?? 0,
      provider: settings?.llmProvider ?? "openai",
      model: settings?.openaiModel ?? process.env.OPENAI_MODEL ?? "gpt-5.2",
      hasGithubPat: !!settings?.githubPat,
      lastSettingsUpdate: settings?.updatedAt ?? null,
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return {
      totalCachedDiagrams: 0,
      provider: "openai",
      model: "unknown",
      hasGithubPat: false,
      lastSettingsUpdate: null,
    };
  }
}

// ── Cache management (#7) ───────────────────────────────────────────

export interface CacheEntry {
  username: string;
  repo: string;
  branch: string;
  createdAt: Date;
  updatedAt: Date | null;
  usedOwnKey: boolean | null;
}

export async function listCachedDiagrams(): Promise<CacheEntry[]> {
  try {
    const rows = await db
      .select({
        username: diagramCache.username,
        repo: diagramCache.repo,
        branch: diagramCache.branch,
        createdAt: diagramCache.createdAt,
        updatedAt: diagramCache.updatedAt,
        usedOwnKey: diagramCache.usedOwnKey,
      })
      .from(diagramCache)
      .orderBy(desc(diagramCache.createdAt));
    return rows;
  } catch (error) {
    console.error("Error listing cached diagrams:", error);
    return [];
  }
}

export async function deleteCacheEntry(
  username: string,
  repo: string,
  branch = "",
): Promise<{ ok: boolean; error?: string }> {
  try {
    await db
      .delete(diagramCache)
      .where(
        sql`${diagramCache.username} = ${username} AND ${diagramCache.repo} = ${repo} AND ${diagramCache.branch} = ${branch}`,
      );

    const branchLabel = branch ? ` (branch: ${branch})` : "";
    await db.insert(adminAuditLog).values({
      action: "cache_delete",
      details: `Deleted cache: ${username}/${repo}${branchLabel}`,
    });

    return { ok: true };
  } catch (error) {
    console.error("Error deleting cache entry:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function purgeAllCache(): Promise<{ ok: boolean; error?: string }> {
  try {
    const [cacheCount] = await db
      .select({ value: count() })
      .from(diagramCache);

    // eslint-disable-next-line drizzle/enforce-delete-with-where -- intentional: purge all cache
    await db.delete(diagramCache);

    await db.insert(adminAuditLog).values({
      action: "cache_purge",
      details: `Purged all ${String(cacheCount?.value ?? 0)} cached diagrams`,
    });

    return { ok: true };
  } catch (error) {
    console.error("Error purging cache:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ── Audit log (#13) ─────────────────────────────────────────────────

export interface AuditLogEntry {
  id: number;
  action: string;
  changedFields: string | null;
  details: string | null;
  createdAt: Date;
}

export async function getAuditLog(limit = 50): Promise<AuditLogEntry[]> {
  try {
    const rows = await db
      .select()
      .from(adminAuditLog)
      .orderBy(desc(adminAuditLog.createdAt))
      .limit(limit);
    return rows;
  } catch (error) {
    console.error("Error fetching audit log:", error);
    return [];
  }
}
