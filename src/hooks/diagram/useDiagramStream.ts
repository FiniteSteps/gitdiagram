import { useCallback, useState } from "react";

import { streamDiagramGeneration } from "~/features/diagram/api";
import type {
  DiagramStreamMessage,
  DiagramStreamState,
} from "~/features/diagram/types";

interface UseDiagramStreamOptions {
  username: string;
  repo: string;
  branch?: string;
  onComplete: (result: { diagram: string; explanation: string }) => Promise<void>;
  onError: (message: string) => void;
}

/** Well-known tags that map to named state fields for backward compat. */
const WELL_KNOWN_TAGS: Record<string, keyof Pick<DiagramStreamState, "explanation" | "mapping" | "diagram">> = {
  explanation: "explanation",
  mapping: "mapping",
  diagram: "diagram",
};

export function useDiagramStream({
  username,
  repo,
  branch,
  onComplete,
  onError,
}: UseDiagramStreamOptions) {
  const [state, setState] = useState<DiagramStreamState>({ status: "idle" });

  const handleStreamMessage = useCallback(
    async (
      data: DiagramStreamMessage,
      buffers: {
        explanation: string;
        mapping: string;
        diagram: string;
        fixDiagramDraft: string;
        stageOutputs: Record<string, string>;
      },
    ) => {
      if (data.error) {
        setState({
          status: "error",
          error: data.error,
          errorCode: data.error_code,
          parserError: data.parser_error,
        });
        onError(data.error);
        return false;
      }

      const status = data.status as string;

      // ── Pipeline metadata ──────────────────────────────────────
      if (status === "stage_info") {
        setState((prev) => ({
          ...prev,
          status: "stage_info",
          stageInfo: data.stages,
          totalStages: data.total_stages,
        }));
        return true;
      }

      // ── Completion ─────────────────────────────────────────────
      if (status === "complete") {
        const explanation = data.explanation ?? buffers.explanation;
        const diagram = data.diagram ?? buffers.diagram;
        setState({
          status: "complete",
          explanation,
          diagram,
          mapping: data.mapping ?? buffers.mapping,
          stageOutputs: { ...buffers.stageOutputs },
        });
        await onComplete({ explanation, diagram });
        return false;
      }

      // ── Error ──────────────────────────────────────────────────
      if (status === "error") {
        setState({
          status: "error",
          error: data.error,
          parserError: data.parser_error,
        });
        if (data.error) onError(data.error);
        return false;
      }

      // ── Fix-loop events (diagram_fix_*) ────────────────────────
      if (status === "diagram_fix_chunk") {
        if (data.chunk) {
          buffers.fixDiagramDraft += data.chunk;
          setState((prev) => ({
            ...prev,
            status: "diagram_fix_chunk",
            fixDiagramDraft: buffers.fixDiagramDraft,
            fixAttempt: data.fix_attempt ?? prev.fixAttempt,
            fixMaxAttempts: data.fix_max_attempts ?? prev.fixMaxAttempts,
          }));
        }
        return true;
      }

      if (status.startsWith("diagram_fix") || status === "diagram_fixing") {
        setState((prev) => ({
          ...prev,
          status,
          message: data.message,
          parserError: data.parser_error,
          fixAttempt: data.fix_attempt ?? prev.fixAttempt,
          fixMaxAttempts: data.fix_max_attempts ?? prev.fixMaxAttempts,
          ...(status === "diagram_fix_attempt" ? { fixDiagramDraft: "" } : {}),
        }));
        return true;
      }

      // ── Dynamic stage chunk ({tag}_chunk) ──────────────────────
      if (status.endsWith("_chunk") && data.chunk) {
        const tag = status.slice(0, -6); // strip "_chunk"
        buffers.stageOutputs[tag] = (buffers.stageOutputs[tag] ?? "") + data.chunk;
        const output = buffers.stageOutputs[tag]!;

        // Also populate well-known named buffers for backward compat
        const wellKnown = WELL_KNOWN_TAGS[tag];
        if (wellKnown === "explanation") buffers.explanation = output;
        else if (wellKnown === "mapping") buffers.mapping = output;
        else if (wellKnown === "diagram") buffers.diagram = output;

        setState((prev) => ({
          ...prev,
          status,
          stageOutputs: { ...buffers.stageOutputs },
          ...(wellKnown ? { [wellKnown]: output } : {}),
        }));
        return true;
      }

      // ── Stage sent / processing ({tag}_sent, {tag}) or started ─
      setState((prev) => ({
        ...prev,
        status,
        message: data.message,
        ...(data.stage_index !== undefined ? { currentStageIndex: data.stage_index } : {}),
      }));
      return true;
    },
    [onComplete, onError],
  );

  const runGeneration = useCallback(
    async () => {
      setState({ status: "started", message: "Starting generation process..." });
      const buffers = {
        explanation: "",
        mapping: "",
        diagram: "",
        fixDiagramDraft: "",
        stageOutputs: {} as Record<string, string>,
      };

      await streamDiagramGeneration(
        {
          username,
          repo,
          branch,
        },
        {
          onMessage: (message) => handleStreamMessage(message, buffers),
        },
      );
    },
    [branch, handleStreamMessage, repo, username],
  );

  return {
    state,
    runGeneration,
    setState,
  };
}
