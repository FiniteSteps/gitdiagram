import { getModel } from "~/server/generate/model-config";
import {
  extractComponentMapping,
  processClickEvents,
  stripMermaidCodeFences,
  toTaggedMessage,
} from "~/server/generate/format";
import { getGithubData } from "~/server/generate/github";
import {
  formatValidationFeedback,
  validateMermaidSyntax,
} from "~/server/generate/mermaid";
import {
  countInputTokens,
  estimateTokens,
  streamCompletion,
  type AzureOpenAIOptions,
} from "~/server/generate/openai";
import {
  SYSTEM_FIRST_PROMPT,
  SYSTEM_FIX_MERMAID_PROMPT,
  SYSTEM_SECOND_PROMPT,
  SYSTEM_THIRD_PROMPT,
} from "~/server/generate/prompts";
import { generateRequestSchema, sseMessage } from "~/server/generate/types";
import { getResolvedAdminConfig } from "~/server/generate/admin-config";
import { getActivePromptStages, type ActivePromptStage } from "~/app/_actions/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const MAX_MERMAID_FIX_ATTEMPTS = 3;

// ── Hardcoded fallback stages (used when no active prompt set exists) ──
const FALLBACK_STAGES: ActivePromptStage[] = [
  { stageOrder: 1, stageName: "Explanation", stageTag: "explanation", systemPrompt: SYSTEM_FIRST_PROMPT },
  { stageOrder: 2, stageName: "Component Mapping", stageTag: "mapping", systemPrompt: SYSTEM_SECOND_PROMPT },
  { stageOrder: 3, stageName: "Diagram Generation", stageTag: "diagram", systemPrompt: SYSTEM_THIRD_PROMPT },
];

/** Return a user-friendly error message; never leak internal details. */
function safeErrorMessage(error: Error): string {
  const msg = error.message ?? "";
  if (/auth|api.key|unauthorized/i.test(msg))
    return "OpenAI API key is invalid or expired.";
  if (/rate.limit/i.test(msg))
    return "OpenAI rate limit exceeded. Please try again later.";
  if (/github/i.test(error.constructor?.name ?? ""))
    return "GitHub API error. The repository may be private or inaccessible.";
  // Pass through our own ValueError-style messages
  if (msg.length > 0 && msg.length < 200) return msg;
  return "An internal error occurred. Please try again.";
}

/** Azure models may not support all reasoning-effort levels (e.g. "low").
 *  Clamp unsupported values to "medium" when targeting Azure OpenAI. */
