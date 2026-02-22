"use client";

import { useState, useCallback } from "react";
import {
  deleteCacheEntry,
  purgeAllCache,
  listVersionsForRepo,
  deleteVersion,
  updateVersionDiagram,
  type CacheEntry,
  type VersionEntry,
} from "~/app/_actions/admin";

// ── Inline version-row editor ───────────────────────────────────────
function VersionRow({
  v,
  entry,
  btnClass,
  onDeleted,
  onEdited,
}: Readonly<{
  v: VersionEntry;
  entry: CacheEntry;
  btnClass: string;
  onDeleted: (id: number) => void;
  onEdited: (id: number, diagram: string) => void;
}>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(v.diagram);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const result = await updateVersionDiagram(
      v.id,
      entry.username,
      entry.repo,
      entry.branch,
      draft,
    );
    if (result.ok) {
      setEditing(false);
      onEdited(v.id, draft);
    } else {
      setError(result.error ?? "Save failed");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    const result = await deleteVersion(
      v.id,
      entry.username,
      entry.repo,
      entry.branch,
    );
    if (result.ok) {
      onDeleted(v.id);
    } else {
      setError(result.error ?? "Delete failed");
      setDeleting(false);
    }
  };

  const viewUrl = `/${entry.username}/${entry.repo}?${new URLSearchParams({
    ...(entry.branch ? { branch: entry.branch } : {}),
    version: String(v.version),
  }).toString()}`;

  return (
    <div className="border-b border-gray-100 px-4 py-2 last:border-0 dark:border-neutral-800">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            v{v.version}
          </span>
          <span className="text-xs text-gray-500 dark:text-neutral-500">
            {new Date(v.createdAt).toLocaleString()}
          </span>
          {v.usedOwnKey && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              own key
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${btnClass} text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-950`}
          >
            View
          </a>
          <button
            type="button"
            onClick={() => {
              setEditing((prev) => !prev);
              setDraft(v.diagram);
              setError(null);
            }}
            className={`${btnClass} text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950`}
          >
            {editing ? "Cancel" : "Edit"}
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={() => void handleDelete()}
            className={`${btnClass} text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950`}
          >
            {deleting ? "…" : "Delete"}
          </button>
        </div>
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      {editing && (
        <div className="mt-2 space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            className="w-full rounded-md border-2 border-black p-2 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving || draft === v.diagram}
              onClick={() => void handleSave()}
              className={`${btnClass} bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40`}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main table ──────────────────────────────────────────────────────
export default function CacheTable({
  initialEntries,
}: Readonly<{ initialEntries: CacheEntry[] }>) {
  const [entries, setEntries] = useState(initialEntries);
  const [filter, setFilter] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Expandable version state per repo key
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  const keyFor = (e: { username: string; repo: string; branch: string }) =>
    `${e.username}/${e.repo}${e.branch ? `@${e.branch}` : ""}`;

  const filtered = filter
    ? entries.filter(
        (e) =>
          e.username.toLowerCase().includes(filter.toLowerCase()) ||
          e.repo.toLowerCase().includes(filter.toLowerCase()),
      )
    : entries;

  const toggleExpand = useCallback(
    async (entry: CacheEntry) => {
      const key = keyFor(entry);
      if (expandedKey === key) {
        setExpandedKey(null);
        setVersions([]);
        return;
      }
      setExpandedKey(key);
      setVersionsLoading(true);
      const list = await listVersionsForRepo(
        entry.username,
        entry.repo,
        entry.branch,
      );
      setVersions(list);
      setVersionsLoading(false);
    },
    [expandedKey],
  );

  const handleVersionDeleted = useCallback(
    (id: number) => {
      setVersions((prev) => {
        const next = prev.filter((v) => v.id !== id);
        // If no versions remain, collapse and update parent entry count
        if (next.length === 0) {
          setExpandedKey(null);
          // The cache entry itself may have been deleted by the action
          setEntries((prevEntries) =>
            prevEntries
              .map((e) =>
                keyFor(e) === expandedKey
                  ? { ...e, versionCount: 0 }
                  : e,
              )
              .filter((e) => e.versionCount > 0),
          );
        } else {
          // Decrement version count
          setEntries((prevEntries) =>
            prevEntries.map((e) =>
              keyFor(e) === expandedKey
                ? { ...e, versionCount: next.length }
                : e,
            ),
          );
        }
        return next;
      });
    },
    [expandedKey],
  );

  const handleVersionEdited = useCallback(
    (id: number, newDiagram: string) => {
      setVersions((prev) =>
        prev.map((v) => (v.id === id ? { ...v, diagram: newDiagram } : v)),
      );
    },
    [],
  );

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
                !(
                  e.username === username &&
                  e.repo === repo &&
                  e.branch === branch
                ),
            ),
          );
          if (expandedKey === key) {
            setExpandedKey(null);
            setVersions([]);
          }
        } else {
          setErrorMsg(result.error ?? `Failed to delete ${key}`);
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Delete failed");
      }
      setDeleting(null);
    },
    [expandedKey],
  );

  const handlePurge = useCallback(async () => {
    setShowPurgeConfirm(false);
    setPurging(true);
    setErrorMsg(null);
    try {
      const result = await purgeAllCache();
      if (result.ok) {
        setEntries([]);
        setExpandedKey(null);
        setVersions([]);
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
          {entries.length === 0
            ? "No cached diagrams."
            : "No matching entries."}
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
                  Versions
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
                const key = keyFor(entry);
                const branchParam = entry.branch
                  ? `?branch=${encodeURIComponent(entry.branch)}`
                  : "";
                const isExpanded = expandedKey === key;

                return (
                  <Fragment key={key}>
                    <tr
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
                      <td className="px-4 py-2 text-center">
                        {entry.versionCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => void toggleExpand(entry)}
                            className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50"
                          >
                            {entry.versionCount}
                            <span className="text-[10px]">
                              {isExpanded ? "▲" : "▼"}
                            </span>
                          </button>
                        ) : (
                          <span className="text-xs text-gray-500 dark:text-neutral-500">
                            —
                          </span>
                        )}
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
                          {deleting === key ? "…" : "Delete All"}
                        </button>
                      </td>
                    </tr>
                    {/* Expanded version list */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className="bg-gray-50 p-0 dark:bg-neutral-900/50">
                          {versionsLoading ? (
                            <p className="px-6 py-3 text-xs text-gray-500 dark:text-neutral-500">
                              Loading versions…
                            </p>
                          ) : versions.length === 0 ? (
                            <p className="px-6 py-3 text-xs text-gray-500 dark:text-neutral-500">
                              No version history found.
                            </p>
                          ) : (
                            <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                              {versions.map((v) => (
                                <VersionRow
                                  key={v.id}
                                  v={v}
                                  entry={entry}
                                  btnClass={btnClass}
                                  onDeleted={handleVersionDeleted}
                                  onEdited={handleVersionEdited}
                                />
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
              {entries.length === 1 ? "" : "s"} and all version history. This
              cannot be undone.
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

// Need Fragment for mapping table rows
import { Fragment } from "react";
