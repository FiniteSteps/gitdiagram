"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  listPromptSets,
  listPromptStages,
  updatePromptStage,
  updatePromptSetMeta,
  updatePromptStageMeta,
  addPromptStage,
  deletePromptStage,
  type PromptSetSummary,
  type PromptStageData,
} from "~/app/_actions/prompts";

export default function PromptSetEditorPage() {
  const params = useParams();
  const setId = Number(params.id);

  const [set, setSet] = useState<PromptSetSummary | null>(null);
  const [stages, setStages] = useState<PromptStageData[]>([]);
  const [loading, setLoading] = useState(true);

  // Editing state
  const [editingMeta, setEditingMeta] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Expanded stage editor
  const [expandedStage, setExpandedStage] = useState<number | null>(null);
  const [stagePromptDraft, setStagePromptDraft] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Add stage
  const [showAddStage, setShowAddStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [newStageTag, setNewStageTag] = useState("");
  const [newStagePrompt, setNewStagePrompt] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const [sets, stagesData] = await Promise.all([
      listPromptSets(),
      listPromptStages(setId),
    ]);
    const found = sets.find((s) => s.id === setId);
    setSet(found ?? null);
    setStages(stagesData);
    if (found) {
      setEditName(found.name);
      setEditDesc(found.description ?? "");
    }
    setLoading(false);
  }, [setId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSaveMeta = async () => {
    setSaving(true);
    await updatePromptSetMeta(setId, {
      name: editName,
      description: editDesc,
    });
    setEditingMeta(false);
    await refresh();
    setSaving(false);
  };

  const handleExpandStage = (stageId: number) => {
    if (expandedStage === stageId) {
      setExpandedStage(null);
      return;
    }
    const stage = stages.find((s) => s.id === stageId);
    if (stage) {
      setStagePromptDraft(stage.systemPrompt);
      setChangeNote("");
      setExpandedStage(stageId);
    }
  };

  const handleSaveStagePrompt = async (stageId: number) => {
    setSaving(true);
    const result = await updatePromptStage(stageId, {
      systemPrompt: stagePromptDraft,
      changeNote: changeNote || undefined,
    });
    if (!result.ok) alert(result.error);
    setExpandedStage(null);
    await refresh();
    setSaving(false);
  };

  const handleDeleteStage = async (stageId: number, stageName: string) => {
    if (!confirm(`Delete stage "${stageName}"? This cannot be undone.`)) return;
    setSaving(true);
    const result = await deletePromptStage(stageId);
    if (!result.ok) alert(result.error);
    await refresh();
    setSaving(false);
  };

  const handleAddStage = async () => {
    if (!newStageName || !newStageTag || !newStagePrompt) {
      alert("All fields are required.");
      return;
    }
    setSaving(true);
    const result = await addPromptStage(setId, {
      stageName: newStageName,
      stageTag: newStageTag,
      systemPrompt: newStagePrompt,
    });
    if (!result.ok) alert(result.error);
    setShowAddStage(false);
    setNewStageName("");
    setNewStageTag("");
    setNewStagePrompt("");
    await refresh();
    setSaving(false);
  };

  const handleMoveStage = async (
    stageId: number,
    _currentOrder: number,
    direction: "up" | "down",
  ) => {
    // Find adjacent stage by sorted array position (handles non-contiguous orders)
    const idx = stages.findIndex((s) => s.id === stageId);
    if (idx < 0) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    const targetStage = stages[targetIdx];
    if (!targetStage) return;
    const currentStage = stages[idx]!;

    setSaving(true);
    await Promise.all([
      updatePromptStageMeta(stageId, { stageOrder: targetStage.stageOrder }),
      updatePromptStageMeta(targetStage.id, { stageOrder: currentStage.stageOrder }),
    ]);
    await refresh();
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-neutral-500">
        Loading prompt set...
      </div>
    );
  }

  if (!set) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500 dark:text-neutral-500">
          Prompt set not found.
        </p>
        <Link
          href="/admin/prompts"
          className="mt-2 inline-block text-sm text-purple-600 underline"
        >
          Back to Prompts
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb / Back */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/admin/prompts"
          className="text-purple-600 hover:underline dark:text-purple-400"
        >
          Prompts
        </Link>
        <span className="text-gray-400 dark:text-neutral-600">/</span>
        <span className="font-medium text-black dark:text-white">
          {set.name}
        </span>
        {set.isActive && (
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800 dark:bg-green-900 dark:text-green-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />{" "}
            Active
          </span>
        )}
      </div>

      {/* Meta section */}
      <div className="rounded-md border-[3px] border-black p-4 dark:border-neutral-700">
        {editingMeta ? (
          <div className="space-y-3">
            <div>
              <span className="mb-1 block text-xs font-bold text-black dark:text-white">
                Name
              </span>
              <input
                className="w-full rounded border-2 border-black px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div>
              <span className="mb-1 block text-xs font-bold text-black dark:text-white">
                Description
              </span>
              <textarea
                className="w-full rounded border-2 border-black px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
                rows={2}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveMeta}
                disabled={saving}
                className="rounded border-2 border-black bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:opacity-50 dark:border-neutral-600 dark:bg-purple-950 dark:text-purple-300"
              >
                Save
              </button>
              <button
                onClick={() => setEditingMeta(false)}
                className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-black dark:text-white">
                {set.name}
              </h2>
              {set.description && (
                <p className="mt-1 text-sm text-gray-600 dark:text-neutral-400">
                  {set.description}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-400 dark:text-neutral-600">
                {set.stageCount} stage{set.stageCount === 1 ? "" : "s"} &middot;
                Created {new Date(set.createdAt).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => setEditingMeta(true)}
              className="rounded border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-gray-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
            >
              Edit Info
            </button>
          </div>
        )}
      </div>

      {/* Stages */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-black dark:text-white">
            Stages
          </h3>
          <button
            onClick={() => setShowAddStage(!showAddStage)}
            className="rounded border-2 border-black bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none dark:border-neutral-600 dark:bg-purple-950 dark:text-purple-300"
          >
            + Add Stage
          </button>
        </div>

        {/* Add stage form */}
        {showAddStage && (
          <div className="rounded-md border-[3px] border-dashed border-purple-400 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-950/30">
            <h4 className="mb-3 text-sm font-bold text-black dark:text-white">
              New Stage
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="mb-1 block text-xs font-bold text-black dark:text-white">
                  Stage Name
                </span>
                <input
                  className="w-full rounded border-2 border-black px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
                  placeholder="e.g. Code Analysis"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                />
              </div>
              <div>
                <span className="mb-1 block text-xs font-bold text-black dark:text-white">
                  Stage Tag
                </span>
                <input
                  className="w-full rounded border-2 border-black px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
                  placeholder="e.g. analysis (used in SSE events)"
                  value={newStageTag}
                  onChange={(e) => setNewStageTag(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3">
              <span className="mb-1 block text-xs font-bold text-black dark:text-white">
                System Prompt
              </span>
              <textarea
                className="w-full rounded border-2 border-black px-3 py-2 font-mono text-xs dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
                rows={8}
                placeholder="Enter the system prompt..."
                value={newStagePrompt}
                onChange={(e) => setNewStagePrompt(e.target.value)}
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleAddStage}
                disabled={saving}
                className="rounded border-2 border-black bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:opacity-50 dark:border-neutral-600 dark:bg-purple-950 dark:text-purple-300"
              >
                Add Stage
              </button>
              <button
                onClick={() => setShowAddStage(false)}
                className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Stage list */}
        {stages.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-neutral-500">
            No stages yet. Add one above.
          </p>
        ) : (
          <div className="space-y-2">
            {stages.map((stage, idx) => (
              <div
                key={stage.id}
                className="rounded-md border-[3px] border-black dark:border-neutral-700"
              >
                {/* Stage header */}
                <div
                  className="flex cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-neutral-900"
                  onClick={() => handleExpandStage(stage.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-black bg-purple-100 text-xs font-bold text-purple-800 dark:border-neutral-600 dark:bg-purple-950 dark:text-purple-300">
                      {stage.stageOrder}
                    </span>
                    <div>
                      <span className="font-bold text-black dark:text-white">
                        {stage.stageName}
                      </span>
                      <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-600 dark:bg-neutral-800 dark:text-neutral-400">
                        {stage.stageTag}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Move buttons */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveStage(stage.id, stage.stageOrder, "up");
                      }}
                      disabled={idx === 0 || saving}
                      className="rounded border border-gray-300 px-1.5 py-0.5 text-xs disabled:opacity-30 dark:border-neutral-600"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveStage(stage.id, stage.stageOrder, "down");
                      }}
                      disabled={idx === stages.length - 1 || saving}
                      className="rounded border border-gray-300 px-1.5 py-0.5 text-xs disabled:opacity-30 dark:border-neutral-600"
                      title="Move down"
                    >
                      ↓
                    </button>
                    <Link
                      href={`/admin/prompts/${setId}/history?stage=${stage.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-gray-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
                    >
                      History
                    </Link>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteStage(stage.id, stage.stageName);
                      }}
                      disabled={saving}
                      className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900"
                    >
                      Delete
                    </button>
                    <span className="text-xs text-gray-400">
                      {expandedStage === stage.id ? "▲" : "▼"}
                    </span>
                  </div>
                </div>

                {/* Expanded editor */}
                {expandedStage === stage.id && (
                  <div className="border-t-[3px] border-black bg-gray-50 p-4 dark:border-neutral-700 dark:bg-neutral-900">
                    <span className="mb-1 block text-xs font-bold text-black dark:text-white">
                      System Prompt
                    </span>
                    <textarea
                      className="w-full rounded border-2 border-black px-3 py-2 font-mono text-xs leading-relaxed dark:border-neutral-600 dark:bg-neutral-950 dark:text-white"
                      rows={16}
                      value={stagePromptDraft}
                      onChange={(e) => setStagePromptDraft(e.target.value)}
                    />
                    <div className="mt-3">
                      <span className="mb-1 block text-xs font-bold text-black dark:text-white">
                        Change Note (optional)
                      </span>
                      <input
                        className="w-full rounded border-2 border-black px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-950 dark:text-white"
                        placeholder="What changed and why?"
                        value={changeNote}
                        onChange={(e) => setChangeNote(e.target.value)}
                      />
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => handleSaveStagePrompt(stage.id)}
                        disabled={saving}
                        className="rounded border-2 border-black bg-purple-100 px-4 py-1.5 text-xs font-bold text-purple-800 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:opacity-50 dark:border-neutral-600 dark:bg-purple-950 dark:text-purple-300"
                      >
                        Save Prompt
                      </button>
                      <button
                        onClick={() => setExpandedStage(null)}
                        className="rounded border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
                      >
                        Cancel
                      </button>
                      <span className="text-xs text-gray-400 dark:text-neutral-600">
                        {stagePromptDraft.length.toLocaleString()} chars
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
