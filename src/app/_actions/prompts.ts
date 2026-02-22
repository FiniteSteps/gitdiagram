"use server";

import { db } from "~/server/db";
import { eq, desc, asc, and, sql, count } from "drizzle-orm";
import {
  promptSets,
  promptStages,
  promptHistory,
  adminAuditLog,
} from "~/server/db/schema";
import {
  SYSTEM_FIRST_PROMPT,
  SYSTEM_SECOND_PROMPT,
  SYSTEM_THIRD_PROMPT,
  SYSTEM_FIX_MERMAID_PROMPT,
} from "~/server/generate/prompts";

// ────────────────────────── Types ──────────────────────────

export interface PromptSetSummary {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  stageCount: number;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface PromptStageData {
  id: number;
  promptSetId: number;
  stageOrder: number;
  stageName: string;
  stageTag: string;
  systemPrompt: string;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface PromptHistoryEntry {
  id: number;
  promptSetId: number;
  promptStageId: number;
  stageName: string;
  systemPrompt: string;
  version: number;
  changeNote: string | null;
  createdAt: Date;
}

// ────────────────────────── Default seed ──────────────────────────

const DEFAULT_STAGES = [
  {
    stageOrder: 1,
    stageName: "Explanation",
    stageTag: "explanation",
    systemPrompt: SYSTEM_FIRST_PROMPT,
  },
  {
    stageOrder: 2,
    stageName: "Component Mapping",
    stageTag: "mapping",
    systemPrompt: SYSTEM_SECOND_PROMPT,
  },
  {
    stageOrder: 3,
    stageName: "Diagram Generation",
    stageTag: "diagram",
    systemPrompt: SYSTEM_THIRD_PROMPT,
  },
  {
    stageOrder: 4,
    stageName: "Mermaid Fix",
    stageTag: "fix",
    systemPrompt: SYSTEM_FIX_MERMAID_PROMPT,
  },
];

/** Ensure at least one prompt set exists (seed defaults). */
export async function ensureDefaultPromptSet(): Promise<void> {
  const existing = await db.select({ id: promptSets.id }).from(promptSets).limit(1);
  if (existing.length > 0) return;

  const [set] = await db
    .insert(promptSets)
    .values({
      name: "Default (3-stage + fix)",
      description:
        "The original 3-stage pipeline: Explanation → Component Mapping → Diagram, with a Mermaid syntax fix fallback.",
      isActive: true,
    })
    .returning();

  if (!set) return;

  for (const stage of DEFAULT_STAGES) {
    const [inserted] = await db
      .insert(promptStages)
      .values({ promptSetId: set.id, ...stage })
      .returning();

    if (inserted) {
      await db.insert(promptHistory).values({
        promptSetId: set.id,
        promptStageId: inserted.id,
        stageName: stage.stageName,
        systemPrompt: stage.systemPrompt,
        version: 1,
        changeNote: "Initial seed from hardcoded defaults",
      });
    }
  }

  await db.insert(adminAuditLog).values({
    action: "prompt_set_seed",
    details: "Default prompt set seeded from hardcoded prompts",
  });
}

// ────────────────────────── CRUD: Prompt Sets ──────────────────────────

/** List all prompt sets with stage counts. */
export async function listPromptSets(): Promise<PromptSetSummary[]> {
  await ensureDefaultPromptSet();

  const sets = await db
    .select({
      id: promptSets.id,
      name: promptSets.name,
      description: promptSets.description,
      isActive: promptSets.isActive,
      createdAt: promptSets.createdAt,
      updatedAt: promptSets.updatedAt,
    })
    .from(promptSets)
    .orderBy(desc(promptSets.createdAt));

  // Get stage counts
  const stageCounts = await db
    .select({
      promptSetId: promptStages.promptSetId,
      count: count(),
    })
    .from(promptStages)
    .groupBy(promptStages.promptSetId);

  const countMap = new Map(stageCounts.map((sc) => [sc.promptSetId, sc.count]));

  return sets.map((s) => ({
    ...s,
    stageCount: countMap.get(s.id) ?? 0,
  }));
}

/** Create a new prompt set. */
export async function createPromptSet(data: {
  name: string;
  description?: string;
  stages: { stageName: string; stageTag: string; systemPrompt: string }[];
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  try {
    const [set] = await db
      .insert(promptSets)
      .values({
        name: data.name,
        description: data.description ?? null,
        isActive: false,
      })
      .returning();

    if (!set) return { ok: false, error: "Failed to create prompt set" };

    for (let i = 0; i < data.stages.length; i++) {
      const stage = data.stages[i]!;
      const [inserted] = await db
        .insert(promptStages)
        .values({
          promptSetId: set.id,
          stageOrder: i + 1,
          stageName: stage.stageName,
          stageTag: stage.stageTag,
          systemPrompt: stage.systemPrompt,
        })
        .returning();

      if (inserted) {
        await db.insert(promptHistory).values({
          promptSetId: set.id,
          promptStageId: inserted.id,
          stageName: stage.stageName,
          systemPrompt: stage.systemPrompt,
          version: 1,
          changeNote: "Initial creation",
        });
      }
    }

    await db.insert(adminAuditLog).values({
      action: "prompt_set_create",
      details: `Created prompt set "${data.name}" with ${data.stages.length} stages`,
    });

    return { ok: true, id: set.id };
  } catch (error) {
    console.error("Error creating prompt set:", error);
    return { ok: false, error: "Failed to create prompt set" };
  }
}

/** Delete a prompt set (cascade deletes stages + history). */
export async function deletePromptSet(
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const [set] = await db
      .select({ name: promptSets.name, isActive: promptSets.isActive })
      .from(promptSets)
      .where(eq(promptSets.id, id));

    if (!set) return { ok: false, error: "Prompt set not found" };
    if (set.isActive)
      return { ok: false, error: "Cannot delete the active prompt set" };

    await db.delete(promptSets).where(eq(promptSets.id, id));

    await db.insert(adminAuditLog).values({
      action: "prompt_set_delete",
      details: `Deleted prompt set "${set.name}" (id=${id})`,
    });

    return { ok: true };
  } catch (error) {
    console.error("Error deleting prompt set:", error);
    return { ok: false, error: "Failed to delete prompt set" };
  }
}

/** Activate a prompt set (deactivates all others). */
export async function activatePromptSet(
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const [set] = await db
      .select({ name: promptSets.name })
      .from(promptSets)
      .where(eq(promptSets.id, id));

    if (!set) return { ok: false, error: "Prompt set not found" };

    // Deactivate all, then activate the selected one
    // eslint-disable-next-line drizzle/enforce-update-with-where
    await db.update(promptSets).set({ isActive: false });
    await db
      .update(promptSets)
      .set({ isActive: true })
      .where(eq(promptSets.id, id));

    await db.insert(adminAuditLog).values({
      action: "prompt_set_activate",
      details: `Activated prompt set "${set.name}" (id=${id})`,
    });

    return { ok: true };
  } catch (error) {
    console.error("Error activating prompt set:", error);
    return { ok: false, error: "Failed to activate prompt set" };
  }
}

/** Rename / update description of a prompt set. */
export async function updatePromptSetMeta(
  id: number,
  data: { name?: string; description?: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await db.update(promptSets).set(data).where(eq(promptSets.id, id));

    await db.insert(adminAuditLog).values({
      action: "prompt_set_update",
      details: `Updated prompt set metadata (id=${id})`,
      changedFields: JSON.stringify(Object.keys(data)),
    });

    return { ok: true };
  } catch (error) {
    console.error("Error updating prompt set:", error);
    return { ok: false, error: "Failed to update prompt set" };
  }
}

// ────────────────────────── CRUD: Prompt Stages ──────────────────────────

/** List stages for a prompt set, ordered by stageOrder. */
export async function listPromptStages(
  promptSetId: number,
): Promise<PromptStageData[]> {
  return db
    .select()
    .from(promptStages)
    .where(eq(promptStages.promptSetId, promptSetId))
    .orderBy(asc(promptStages.stageOrder));
}

/** Update a prompt stage's system prompt (creates history entry). */
export async function updatePromptStage(
  stageId: number,
  data: { systemPrompt: string; changeNote?: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const [stage] = await db
      .select()
      .from(promptStages)
      .where(eq(promptStages.id, stageId));

    if (!stage) return { ok: false, error: "Prompt stage not found" };

    // Get current max version for this stage
    const [maxVer] = await db
      .select({ max: sql<number>`COALESCE(MAX(${promptHistory.version}), 0)` })
      .from(promptHistory)
      .where(eq(promptHistory.promptStageId, stageId));

    const nextVersion = (maxVer?.max ?? 0) + 1;

    // Update the live stage
    await db
      .update(promptStages)
      .set({ systemPrompt: data.systemPrompt })
      .where(eq(promptStages.id, stageId));

    // Insert history
    await db.insert(promptHistory).values({
      promptSetId: stage.promptSetId,
      promptStageId: stageId,
      stageName: stage.stageName,
      systemPrompt: data.systemPrompt,
      version: nextVersion,
      changeNote: data.changeNote ?? null,
    });

    await db.insert(adminAuditLog).values({
      action: "prompt_stage_update",
      details: `Updated stage "${stage.stageName}" (id=${stageId}) to v${nextVersion}`,
    });

    return { ok: true };
  } catch (error) {
    console.error("Error updating prompt stage:", error);
    return { ok: false, error: "Failed to update prompt stage" };
  }
}

/** Update stage metadata (name, tag, order). */
export async function updatePromptStageMeta(
  stageId: number,
  data: { stageName?: string; stageTag?: string; stageOrder?: number },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await db.update(promptStages).set(data).where(eq(promptStages.id, stageId));
    return { ok: true };
  } catch (error) {
    console.error("Error updating prompt stage meta:", error);
    return { ok: false, error: "Failed to update prompt stage metadata" };
  }
}