function resolveReasoningEffort(
  effort: "low" | "medium" | "high",
  azure?: AzureOpenAIOptions,
): "low" | "medium" | "high" {
  if (azure && effort === "low") return "medium";
  return effort;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function estimateRepoTokenCount(
  model: string,
  fileTree: string,
  readme: string,
  apiKey?: string,
  azure?: AzureOpenAIOptions,
  firstStageSystemPrompt?: string,
) {
  try {
    return await countInputTokens({
      model,
      systemPrompt: firstStageSystemPrompt ?? SYSTEM_FIRST_PROMPT,
      userPrompt: toTaggedMessage({
        file_tree: fileTree,
        readme,
      }),
      apiKey,
      reasoningEffort: "medium",
      azure,
    });
  } catch {
    return estimateTokens(`${fileTree}\n${readme}`);
  }
}

export async function POST(request: Request) {
  const parsed = generateRequestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Invalid request payload.",
        error_code: "VALIDATION_ERROR",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { username, repo, branch } = parsed.data;

  // Resolve settings from admin DB config (never from client)
  const adminConfig = await getResolvedAdminConfig();
  const apiKey = adminConfig.apiKey;
  const azure = adminConfig.azure;
  const githubPat = adminConfig.githubPat;

  const { signal } = request;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sseMessage(payload)));
      };

      const run = async () => {
        try {
          const githubData = await getGithubData(username, repo, githubPat, branch);
          const model = adminConfig.model || getModel();

          // ── Fetch active prompt set (always fresh from DB) ──
          const activeStages = await getActivePromptStages();

          // Separate regular stages from the fix stage
          let regularStages = activeStages.filter((s) => s.stageTag !== "fix");
          const fixStage = activeStages.find((s) => s.stageTag === "fix");

          // Fallback to hardcoded defaults if no regular stages configured
          if (regularStages.length === 0) {
            regularStages = FALLBACK_STAGES;
          }

          const firstStagePrompt = regularStages[0]!.systemPrompt;
          const fixPrompt = fixStage?.systemPrompt ?? SYSTEM_FIX_MERMAID_PROMPT;

          const tokenCount = await estimateRepoTokenCount(
            model,
            githubData.fileTree,
            githubData.readme,
            apiKey,
            azure,
            firstStagePrompt,
          );

          send({
            status: "started",
            message: "Starting generation process...",
          });

          // Tell the frontend how many stages to expect
          send({
            status: "stage_info",
            stages: regularStages.map((s) => ({ tag: s.stageTag, name: s.stageName })),
            total_stages: regularStages.length,
          });

          if (tokenCount > 50000 && tokenCount < 195000 && !apiKey) {
            send({
              status: "error",
              error:
                "File tree and README combined exceeds token limit (50,000). This repository is too large for free generation. Provide your own OpenAI API key to continue.",
              error_code: "API_KEY_REQUIRED",
            });
            controller.close();
            return;
          }

          if (tokenCount > 195000) {
            send({
              status: "error",
              error:
                "Repository is too large (>195k tokens) for analysis. Try a smaller repo.",
              error_code: "TOKEN_LIMIT_EXCEEDED",
            });
            controller.close();
            return;
          }

          // ── Dynamic stage pipeline ──────────────────────────────
          // Context accumulates all outputs; starts with repo data.
          const context: Record<string, string> = {
            file_tree: githubData.fileTree,
            readme: githubData.readme,
          };

          for (let i = 0; i < regularStages.length; i++) {
            const stage = regularStages[i]!;
            const tag = stage.stageTag;
            const isFirst = i === 0;

            send({
              status: `${tag}_sent`,
              message: `Sending ${stage.stageName.toLowerCase()} request to ${model}...`,
              stage_index: i,
            });
            await sleep(80);
            send({
              status: tag,
              message: `Processing ${stage.stageName.toLowerCase()}...`,
              stage_index: i,
            });

            let output = "";
            for await (const chunk of streamCompletion({
              model,
              systemPrompt: stage.systemPrompt,
              userPrompt: toTaggedMessage(context),
              apiKey,
              reasoningEffort: isFirst
                ? "medium"
                : resolveReasoningEffort("low", azure),
              azure,
            })) {
              output += chunk;
              send({ status: `${tag}_chunk`, chunk, stage_index: i });
            }

            // Store output in context for subsequent stages
            context[tag] = output;

            // Special post-processing for well-known tags
            if (tag === "mapping") {
              context.component_mapping = extractComponentMapping(output);
            }

            // Check for client disconnect between stages
            if (signal.aborted) {
              controller.close();
              return;
            }
          }

          // ── Mermaid validation & fix loop ───────────────────────
          const rawDiagram = context.diagram;
          if (!rawDiagram) {
            send({
              status: "error",
              error:
                "No stage with the 'diagram' tag was found in the active prompt set. " +
                "Ensure at least one stage uses the 'diagram' tag to produce Mermaid output.",
              error_code: "NO_DIAGRAM_STAGE",
            });
            return;
          }

          let candidateDiagram = stripMermaidCodeFences(rawDiagram);
          let validationResult = await validateMermaidSyntax(candidateDiagram);
          const hadFixLoop = !validationResult.valid;

          if (!validationResult.valid) {
            const parserFeedback = formatValidationFeedback(validationResult);
            send({
              status: "diagram_fixing",
              message:
                "Diagram generated. Mermaid syntax validation failed, starting auto-fix loop...",
              parser_error: parserFeedback,
            });
          }

          for (
            let attempt = 1;
            !validationResult.valid && attempt <= MAX_MERMAID_FIX_ATTEMPTS;
            attempt++
          ) {
            const parserFeedback = formatValidationFeedback(validationResult);
            send({
              status: "diagram_fix_attempt",
              message: `Fixing Mermaid syntax (attempt ${attempt}/${MAX_MERMAID_FIX_ATTEMPTS})...`,
              fix_attempt: attempt,
              fix_max_attempts: MAX_MERMAID_FIX_ATTEMPTS,
              parser_error: parserFeedback,
            });

            let repairedDiagram = "";
            for await (const chunk of streamCompletion({
              model,
              systemPrompt: fixPrompt,
              userPrompt: toTaggedMessage({
                mermaid_code: candidateDiagram,
                parser_error: parserFeedback,
                explanation: context.explanation,
                component_mapping: context.component_mapping,
              }),
              apiKey,
              reasoningEffort: resolveReasoningEffort("low", azure),
              azure,
            })) {
              repairedDiagram += chunk;
              send({
                status: "diagram_fix_chunk",
                chunk,
                fix_attempt: attempt,
                fix_max_attempts: MAX_MERMAID_FIX_ATTEMPTS,
              });
            }

            candidateDiagram = stripMermaidCodeFences(repairedDiagram);
            send({
              status: "diagram_fix_validating",
              message: `Validating Mermaid syntax after attempt ${attempt}/${MAX_MERMAID_FIX_ATTEMPTS}...`,
              fix_attempt: attempt,
              fix_max_attempts: MAX_MERMAID_FIX_ATTEMPTS,
            });
            validationResult = await validateMermaidSyntax(candidateDiagram);
          }

          if (!validationResult.valid) {
            send({
              status: "error",
              error:
                "Generated Mermaid remained syntactically invalid after auto-fix attempts. Please retry generation.",
              error_code: "MERMAID_SYNTAX_UNRESOLVED",
              parser_error: formatValidationFeedback(validationResult),
            });
            return;
          }

          const processedDiagram = processClickEvents(
            candidateDiagram,
            username,
            repo,
            githubData.defaultBranch,
          );

          if (hadFixLoop) {
            send({
              status: "diagram_fixing",
              message: "Mermaid syntax validated. Finalizing diagram output...",
            });
          }

          send({
            status: "complete",
            diagram: processedDiagram,
            explanation: context.explanation ?? "",
            mapping: context.component_mapping ?? context.mapping ?? "",
          });
        } catch (error) {
          send({
            status: "error",
            error:
              error instanceof Error
                ? safeErrorMessage(error)
                : "Streaming generation failed.",
            error_code: "STREAM_FAILED",
          });
        } finally {
          controller.close();
        }
      };

      void run();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
