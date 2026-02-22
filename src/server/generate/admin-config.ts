/**
 * Resolves the admin-configured LLM settings stored in the database.
 * Used by the generation route handlers to obtain API keys, model, and
 * Azure OpenAI configuration without any client-supplied secrets.
 */

import { db } from "~/server/db";
import { eq } from "drizzle-orm";
import { adminSettings } from "~/server/db/schema";
import type { AzureOpenAIOptions } from "~/server/generate/openai";

const SETTINGS_KEY = "default";

export interface ResolvedAdminConfig {
  apiKey?: string;
  model?: string;
  azure?: AzureOpenAIOptions;
  githubPat?: string;
}

let cachedConfig: ResolvedAdminConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Fetch admin settings from the DB with a short in-memory cache so that
 * every SSE chunk doesn't trigger a round-trip.
 */
export async function getResolvedAdminConfig(): Promise<ResolvedAdminConfig> {
  const now = Date.now();
  if (cachedConfig && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedConfig;
  }

  try {
    const rows = await db
      .select()
      .from(adminSettings)
      .where(eq(adminSettings.key, SETTINGS_KEY))
      .limit(1);

    const row = rows[0];
    if (!row) {
      cachedConfig = {};
      cacheTimestamp = now;
      return cachedConfig;
    }

    const azure: AzureOpenAIOptions | undefined =
      row.llmProvider === "azure_openai" &&
      row.azureEndpoint &&
      row.azureDeployment &&
      row.azureApiVersion
        ? {
            endpoint: row.azureEndpoint,
            deployment: row.azureDeployment,
            apiVersion: row.azureApiVersion,
          }
        : undefined;

    cachedConfig = {
      apiKey: row.openaiApiKey?.trim() || undefined,
      model: row.openaiModel?.trim() || undefined,
      azure,
      githubPat: row.githubPat?.trim() || undefined,
    };
    cacheTimestamp = now;
    return cachedConfig;
  } catch (error) {
    console.error("Error resolving admin config:", error);
    return cachedConfig ?? {};
  }
}

/** Force-clear the cache (e.g. after an admin save). */
export function invalidateAdminConfigCache(): void {
  cachedConfig = null;
  cacheTimestamp = 0;
}
