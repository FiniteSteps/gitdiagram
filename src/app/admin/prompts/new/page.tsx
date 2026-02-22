"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPromptSet } from "~/app/_actions/prompts";

interface StageDraft {
  _key: number;
  stageName: string;
  stageTag: string;
  systemPrompt: string;
}

const STAGE_TAG_SUGGESTIONS = [
  "explanation",
  "mapping",
  "diagram",
  "fix",
  "analysis",
  "review",
  "refine",
];

export default function NewPromptSetPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stages, setStages] = useState<StageDraft[]>([
    { _key: 0, stageName: "", stageTag: "", systemPrompt: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [expandedStage, setExpandedStage] = useState<number>(0);
  const [nextKey, setNextKey] = useState(1);

  const addStage = () => {
    setStages([...stages, { _key: nextKey, stageName: "", stageTag: "", systemPrompt: "" }]);
    setExpandedStage(stages.length);
    setNextKey(nextKey + 1);
  };

  const removeStage = (idx: number) => {
    if (stages.length <= 1) return;
    setStages(stages.filter((_, i) => i !== idx));
    if (expandedStage >= stages.length - 1) {
      setExpandedStage(Math.max(0, stages.length - 2));
    }
  };

  const updateStage = (idx: number, field: keyof StageDraft, value: string) => {
    setStages(stages.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      alert("Name is required.");
      return;
    }
    const validStages = stages.filter(
      (s) => s.stageName && s.stageTag && s.systemPrompt,
    );
    if (validStages.length === 0) {
      alert("At least one complete stage is required.");
      return;
    }

    setSaving(true);
    const result = await createPromptSet({
      name: name.trim(),
      description: description.trim() || undefined,
      stages: validStages,
    });

    if (result.ok && result.id) {
      router.push(`/admin/prompts/${result.id}`);
    } else {
      alert(result.error ?? "Failed to create prompt set.");
      setSaving(false);
    }
  };

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
        <span className="font-medium text-black dark:text-white">
          New Prompt Set
        </span>
      </div>

      {/* Meta */}
      <div className="rounded-md border-[3px] border-black p-4 dark:border-neutral-700">
        <h2 className="mb-3 text-lg font-bold text-black dark:text-white">
          Prompt Set Details
        </h2>
        <div className="space-y-3">
          <div>
            <span className="mb-1 block text-xs font-bold text-black dark:text-white">
              Name *
            </span>
            <input
              className="w-full rounded border-2 border-black px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
              placeholder='e.g. "5-stage detailed pipeline"'
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <span className="mb-1 block text-xs font-bold text-black dark:text-white">
              Description
            </span>
            <textarea
              className="w-full rounded border-2 border-black px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
              rows={2}
              placeholder="Optional description of this prompt set..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Stages */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-black dark:text-white">
            Stages ({stages.length})
          </h3>
          <button
            onClick={addStage}
            className="rounded border-2 border-black bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none dark:border-neutral-600 dark:bg-purple-950 dark:text-purple-300"
          >
            + Add Stage
          </button>
        </div>

        {stages.map((stage, idx) => (
          <div
            key={stage._key}
            className="rounded-md border-[3px] border-black dark:border-neutral-700"
          >
            {/* Stage header */}
            <div
              className="flex cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-neutral-900"
              onClick={() =>
                setExpandedStage(expandedStage === idx ? -1 : idx)
              }
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-black bg-purple-100 text-xs font-bold text-purple-800 dark:border-neutral-600 dark:bg-purple-950 dark:text-purple-300">
                  {idx + 1}
                </span>
                <span className="font-medium text-black dark:text-white">
                  {stage.stageName || `Stage ${idx + 1}`}
                </span>
                {stage.stageTag && (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-600 dark:bg-neutral-800 dark:text-neutral-400">
                    {stage.stageTag}
                  </span>
                )}
                {(!stage.stageName || !stage.stageTag || !stage.systemPrompt) && (
                  <span className="text-[10px] text-orange-500">
                    (incomplete)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {stages.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeStage(idx);
                    }}
                    className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900"
                  >
                    Remove
                  </button>
                )}
                <span className="text-xs text-gray-400">
                  {expandedStage === idx ? "▲" : "▼"}
                </span>
              </div>
            </div>

            {/* Stage editor */}
            {expandedStage === idx && (
              <div className="border-t-[3px] border-black bg-gray-50 p-4 dark:border-neutral-700 dark:bg-neutral-900">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="mb-1 block text-xs font-bold text-black dark:text-white">
                      Stage Name *
                    </span>
                    <input
                      className="w-full rounded border-2 border-black px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-950 dark:text-white"
                      placeholder="e.g. Explanation"
                      value={stage.stageName}
                      onChange={(e) =>
                        updateStage(idx, "stageName", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <span className="mb-1 block text-xs font-bold text-black dark:text-white">
                      Stage Tag *
                    </span>
                    <input
                      className="w-full rounded border-2 border-black px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-950 dark:text-white"
                      placeholder="e.g. explanation"
                      value={stage.stageTag}
                      onChange={(e) =>
                        updateStage(idx, "stageTag", e.target.value)
                      }
                    />
                    <div className="mt-1 flex flex-wrap gap-1">
                      {STAGE_TAG_SUGGESTIONS.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => updateStage(idx, "stageTag", tag)}
                          className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-purple-100 hover:text-purple-800 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-purple-950 dark:hover:text-purple-300"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <span className="mb-1 block text-xs font-bold text-black dark:text-white">
                    System Prompt *
                  </span>
                  <textarea
                    className="w-full rounded border-2 border-black px-3 py-2 font-mono text-xs leading-relaxed dark:border-neutral-600 dark:bg-neutral-950 dark:text-white"
                    rows={12}
                    placeholder="Enter the system prompt for this stage..."
                    value={stage.systemPrompt}
                    onChange={(e) =>
                      updateStage(idx, "systemPrompt", e.target.value)
                    }
                  />
                  <p className="mt-1 text-xs text-gray-400 dark:text-neutral-600">
                    {stage.systemPrompt.length.toLocaleString()} characters
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleCreate}
          disabled={saving}
          className="rounded-md border-[3px] border-black bg-purple-100 px-6 py-2 text-sm font-bold text-purple-800 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50 dark:border-neutral-600 dark:bg-purple-950 dark:text-purple-300"
        >
          {saving ? "Creating..." : "Create Prompt Set"}
        </button>
        <Link
          href="/admin/prompts"
          className="text-sm text-gray-500 hover:text-purple-600 dark:text-neutral-500 dark:hover:text-purple-400"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
