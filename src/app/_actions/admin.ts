"use server";

import { db } from "~/server/db";
import { eq } from "drizzle-orm";
import { adminSettings } from "~/server/db/schema";

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

/** Upsert admin settings (insert-or-update on key = "default"). */
export async function saveAdminSettings(
  data: Omit<AdminSettingsData, "updatedAt">,
): Promise<{ ok: boolean; error?: string }> {
  try {
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
    return { ok: true };
  } catch (error) {
    console.error("Error saving admin settings:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
