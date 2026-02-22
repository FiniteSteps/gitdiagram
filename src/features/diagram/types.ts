/**
 * Stream status is now dynamic — each stage emits `{tag}_sent`, `{tag}`,
 * `{tag}_chunk`.  The well-known values below are kept as a union for
 * static helpers that reference them directly.  Runtime code should treat
 * this as `string`.
 */
export type DiagramStreamStatus =
  | "idle"
  | "started"
  | "stage_info"
  // Legacy well-known stage statuses (still emitted for default pipeline)
  | "explanation_sent"
  | "explanation"
  | "explanation_chunk"
  | "mapping_sent"
  | "mapping"
  | "mapping_chunk"
  | "diagram_sent"
  | "diagram"
  | "diagram_chunk"
  // Fix loop (always the same regardless of pipeline shape)
  | "diagram_fixing"
  | "diagram_fix_attempt"
  | "diagram_fix_chunk"
  | "diagram_fix_validating"
  | "complete"
  | "error"
  // Catch-all for dynamic stage tags (e.g. "analysis_chunk")
  | (string & {});

export interface StageInfo {
  tag: string;
  name: string;
}

export interface DiagramStreamState {
  status: DiagramStreamStatus;
  message?: string;
  // Backward-compat named fields (populated for well-known tags)
  explanation?: string;
  mapping?: string;
  diagram?: string;
  // Dynamic: all stage outputs keyed by stageTag
  stageOutputs?: Record<string, string>;
  // Pipeline metadata from stage_info event
  stageInfo?: StageInfo[];
  totalStages?: number;
  currentStageIndex?: number;
  // Error / fix state
  error?: string;
  errorCode?: string;
  parserError?: string;
  fixAttempt?: number;
  fixMaxAttempts?: number;
  fixDiagramDraft?: string;
}

export interface DiagramStreamMessage {
  status: DiagramStreamStatus;
  message?: string;
  chunk?: string;
  explanation?: string;
  mapping?: string;
  diagram?: string;
  error?: string;
  error_code?: string;
  parser_error?: string;
  fix_attempt?: number;
  fix_max_attempts?: number;
  // Dynamic pipeline fields
  stages?: StageInfo[];
  total_stages?: number;
  stage_index?: number;
}

export interface DiagramCostResponse {
  cost?: string;
  error?: string;
  error_code?: string;
  ok?: boolean;
}

// ── Stream generation request ───────────────────────────────────────

export interface StreamGenerationParams {
  username: string;
  repo: string;
  branch?: string;
}
