"use client";

import { useEffect, useState, useRef } from "react";
import type { StageInfo } from "~/features/diagram/types";

const messages = [
  "Checking if its cached...",
  "Generating diagram...",
  "Analyzing repository...",
  "Prompting GPT-5.2...",
  "Inspecting file paths...",
  "Finding component relationships...",
  "Linking components to code...",
  "Extracting relevant directories...",
  "Reasoning about the diagram...",
  "Prompt engineers needed -> Check out the GitHub",
  "Shoutout to GitIngest for inspiration",
  "I need to find a way to make this faster...",
  "Finding the meaning of life...",
  "I'm tired...",
  "Please just give me the diagram...",
  "...NOW!",
  "guess not...",
];

interface LoadingProps {
  cost?: string;
  status: string;
  message?: string;
  parserError?: string;
  fixAttempt?: number;
  fixMaxAttempts?: number;
  fixDiagramDraft?: string;
  // Backward-compat named fields
  explanation?: string;
  mapping?: string;
  diagram?: string;
  // Dynamic pipeline
  stageInfo?: StageInfo[];
  stageOutputs?: Record<string, string>;
  totalStages?: number;
  currentStageIndex?: number;
}

/**
 * Derive the 1-based step number from the current status string.
 * For dynamic pipelines, uses currentStageIndex; for legacy, pattern-matches.
 */
const getStepNumber = (status: string, currentStageIndex?: number, totalStages?: number): number => {
  if (currentStageIndex !== undefined) return currentStageIndex + 1;
  // Legacy fallback for fix loop or before stage_info arrives
  if (status.startsWith("diagram_fix") || status === "diagram_fixing") {
    return totalStages ?? 3;
  }
  if (status.startsWith("diagram")) return totalStages ?? 3;
  if (status.startsWith("mapping")) return 2;
  if (status.startsWith("explanation")) return 1;
  return 0;
};

const SequentialDots = () => {
  return (
    <span className="inline-flex w-8 justify-start">
      <span className="flex gap-0.5">
        <span className="h-1 w-1 animate-[dot1_1.5s_steps(1)_infinite] rounded-full bg-[hsl(var(--neo-dot-active))]" />
        <span className="h-1 w-1 animate-[dot2_1.5s_steps(1)_infinite] rounded-full bg-[hsl(var(--neo-dot-active))]" />
        <span className="h-1 w-1 animate-[dot3_1.5s_steps(1)_infinite] rounded-full bg-[hsl(var(--neo-dot-active))]" />
      </span>
    </span>
  );
};

