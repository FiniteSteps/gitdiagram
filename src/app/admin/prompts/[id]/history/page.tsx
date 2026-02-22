"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getPromptSetHistory,
  getStageHistory,
  listPromptStages,
  listPromptSets,
  revertStageToVersion,
  type PromptHistoryEntry,
  type PromptSetSummary,
  type PromptStageData,
} from "~/app/_actions/prompts";

export default function PromptHistoryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const setId = Number(params.id);
  const filterStageId = searchParams.get("stage")
    ? Number(searchParams.get("stage"))
    : null;

  const [set, setSet] = useState<PromptSetSummary | null>(null);
  const [stages, setStages] = useState<PromptStageData[]>([]);
  const [history, setHistory] = useState<PromptHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);
  const [selectedStage, setSelectedStage] = useState<number | null>(
    filterStageId,
  );
  const [reverting, setReverting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [sets, stagesData] = await Promise.all([
      listPromptSets(),
      listPromptStages(setId),
    ]);
    setSet(sets.find((s) => s.id === setId) ?? null);
    setStages(stagesData);

    // Fetch history
    const historyData = selectedStage
      ? await getStageHistory(selectedStage)
      : await getPromptSetHistory(setId);
    setHistory(historyData);
    setLoading(false);
  }, [setId, selectedStage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRevert = async (entry: PromptHistoryEntry) => {
    if (
      !confirm(
        `Revert stage "${entry.stageName}" to version ${entry.version}? This creates a new version with the old prompt.`,
      )
    )
      return;
    setReverting(true);
    const result = await revertStageToVersion(entry.promptStageId, entry.id);
    if (!result.ok) alert(result.error);
    await refresh();
    setReverting(false);
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-neutral-500">
        Loading history...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/admin/prompts"
          className="text-purple-600 hover:underline dark:text-purple-400"
        >
          Prompts
        </Link>
        <span className="text-gray-400 dark:text-neutral-600">/</span>
        <Link
          href={`/admin/prompts/${setId}`}
          className="text-purple-600 hover:underline dark:text-purple-400"
        >
          {set?.name ?? `Set #${setId}`}
        </Link>
        <span className="text-gray-400 dark:text-neutral-600">/</span>
        <span className="font-medium text-black dark:text-white">History</span>
      </div>

      {/* Stage filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-black dark:text-white">
          Filter by stage:
        </span>
        <select
          className="rounded border-2 border-black px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
          value={selectedStage ?? ""}
          onChange={(e) =>
            setSelectedStage(e.target.value ? Number(e.target.value) : null)
          }
        >
          <option value="">All stages</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.stageOrder}. {s.stageName}
            </option>
          ))}
        </select>
      </div>

      {/* History list */}
      {history.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-neutral-500">
          No history entries found.
        </p>
      ) : (
        <div className="space-y-2">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="rounded-md border-[3px] border-black dark:border-neutral-700"
            >
              {/* Entry header */}
              <div
                className="flex cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-neutral-900"
                onClick={() =>
                  setExpandedEntry(
                    expandedEntry === entry.id ? null : entry.id,
                  )
                }
              >
                <div className="flex items-center gap-3">
                  <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                    v{entry.version}
                  </span>
                  <span className="font-medium text-black dark:text-white">
                    {entry.stageName}
                  </span>
                  {entry.changeNote && (
                    <span className="text-xs text-gray-500 dark:text-neutral-500">
                      — {entry.changeNote}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 dark:text-neutral-600">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRevert(entry);
                    }}
                    disabled={reverting}
                    className="rounded border border-orange-300 bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-50 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-400 dark:hover:bg-orange-900"
                  >
                    Revert
                  </button>
                  <span className="text-xs text-gray-400">
                    {expandedEntry === entry.id ? "▲" : "▼"}
                  </span>
                </div>
              </div>

              {/* Expanded prompt content */}
              {expandedEntry === entry.id && (
                <div className="border-t-[3px] border-black bg-gray-50 p-4 dark:border-neutral-700 dark:bg-neutral-900">
                  <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap rounded border border-gray-200 bg-white p-3 font-mono text-xs leading-relaxed text-black dark:border-neutral-700 dark:bg-neutral-950 dark:text-white">
                    {entry.systemPrompt}
                  </pre>
                  <p className="mt-2 text-xs text-gray-400 dark:text-neutral-600">
                    {entry.systemPrompt.length.toLocaleString()} characters
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
