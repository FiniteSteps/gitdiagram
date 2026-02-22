"use server";

import { db } from "~/server/db";
import { eq, and, desc, sql, max } from "drizzle-orm";
import { diagramCache, diagramHistory } from "~/server/db/schema";

export async function getCachedDiagram(
  username: string,
  repo: string,
  branch = "",
) {
  try {
    const cached = await db
      .select()
      .from(diagramCache)
      .where(
        and(
          eq(diagramCache.username, username),
          eq(diagramCache.repo, repo),
          eq(diagramCache.branch, branch),
        ),
      )
      .limit(1);

    return cached[0]?.diagram ?? null;
  } catch (error) {
    console.error("Error fetching cached diagram:", error);
    return null;
  }
}

export async function getCachedExplanation(
  username: string,
  repo: string,
  branch = "",
) {
  try {
    const cached = await db
      .select()
      .from(diagramCache)
      .where(
        and(
          eq(diagramCache.username, username),
          eq(diagramCache.repo, repo),
          eq(diagramCache.branch, branch),
        ),
      )
      .limit(1);

    return cached[0]?.explanation ?? null;
  } catch (error) {
    console.error("Error fetching cached explanation:", error);
    return null;
  }
}

export async function cacheDiagramAndExplanation(
  username: string,
  repo: string,
  diagram: string,
  explanation: string,
  usedOwnKey = false,
  branch = "",
) {
  try {
    // Upsert into cache (latest diagram, backward-compat)
    await db
      .insert(diagramCache)
      .values({
        username,
        repo,
        branch,
        diagram,
        explanation,
        usedOwnKey,
      })
      .onConflictDoUpdate({
        target: [diagramCache.username, diagramCache.repo, diagramCache.branch],
        set: {
          diagram,
          explanation,
          usedOwnKey,
          updatedAt: new Date(),
        },
      });

    // Compute next version number for this repo/branch
    const [maxRow] = await db
      .select({ maxVersion: max(diagramHistory.version) })
      .from(diagramHistory)
      .where(
        and(
          eq(diagramHistory.username, username),
          eq(diagramHistory.repo, repo),
          eq(diagramHistory.branch, branch),
        ),
      );
    const nextVersion = (maxRow?.maxVersion ?? 0) + 1;

    // Insert into version history
    await db.insert(diagramHistory).values({
      username,
      repo,
      branch,
      version: nextVersion,
      diagram,
      explanation,
      usedOwnKey,
    });

    return nextVersion;
  } catch (error) {
    console.error("Error caching diagram:", error);
    return null;
  }
}

// ── Version history queries ─────────────────────────────────────────

export interface DiagramVersion {
  id: number;
  version: number;
  createdAt: Date;
  usedOwnKey: boolean | null;
}

/**
 * Get all versions for a repo/branch (metadata only, no diagram text).
 * Returns versions sorted newest-first.
 */
export async function getDiagramVersions(
  username: string,
  repo: string,
  branch = "",
): Promise<DiagramVersion[]> {
  try {
    const rows = await db
      .select({
        id: diagramHistory.id,
        version: diagramHistory.version,
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
    console.error("Error fetching diagram versions:", error);
    return [];
  }
}

/**
 * Get a specific version's full diagram + explanation.
 */
export async function getDiagramByVersion(
  username: string,
  repo: string,
  version: number,
  branch = "",
) {
  try {
    const [row] = await db
      .select({
        diagram: diagramHistory.diagram,
        explanation: diagramHistory.explanation,
        version: diagramHistory.version,
        createdAt: diagramHistory.createdAt,
      })
      .from(diagramHistory)
      .where(
        and(
          eq(diagramHistory.username, username),
          eq(diagramHistory.repo, repo),
          eq(diagramHistory.branch, branch),
          eq(diagramHistory.version, version),
        ),
      )
      .limit(1);

    return row ?? null;
  } catch (error) {
    console.error("Error fetching diagram by version:", error);
    return null;
  }
}

/**
 * Get the latest version's diagram + metadata from history.
 * Falls back to the legacy cache table if no history exists.
 */
export async function getLatestDiagramFromHistory(
  username: string,
  repo: string,
  branch = "",
) {
  try {
    const [row] = await db
      .select({
        diagram: diagramHistory.diagram,
        explanation: diagramHistory.explanation,
        version: diagramHistory.version,
        createdAt: diagramHistory.createdAt,
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

    if (row) return row;

    // Fallback: old cache table (pre-versioning diagrams)
    const [legacy] = await db
      .select()
      .from(diagramCache)
      .where(
        and(
          eq(diagramCache.username, username),
          eq(diagramCache.repo, repo),
          eq(diagramCache.branch, branch),
        ),
      )
      .limit(1);

    if (legacy) {
      return {
        diagram: legacy.diagram,
        explanation: legacy.explanation,
        version: 1 as number,
        createdAt: legacy.updatedAt ?? legacy.createdAt,
      };
    }

    return null;
  } catch (error) {
    console.error("Error fetching latest diagram from history:", error);
    return null;
  }
}

export async function getDiagramStats() {
  try {
    const stats = await db
      .select({
        totalDiagrams: sql`COUNT(*)`,
        ownKeyUsers: sql`COUNT(CASE WHEN ${diagramCache.usedOwnKey} = true THEN 1 END)`,
        freeUsers: sql`COUNT(CASE WHEN ${diagramCache.usedOwnKey} = false THEN 1 END)`,
      })
      .from(diagramCache);

    return stats[0];
  } catch (error) {
    console.error("Error getting diagram stats:", error);
    return null;
  }
}