const StepDots = ({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) => {
  return (
    <div className="flex gap-1">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
        <div
          key={step}
          className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
            step <= currentStep
              ? "bg-[hsl(var(--neo-dot-active))]"
              : "bg-[hsl(var(--neo-dot-inactive))]"
          }`}
        />
      ))}
    </div>
  );
};

export default function Loading({
  status = "idle",
  message,
  parserError,
  fixAttempt,
  fixMaxAttempts,
  fixDiagramDraft,
  explanation,
  mapping,
  diagram,
  cost,
  stageInfo,
  stageOutputs,
  totalStages: totalStagesProp,
  currentStageIndex,
}: LoadingProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const totalStages = totalStagesProp ?? stageInfo?.length ?? 3;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessageIndex((prevIndex) => (prevIndex + 1) % messages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Auto-scroll effect
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [
    status,
    message,
    parserError,
    fixAttempt,
    fixMaxAttempts,
    fixDiagramDraft,
    explanation,
    mapping,
    diagram,
    stageOutputs,
  ]);

  /** Determine if the current stage is still "reasoning" (no output yet). */
  const shouldShowReasoning = (currentStatus: string) => {
    if (
      currentStatus === "diagram_fixing" ||
      currentStatus === "diagram_fix_attempt" ||
      currentStatus === "diagram_fix_chunk" ||
      currentStatus === "diagram_fix_validating"
    ) {
      return null;
    }

    // Dynamic: check if we're on a _sent or tag status with no output yet
    if (stageInfo && stageOutputs) {
      for (const stage of stageInfo) {
        if (
          currentStatus === `${stage.tag}_sent` ||
          (currentStatus === stage.tag && !stageOutputs[stage.tag])
        ) {
          return stage.tag;
        }
      }
      return null;
    }

    // Legacy fallback
    if (
      currentStatus === "explanation_sent" ||
      (currentStatus.startsWith("explanation") && !explanation)
    ) {
      return "explanation";
    }
    if (
      currentStatus === "mapping_sent" ||
      (currentStatus.startsWith("mapping") && !mapping)
    ) {
      return "mapping";
    }
    if (
      currentStatus === "diagram_sent" ||
      (currentStatus.startsWith("diagram") && !diagram)
    ) {
      return "diagram";
    }
    return null;
  };

  const renderReasoningMessage = () => {
    const reasoningTag = shouldShowReasoning(status);
    if (!reasoningTag) return null;

    // Dynamic: use stage name from metadata
    if (stageInfo) {
      const stage = stageInfo.find((s) => s.tag === reasoningTag);
      if (stage) return `Model is reasoning about ${stage.name.toLowerCase()}...`;
    }

    // Legacy fallback
    switch (reasoningTag) {
      case "explanation":
        return "Model is analyzing the repository structure and codebase...";
      case "mapping":
        return "Model is identifying component relationships and dependencies...";
      case "diagram":
        return "Model is planning the diagram layout and connections...";
      default:
        return `Model is reasoning about ${reasoningTag}...`;
    }
  };

  const getStatusDisplay = () => {
    const reasoningTag = shouldShowReasoning(status);

    // Fix loop (always static)
    if (
      status === "diagram_fixing" ||
      status === "diagram_fix_attempt" ||
      status === "diagram_fix_chunk" ||
      status === "diagram_fix_validating"
    ) {
      return {
        text: message ?? "Fixing Mermaid syntax...",
        isReasoning: false,
      };
    }

    // Dynamic: match current stage tag
    if (stageInfo && reasoningTag) {
      const stage = stageInfo.find((s) => s.tag === reasoningTag);
      if (stage) {
        return {
          text: `Model is reasoning about ${stage.name.toLowerCase()}`,
          isReasoning: true,
        };
      }
    }
    if (stageInfo) {
      // Check if status matches a known stage chunk
      for (const stage of stageInfo) {
        if (status === `${stage.tag}_chunk` || status === `${stage.tag}_sent` || status === stage.tag) {
          const hasOutput = stageOutputs?.[stage.tag];
          return {
            text: hasOutput
              ? `Processing ${stage.name.toLowerCase()}...`
              : `Model is reasoning about ${stage.name.toLowerCase()}`,
            isReasoning: !hasOutput,
          };
        }
      }
    }

    // Legacy fallback
    switch (status) {
      case "explanation_sent":
      case "explanation":
      case "explanation_chunk":
        return {
          text: reasoningTag
            ? "Model is reasoning about repository structure"
            : "Explaining repository structure...",
          isReasoning: !!reasoningTag,
        };
      case "mapping_sent":
      case "mapping":
      case "mapping_chunk":
        return {
          text: reasoningTag
            ? "Model is reasoning about component relationships"
            : "Creating component mapping...",
          isReasoning: !!reasoningTag,
        };
      case "diagram_sent":
      case "diagram":
      case "diagram_chunk":
        return {
          text: reasoningTag
            ? "Model is reasoning about diagram structure"
            : "Generating diagram...",
          isReasoning: !!reasoningTag,
        };
      default:
        return {
          text: messages[currentMessageIndex],
          isReasoning: false,
        };
    }
  };

  const statusDisplay = getStatusDisplay();
  const reasoningMessage = renderReasoningMessage();
  const hasFixTelemetry =
    status === "diagram_fixing" ||
    status === "diagram_fix_attempt" ||
    status === "diagram_fix_chunk" ||
    status === "diagram_fix_validating" ||
    typeof fixAttempt === "number" ||
    !!parserError ||
    !!fixDiagramDraft;

  return (
    <div className="mx-auto w-full max-w-4xl p-4">
      <div className="overflow-hidden rounded-xl border-2 border-purple-200 bg-purple-50/30 backdrop-blur-sm dark:border-[#2d1d4e] dark:bg-[linear-gradient(160deg,#1a1228,#150f22)]">
        <div className="border-b border-purple-100 bg-purple-100/50 px-6 py-3 dark:border-[#2d1d4e] dark:bg-[#1e1832]/90">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-purple-500 dark:text-[hsl(var(--neo-button-hover))]">
                {statusDisplay.text}
              </span>
              {statusDisplay.isReasoning && <SequentialDots />}
            </div>
            <div className="flex items-center gap-3 text-xs font-medium text-purple-500 dark:text-[hsl(var(--foreground))]">
              {cost && <span>Estimated cost: {cost}</span>}
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-purple-100 px-2 py-0.5 dark:bg-[#251b3a]">
                  Step {getStepNumber(status, currentStageIndex, totalStages)}/{totalStages}
                </span>
                <StepDots currentStep={getStepNumber(status, currentStageIndex, totalStages)} totalSteps={totalStages} />
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} className="max-h-[400px] overflow-y-auto p-6">
          <div className="flex flex-col gap-6">
            {/* Only show reasoning message if we have some content */}
            {reasoningMessage &&
              statusDisplay.isReasoning &&
              (stageOutputs ? Object.keys(stageOutputs).length > 0 : (explanation ?? mapping ?? diagram)) && (
                <div className="rounded-lg bg-purple-100/50 p-4 text-sm text-purple-500 dark:bg-[#1d1530] dark:text-[hsl(var(--foreground))]">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">Reasoning</p>
                    <SequentialDots />
                  </div>
                  <p className="mt-2 leading-relaxed">{reasoningMessage}</p>
                </div>
            )}

            {/* Dynamic stage outputs */}
            {stageInfo && stageOutputs ? (
              stageInfo.map((stage) => {
                const output = stageOutputs[stage.tag];
                if (!output) return null;
                const isCode = stage.tag === "mapping" || stage.tag === "diagram";
                return (
                  <div
                    key={stage.tag}
                    className="rounded-lg bg-white/50 p-4 text-sm text-gray-600 dark:bg-[#1a1228]/80 dark:text-[hsl(var(--foreground))]"
                  >
                    <p className="font-medium text-purple-500 dark:text-[hsl(var(--neo-link-hover))]">
                      {stage.name}:
                    </p>
                    {isCode ? (
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                        {output}
                      </pre>
                    ) : (
                      <p className="mt-2 leading-relaxed">{output}</p>
                    )}
                  </div>
                );
              })
            ) : (
              /* Legacy fallback: hardcoded explanation/mapping/diagram */
              <>
                {explanation && (
                  <div className="rounded-lg bg-white/50 p-4 text-sm text-gray-600 dark:bg-[#1a1228]/80 dark:text-[hsl(var(--foreground))]">
                    <p className="font-medium text-purple-500 dark:text-[hsl(var(--neo-link-hover))]">
                      Explanation:
                    </p>
                    <p className="mt-2 leading-relaxed">{explanation}</p>
                  </div>
                )}
                {mapping && (
                  <div className="rounded-lg bg-white/50 p-4 text-sm text-gray-600 dark:bg-[#1a1228]/80 dark:text-[hsl(var(--foreground))]">
                    <p className="font-medium text-purple-500 dark:text-[hsl(var(--neo-link-hover))]">
                      Mapping:
                    </p>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {mapping}
                    </pre>
                  </div>
                )}
                {diagram && (
                  <div className="rounded-lg bg-white/50 p-4 text-sm text-gray-600 dark:bg-[#1a1228]/80 dark:text-[hsl(var(--foreground))]">
                    <p className="font-medium text-purple-500 dark:text-[hsl(var(--neo-link-hover))]">
                      Mermaid.js diagram:
                    </p>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {diagram}
                    </pre>
                  </div>
                )}
              </>
            )}
            {hasFixTelemetry && (
              <div className="rounded-lg border border-purple-200 bg-white/70 p-4 text-sm text-gray-600 dark:border-[#2d1d4e] dark:bg-[#1a1228]/85 dark:text-[hsl(var(--foreground))]">
                <p className="font-medium text-purple-500 dark:text-[hsl(var(--neo-link-hover))]">
                  Syntax Repair Loop
                </p>
                {typeof fixAttempt === "number" &&
                  typeof fixMaxAttempts === "number" && (
                    <p className="mt-1 text-xs text-purple-500 dark:text-[hsl(var(--foreground))]">
                      Attempt {fixAttempt}/{fixMaxAttempts}
                    </p>
                  )}
                {message && <p className="mt-2 leading-relaxed">{message}</p>}
                {parserError && (
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-md bg-purple-50 p-3 text-xs text-gray-700 dark:bg-[#130f22] dark:text-[hsl(var(--foreground))]">
                    {parserError}
                  </pre>
                )}
                {fixDiagramDraft && (
                  <div className="mt-3">
                    <p className="mb-2 text-xs font-medium text-purple-500 dark:text-[hsl(var(--neo-link-hover))]">
                      Candidate Mermaid fix (streaming)
                    </p>
                    <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-purple-50 p-3 text-xs text-gray-700 dark:bg-[#130f22] dark:text-[hsl(var(--foreground))]">
                      {fixDiagramDraft}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
