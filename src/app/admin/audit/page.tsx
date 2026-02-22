import type { Metadata } from "next";
import { Suspense } from "react";
import { getAuditLog } from "~/app/_actions/admin";

export const metadata: Metadata = {
  title: "Audit Log | Admin | GitDiagram",
  description: "View admin activity history.",
};

function AuditSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 rounded bg-neutral-200 dark:bg-neutral-800" />
      {["a", "b", "c", "d", "e"].map((k) => (
        <div
          key={k}
          className="h-10 rounded bg-neutral-200 dark:bg-neutral-800"
        />
      ))}
    </div>
  );
}

async function AuditContent() {
  const entries = await getAuditLog(100);

  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500 dark:text-neutral-500">
        No activity recorded yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border-[3px] border-black dark:border-neutral-700">
      <table className="w-full text-left text-sm">
        <thead className="border-b-2 border-black bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900">
          <tr>
            <th className="px-4 py-2 font-semibold text-black dark:text-neutral-200">
              #
            </th>
            <th className="px-4 py-2 font-semibold text-black dark:text-neutral-200">
              Action
            </th>
            <th className="px-4 py-2 font-semibold text-black dark:text-neutral-200">
              Details
            </th>
            <th className="px-4 py-2 font-semibold text-black dark:text-neutral-200">
              Changed Fields
            </th>
            <th className="px-4 py-2 font-semibold text-black dark:text-neutral-200">
              Time
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.id}
              className="border-b border-gray-200 last:border-0 dark:border-neutral-800"
            >
              <td className="px-4 py-2 text-gray-400 dark:text-neutral-600">
                {entry.id}
              </td>
              <td className="px-4 py-2 font-medium text-black dark:text-neutral-200">
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono dark:bg-neutral-800">
                  {entry.action}
                </span>
              </td>
              <td className="px-4 py-2 text-gray-600 dark:text-neutral-400">
                {entry.details ?? "—"}
              </td>
              <td className="px-4 py-2 text-gray-500 dark:text-neutral-500">
                {entry.changedFields
                  ? (() => {
                      try {
                        return (JSON.parse(entry.changedFields) as string[]).join(", ");
                      } catch {
                        return entry.changedFields;
                      }
                    })()
                  : "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-gray-500 dark:text-neutral-500">
                {new Date(entry.createdAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminAuditPage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-black dark:text-white">
        Audit Log
      </h1>
      <p className="mb-6 text-sm text-gray-600 dark:text-neutral-400">
        History of admin actions. Most recent entries first.
      </p>
      <Suspense fallback={<AuditSkeleton />}>
        <AuditContent />
      </Suspense>
    </div>
  );
}