/** Add a new stage to a prompt set. */
export async function addPromptStage(
  promptSetId: number,
  data: { stageName: string; stageTag: string; systemPrompt: string },
): Promise<{ ok: boolean; id?: number; error?: string }> {
  try {
    // Get max stage order
    const [maxOrd] = await db
      .select({
        max: sql<number>`COALESCE(MAX(${promptStages.stageOrder}), 0)`,
      })
      .from(promptStages)
      .where(eq(promptStages.promptSetId, promptSetId));

    const nextOrder = (maxOrd?.max ?? 0) + 1;

    const [inserted] = await db
      .insert(promptStages)
      .values({
        promptSetId,
        stageOrder: nextOrder,
        ...data,
      })
      .returning();

    if (!inserted) return { ok: false, error: "Failed to add stage" };

    await db.insert(promptHistory).values({
      promptSetId,
      promptStageId: inserted.id,
      stageName: data.stageName,
      systemPrompt: data.systemPrompt,
      version: 1,
      changeNote: "Initial creation",
    });

    await db.insert(adminAuditLog).values({
      action: "prompt_stage_add",
      details: `Added stage "${data.stageName}" (order=${nextOrder}) to set id=${promptSetId}`,
    });

    return { ok: true, id: inserted.id };
  } catch (error) {
    console.error("Error adding prompt stage:", error);
    return { ok: false, error: "Failed to add stage" };
  }
}

