"use server";

import { db } from "~/server/db";
import { eq, desc, sql, count, and } from "drizzle-orm";
import {
  adminSettings,
  adminAuditLog,
  diagramCache,
  diagramHistory,
} from "~/server/db/schema";
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
  versionCount: number;
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

    // Attach version counts from history table
    const entries: CacheEntry[] = [];
    for (const row of rows) {
      const [vc] = await db
        .select({ value: count() })
        .from(diagramHistory)
        .where(
          and(
            eq(diagramHistory.username, row.username),
            eq(diagramHistory.repo, row.repo),
            eq(diagramHistory.branch, row.branch),
          ),
        );
      entries.push({ ...row, versionCount: vc?.value ?? 0 });
    }

    return entries;
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

    // Also delete version history
    await db
      .delete(diagramHistory)
      .where(
        sql`${diagramHistory.username} = ${username} AND ${diagramHistory.repo} = ${repo} AND ${diagramHistory.branch} = ${branch}`,
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
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- intentional: purge all history
    await db.delete(diagramHistory);

    await db.insert(adminAuditLog).values({
      action: "cache_purge",
      details: `Purged all ${String(cacheCount?.value ?? 0)} cached diagrams and version history`,
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

// ── Version management (admin) ──────────────────────────────────────

export interface VersionEntry {
  id: number;
  version: number;
  diagram: string;
  explanation: string;
  createdAt: Date;
  usedOwnKey: boolean | null;
}

/** List all versions for a given repo/branch. Newest first. */
export async function listVersionsForRepo(
  username: string,
  repo: string,
  branch = "",
): Promise<VersionEntry[]> {
  try {
    const rows = await db
      .select({
        id: diagramHistory.id,
        version: diagramHistory.version,
        diagram: diagramHistory.diagram,
        explanation: diagramHistory.explanation,
        createdAt: diagramHistory.createdAt,
        usedOwnKey: diagramHistory.usedOwnKey,
      })
      .from(diagramHistory)
      .where(
        and(
          eq(diagramHistory.username, username),
          eq(diagramHistory.repo, repo),
          eq(diagramHistory.branch, branch),
        ),
      )
      .orderBy(desc(diagramHistory.version));
    return rows;
  } catch (error) {
    console.error("Error listing versions:", error);
    return [];
  }
}

/** Delete a single version by its row id. Also updates the cache table if the deleted version was latest. */
export async function deleteVersion(
  id: number,
  username: string,
  repo: string,
  branch = "",
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Find the version being deleted
    const [target] = await db
      .select({ version: diagramHistory.version })
      .from(diagramHistory)
      .where(eq(diagramHistory.id, id))
      .limit(1);

    await db.delete(diagramHistory).where(eq(diagramHistory.id, id));

    // If we deleted the latest version, update the cache table to point to the new latest
    const [newLatest] = await db
      .select({
        diagram: diagramHistory.diagram,
        explanation: diagramHistory.explanation,
      })
      .from(diagramHistory)
      .where(
        and(
          eq(diagramHistory.username, username),
          eq(diagramHistory.repo, repo),
          eq(diagramHistory.branch, branch),
        ),
      )
      .orderBy(desc(diagramHistory.version))
      .limit(1);

    if (newLatest) {
      // Update cache to the new latest version
      await db
        .update(diagramCache)
        .set({
          diagram: newLatest.diagram,
          explanation: newLatest.explanation,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(diagramCache.username, username),
            eq(diagramCache.repo, repo),
            eq(diagramCache.branch, branch),
          ),
        );
    } else {
      // No versions left — remove the cache entry too
      await db
        .delete(diagramCache)
        .where(
          sql`${diagramCache.username} = ${username} AND ${diagramCache.repo} = ${repo} AND ${diagramCache.branch} = ${branch}`,
        );
    }

    await db.insert(adminAuditLog).values({
      action: "version_delete",
      details: `Deleted version ${target?.version ?? "?"} of ${username}/${repo}${branch ? ` @${branch}` : ""}`,
    });

    return { ok: true };
  } catch (error) {
    console.error("Error deleting version:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/** Update the diagram text of a specific version. If it's the latest, also update the cache table. */
export async function updateVersionDiagram(
  id: number,
  username: string,
  repo: string,
  branch: string,
  newDiagram: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Get the version number for the audit log
    const [target] = await db
      .select({ version: diagramHistory.version })
      .from(diagramHistory)
      .where(eq(diagramHistory.id, id))
      .limit(1);

    // Update the history row
    await db
      .update(diagramHistory)
      .set({ diagram: newDiagram })
      .where(eq(diagramHistory.id, id));

    // Check if this is the latest version
    const [latest] = await db
      .select({ id: diagramHistory.id })
      .from(diagramHistory)
      .where(
        and(
          eq(diagramHistory.username, username),
          eq(diagramHistory.repo, repo),
          eq(diagramHistory.branch, branch),
        ),
      )
      .orderBy(desc(diagramHistory.version))
      .limit(1);

    if (latest && latest.id === id) {
      // Also update the cache table
      await db
        .update(diagramCache)
        .set({ diagram: newDiagram, updatedAt: new Date() })
        .where(
          and(
            eq(diagramCache.username, username),
            eq(diagramCache.repo, repo),
            eq(diagramCache.branch, branch),
          ),
        );
    }

    await db.insert(adminAuditLog).values({
      action: "version_edit",
      details: `Edited diagram v${target?.version ?? "?"} of ${username}/${repo}${branch ? ` @${branch}` : ""}`,
    });

    return { ok: true };
  } catch (error) {
    console.error("Error updating version diagram:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
