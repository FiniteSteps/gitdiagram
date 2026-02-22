import { z } from "zod";

const azureOpenAIConfigSchema = z.object({
  endpoint: z.string().min(1),
  deployment: z.string().min(1),
  api_version: z.string().min(1),
});

const modelConfigSchema = z.object({
  provider: z.enum(["openai", "azure_openai"]),
  model_name: z.string().optional(),
  api_key: z.string().min(1).optional(),
  azure: azureOpenAIConfigSchema.optional(),
});

export const generateRequestSchema = z.object({
  username: z.string().min(1),
  repo: z.string().min(1),
  // Kept for backward-compat with the FastAPI backend; the Next.js frontend
  // no longer sends these — the values come from admin settings in the DB.
  api_key: z.string().min(1).optional(),
  github_pat: z.string().min(1).optional(),
  model_config: modelConfigSchema.optional(),
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;
export type ModelConfigPayload = z.infer<typeof modelConfigSchema>;

export function sseMessage(payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}