/** Delete a stage from a prompt set. */
export async function deletePromptStage(
  stageId: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const [stage] = await db
      .select({
        stageName: promptStages.stageName,
        promptSetId: promptStages.promptSetId,
      })
      .from(promptStages)
      .where(eq(promptStages.id, stageId));

    if (!stage) return { ok: false, error: "Stage not found" };

    await db.delete(promptStages).where(eq(promptStages.id, stageId));

    await db.insert(adminAuditLog).values({
      action: "prompt_stage_delete",
      details: `Deleted stage "${stage.stageName}" (id=${stageId}) from set id=${stage.promptSetId}`,
    });

    return { ok: true };
  } catch (error) {
    console.error("Error deleting prompt stage:", error);
    return { ok: false, error: "Failed to delete stage" };
  }
}

// ────────────────────────── History ──────────────────────────

/** Get full history for a specific stage. */
export async function getStageHistory(
  stageId: number,
): Promise<PromptHistoryEntry[]> {
  return db
    .select()
    .from(promptHistory)
    .where(eq(promptHistory.promptStageId, stageId))
    .orderBy(desc(promptHistory.version));
}

/** Get all history for a prompt set. */
export async function getPromptSetHistory(
  promptSetId: number,
): Promise<PromptHistoryEntry[]> {
  return db
    .select()
    .from(promptHistory)
    .where(eq(promptHistory.promptSetId, promptSetId))
    .orderBy(desc(promptHistory.createdAt));
}

