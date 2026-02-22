"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  listPromptSets,
  deletePromptSet,
  activatePromptSet,
  duplicatePromptSet,
  type PromptSetSummary,
} from "~/app/_actions/prompts";

export default function PromptsPage() {
  const [sets, setSets] = useState<PromptSetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await listPromptSets();
    setSets(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleActivate = async (id: number) => {
    setActionLoading(id);
    const result = await activatePromptSet(id);
    if (!result.ok) alert(result.error);
    await refresh();
    setActionLoading(null);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete prompt set "${name}"? This cannot be undone.`)) return;
    setActionLoading(id);
    const result = await deletePromptSet(id);
    if (!result.ok) alert(result.error);
    await refresh();
    setActionLoading(null);
  };

  const handleDuplicate = async (id: number, name: string) => {
    const newName = prompt("Name for the duplicate:", `${name} (copy)`);
    if (!newName) return;
    setActionLoading(id);
    const result = await duplicatePromptSet(id, newName);
    if (!result.ok) alert(result.error);
    await refresh();
    setActionLoading(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">
            Prompt Management
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-neutral-400">
            Create and manage prompt sets for diagram generation. The active set
            is used for all new generations.
          </p>
        </div>
        <Link
          href="/admin/prompts/new"
          className="rounded-md border-[3px] border-black bg-purple-100 px-4 py-2 text-sm font-bold text-purple-800 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:border-neutral-600 dark:bg-purple-950 dark:text-purple-300"
        >
          + New Prompt Set
        </Link>
      </div>

      {/* Table */}
      {loading && (
        <div className="py-12 text-center text-gray-500 dark:text-neutral-500">
          Loading prompt sets...
        </div>
      )}
      {!loading && sets.length === 0 && (
        <div className="py-12 text-center text-gray-500 dark:text-neutral-500">
          No prompt sets found.
        </div>
      )}
      {!loading && sets.length > 0 && (
        <div className="overflow-hidden rounded-md border-[3px] border-black dark:border-neutral-700">
          <table className="w-full text-left text-sm">
            <thead className="border-b-[3px] border-black bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-3 font-bold text-black dark:text-white">
                  Name
                </th>
                <th className="px-4 py-3 font-bold text-black dark:text-white">
                  Stages
                </th>
                <th className="px-4 py-3 font-bold text-black dark:text-white">
                  Status
                </th>
                <th className="px-4 py-3 font-bold text-black dark:text-white">
                  Created
                </th>
                <th className="px-4 py-3 text-right font-bold text-black dark:text-white">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
              {sets.map((set) => (
                <tr
                  key={set.id}
                  className="transition-colors hover:bg-gray-50 dark:hover:bg-neutral-900"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/prompts/${set.id}`}
                      className="font-medium text-purple-700 underline decoration-purple-300 hover:decoration-purple-600 dark:text-purple-400 dark:decoration-purple-700 dark:hover:decoration-purple-400"
                    >
                      {set.name}
                    </Link>
                    {set.description && (
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-neutral-500">
                        {set.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-neutral-400">
                    {set.stageCount} stage{set.stageCount === 1 ? "" : "s"}
                  </td>
                  <td className="px-4 py-3">
                    {set.isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-800 dark:bg-green-900 dark:text-green-300">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />{" "}
                        Active
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-neutral-600">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-neutral-500">
                    {new Date(set.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/prompts/${set.id}`}
                        className="rounded border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-gray-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/admin/prompts/${set.id}/history`}
                        className="rounded border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-gray-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
                      >
                        History
                      </Link>
                      {!set.isActive && (
                        <button
                          onClick={() => handleActivate(set.id)}
                          disabled={actionLoading === set.id}
                          className="rounded border border-green-300 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 dark:border-green-800 dark:bg-green-950 dark:text-green-400 dark:hover:bg-green-900"
                        >
                          Activate
                        </button>
                      )}
                      <button
                        onClick={() => handleDuplicate(set.id, set.name)}
                        disabled={actionLoading === set.id}
                        className="rounded border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-gray-100 disabled:opacity-50 dark:border-neutral-600 dark:hover:bg-neutral-800"
                      >
                        Duplicate
                      </button>
                      {!set.isActive && (
                        <button
                          onClick={() => handleDelete(set.id, set.name)}
                          disabled={actionLoading === set.id}
                          className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
