"use client";

import { useState, useCallback } from "react";
import {
  deleteCacheEntry,
  purgeAllCache,
  type CacheEntry,
} from "~/app/_actions/admin";

export default function CacheTable({
  initialEntries,
}: Readonly<{ initialEntries: CacheEntry[] }>) {
  const [entries, setEntries] = useState(initialEntries);
  const [filter, setFilter] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filtered = filter
    ? entries.filter(
        (e) =>
          e.username.toLowerCase().includes(filter.toLowerCase()) ||
          e.repo.toLowerCase().includes(filter.toLowerCase()),
      )
    : entries;

  const handleDelete = useCallback(
    async (username: string, repo: string, branch: string) => {
      const key = `${username}/${repo}${branch ? `@${branch}` : ""}`;
      setDeleting(key);
      setErrorMsg(null);
      try {
        const result = await deleteCacheEntry(username, repo, branch);
        if (result.ok) {
          setEntries((prev) =>
            prev.filter(
              (e) =>
                !(e.username === username && e.repo === repo && e.branch === branch),
            ),
          );
        } else {
          setErrorMsg(result.error ?? `Failed to delete ${key}`);
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Delete failed");
      }
      setDeleting(null);
    },
    [],
  );

  const handlePurge = useCallback(async () => {
    setShowPurgeConfirm(false);
    setPurging(true);
    setErrorMsg(null);
    try {
      const result = await purgeAllCache();
      if (result.ok) {
        setEntries([]);
      } else {
        setErrorMsg(result.error ?? "Failed to purge cache");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Purge failed");
    }
    setPurging(false);
  }, []);

  const btnClass =
    "rounded-md border-2 border-black px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40";

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {errorMsg && (
        <div className="flex items-center justify-between rounded-md border-2 border-red-400 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-600 dark:bg-red-950 dark:text-red-300">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="ml-4 text-xs font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by username or repo…"
          className="w-64 rounded-md border-2 border-black px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
        />
        <span className="text-xs text-gray-500 dark:text-neutral-500">
          {filtered.length} of {entries.length} entries
        </span>
        <div className="ml-auto">
          <button
            type="button"
            disabled={entries.length === 0 || purging}
            onClick={() => setShowPurgeConfirm(true)}
            className={`${btnClass} border-red-500 text-red-600 hover:bg-red-50 dark:border-red-500 dark:text-red-400 dark:hover:bg-red-950`}
          >
            {purging ? "Purging…" : "Purge All"}
          </button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-neutral-500">
          {entries.length === 0 ? "No cached diagrams." : "No matching entries."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border-[3px] border-black dark:border-neutral-700">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-black bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-2 font-semibold text-black dark:text-neutral-200">
                  Repository
                </th>
                <th className="px-4 py-2 font-semibold text-black dark:text-neutral-200">
                  Created
                </th>
                <th className="px-4 py-2 font-semibold text-black dark:text-neutral-200">
                  Updated
                </th>
                <th className="px-4 py-2 text-right font-semibold text-black dark:text-neutral-200">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => {
                const key = `${entry.username}/${entry.repo}${entry.branch ? `@${entry.branch}` : ""}`;
                const branchParam = entry.branch
                  ? `?branch=${encodeURIComponent(entry.branch)}`
                  : "";
                return (
                  <tr
                    key={key}
                    className="border-b border-gray-200 last:border-0 dark:border-neutral-800"
                  >
                    <td className="px-4 py-2 font-medium text-black dark:text-neutral-200">
                      <a
                        href={`/${entry.username}/${entry.repo}${branchParam}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-600 hover:underline dark:text-[hsl(var(--neo-button))]"
                      >
                        {entry.username}/{entry.repo}
                        {entry.branch && (
                          <span className="ml-1 text-xs text-gray-500 dark:text-neutral-500">
                            @{entry.branch}
                          </span>
                        )}
                      </a>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-500 dark:text-neutral-500">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-500 dark:text-neutral-500">
                      {entry.updatedAt
                        ? new Date(entry.updatedAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        disabled={deleting === key}
                        onClick={() =>
                          void handleDelete(
                            entry.username,
                            entry.repo,
                            entry.branch,
                          )
                        }
                        className={`${btnClass} text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950`}
                      >
                        {deleting === key ? "…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Purge confirmation */}
      {showPurgeConfirm && (
        <dialog
          open
          className="fixed inset-0 z-50 flex items-center justify-center bg-transparent"
        >
          <div className="rounded-lg border-[3px] border-black bg-white p-6 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
            <h3 className="mb-2 text-lg font-bold text-black dark:text-white">
              Purge All Cache
            </h3>
            <p className="mb-6 text-sm text-gray-600 dark:text-neutral-400">
              This will permanently delete{" "}
              <strong>{entries.length}</strong> cached diagram
              {entries.length === 1 ? "" : "s"}. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPurgeConfirm(false)}
                className={`${btnClass} text-black hover:bg-gray-100 dark:text-neutral-200 dark:hover:bg-neutral-800`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handlePurge()}
                className={`${btnClass} border-red-500 bg-red-500 text-white hover:bg-red-600`}
              >
                Purge All
              </button>
            </div>
          </div>
          <button
            type="button"
            className="fixed inset-0 -z-10 cursor-default bg-black/40"
            onClick={() => setShowPurgeConfirm(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowPurgeConfirm(false);
            }}
            tabIndex={-1}
            aria-label="Close dialog"
          />
        </dialog>
      )}
    </div>
  );
}