/** Revert a stage to a specific history version. */
export async function revertStageToVersion(
  stageId: number,
  historyId: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const [historyEntry] = await db
      .select()
      .from(promptHistory)
      .where(
        and(
          eq(promptHistory.id, historyId),
          eq(promptHistory.promptStageId, stageId),
        ),
      );

    if (!historyEntry) return { ok: false, error: "History entry not found" };

    return updatePromptStage(stageId, {
      systemPrompt: historyEntry.systemPrompt,
      changeNote: `Reverted to version ${historyEntry.version}`,
    });
  } catch (error) {
    console.error("Error reverting stage:", error);
    return { ok: false, error: "Failed to revert stage" };
  }
}

// ────────────────────────── Active prompts (for generation) ──────────────────

export interface ActivePromptStage {
  stageOrder: number;
  stageName: string;
  stageTag: string;
  systemPrompt: string;
}

/** Get the stages from the currently active prompt set (for generation). */
export async function getActivePromptStages(): Promise<ActivePromptStage[]> {
  await ensureDefaultPromptSet();

  const [activeSet] = await db
    .select({ id: promptSets.id })
    .from(promptSets)
    .where(eq(promptSets.isActive, true))
    .limit(1);

  if (!activeSet) {
    // Fallback: no active set — return empty (generation code will use hardcoded defaults)
    return [];
  }

  const stages = await db
    .select({
      stageOrder: promptStages.stageOrder,
      stageName: promptStages.stageName,
      stageTag: promptStages.stageTag,
      systemPrompt: promptStages.systemPrompt,
    })
    .from(promptStages)
    .where(eq(promptStages.promptSetId, activeSet.id))
    .orderBy(asc(promptStages.stageOrder));

  return stages;
}

/** Duplicate a prompt set (creates a copy with all stages). */
export async function duplicatePromptSet(
  sourceId: number,
  newName: string,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  try {
    const [source] = await db
      .select()
      .from(promptSets)
      .where(eq(promptSets.id, sourceId));

    if (!source) return { ok: false, error: "Source prompt set not found" };

    const stages = await db
      .select()
      .from(promptStages)
      .where(eq(promptStages.promptSetId, sourceId))
      .orderBy(asc(promptStages.stageOrder));

    return createPromptSet({
      name: newName,
      description: source.description ?? undefined,
      stages: stages.map((s) => ({
        stageName: s.stageName,
        stageTag: s.stageTag,
        systemPrompt: s.systemPrompt,
      })),
    });
  } catch (error) {
    console.error("Error duplicating prompt set:", error);
    return { ok: false, error: "Failed to duplicate prompt set" };
  }
}
