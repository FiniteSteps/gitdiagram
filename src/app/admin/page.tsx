import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import {
  getAdminDashboardStats,
  getAuditLog,
} from "~/app/_actions/admin";

export const metadata: Metadata = {
  title: "Dashboard | Admin | GitDiagram",
  description: "Admin dashboard overview.",
};

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["a", "b", "c", "d"].map((k) => (
          <div
            key={k}
            className="h-24 rounded-lg border-2 border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
          />
        ))}
      </div>
      <div className="h-64 rounded-lg border-2 border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" />
    </div>
  );
}

async function DashboardContent() {
  const [stats, recentActivity] = await Promise.all([
    getAdminDashboardStats(),
    getAuditLog(10),
  ]);

  const cards = [
    {
      label: "LLM Provider",
      value: stats.provider === "azure_openai" ? "Azure OpenAI" : "OpenAI",
      color: "text-purple-600 dark:text-purple-400",
    },
    {
      label: "Model",
      value: stats.model ?? "Not set",
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "GitHub PAT",
      value: stats.hasGithubPat ? "Configured" : "Not set",
      color: stats.hasGithubPat
        ? "text-green-600 dark:text-green-400"
        : "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Cached Diagrams",
      value: String(stats.totalCachedDiagrams),
      color: "text-black dark:text-white",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border-[3px] border-black bg-white p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:border-neutral-700 dark:bg-neutral-900 dark:shadow-[3px_3px_0px_0px_rgba(64,64,64,1)]"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-neutral-500">
              {card.label}
            </p>
            <p className={`mt-1 text-xl font-bold ${card.color}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/settings"
          className="rounded-md border-2 border-black px-4 py-2 text-sm font-medium text-black transition-all hover:bg-gray-100 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          ⚙️ Settings
        </Link>
        <Link
          href="/admin/cache"
          className="rounded-md border-2 border-black px-4 py-2 text-sm font-medium text-black transition-all hover:bg-gray-100 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          🗄️ Manage Cache
        </Link>
        <Link
          href="/admin/audit"
          className="rounded-md border-2 border-black px-4 py-2 text-sm font-medium text-black transition-all hover:bg-gray-100 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          📋 Full Audit Log
        </Link>
      </div>

      {/* Recent activity */}
      <div>
        <h2 className="mb-3 text-lg font-bold text-black dark:text-white">
          Recent Activity
        </h2>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-neutral-500">
            No activity recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border-[3px] border-black dark:border-neutral-700">
            <table className="w-full text-left text-sm">
              <thead className="border-b-2 border-black bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-2 font-semibold text-black dark:text-neutral-200">
                    Action
                  </th>
                  <th className="px-4 py-2 font-semibold text-black dark:text-neutral-200">
                    Details
                  </th>
                  <th className="px-4 py-2 font-semibold text-black dark:text-neutral-200">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-gray-200 last:border-0 dark:border-neutral-800"
                  >
                    <td className="px-4 py-2 font-medium text-black dark:text-neutral-200">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs dark:bg-neutral-800">
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-neutral-400">
                      {entry.details ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-gray-500 dark:text-neutral-500">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-black dark:text-white">
        Dashboard
      </h1>
      <p className="mb-6 text-sm text-gray-600 dark:text-neutral-400">
        Overview of your GitDiagram instance.
      </p>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
