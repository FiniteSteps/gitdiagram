import OpenAI, { AzureOpenAI } from "openai";

export type ReasoningEffort = "low" | "medium" | "high";

export interface AzureOpenAIOptions {
  endpoint: string;
  deployment: string;
  apiVersion: string;
}

function resolveApiKey(overrideApiKey?: string): string {
  const apiKey = overrideApiKey?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Missing OpenAI API key. Set OPENAI_API_KEY or provide api_key in request.",
    );
  }
  return apiKey;
}

function createClient(apiKey: string, azure?: AzureOpenAIOptions): OpenAI {
  if (azure) {
    return new AzureOpenAI({
      apiKey,
      endpoint: azure.endpoint,
      apiVersion: azure.apiVersion,
      deployment: azure.deployment,
    });
  }
  return new OpenAI({ apiKey });
}

function resolveModel(model: string, azure?: AzureOpenAIOptions): string {
  return azure ? azure.deployment : model;
}

export function estimateTokens(text: string): number {
  // Rough heuristic used for fast gating/cost estimates in serverless.
  return Math.ceil(text.length / 4);
}

interface StreamCompletionParams {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  apiKey?: string;
  reasoningEffort?: ReasoningEffort;
  maxOutputTokens?: number;
  azure?: AzureOpenAIOptions;
}

export async function* streamCompletion({
  model,
  systemPrompt,
  userPrompt,
  apiKey,
  reasoningEffort,
  maxOutputTokens,
  azure,
}: StreamCompletionParams): AsyncGenerator<string, void, void> {
  const client = createClient(resolveApiKey(apiKey), azure);
  const resolvedModel = resolveModel(model, azure);

  const stream = await client.responses.create({
    model: resolvedModel,
    stream: true,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
    ...(maxOutputTokens ? { max_output_tokens: maxOutputTokens } : {}),
  });

  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      if (event.delta) {
        yield event.delta;
      }
      continue;
    }

    if (event.type === "error") {
      const message = event.message ?? "OpenAI stream failed.";
      throw new Error(message);
    }
  }
}

interface CountInputTokensParams {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  apiKey?: string;
  reasoningEffort?: ReasoningEffort;
  azure?: AzureOpenAIOptions;
}

export async function countInputTokens({
  model,
  systemPrompt,
  userPrompt,
  apiKey,
  reasoningEffort,
  azure,
}: CountInputTokensParams): Promise<number> {
  const client = createClient(resolveApiKey(apiKey), azure);
  const resolvedModel = resolveModel(model, azure);

  const response = await client.responses.inputTokens.count({
    model: resolvedModel,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
  });

  return response.input_tokens;
}
