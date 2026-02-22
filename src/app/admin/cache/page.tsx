import type { Metadata } from "next";
import { Suspense } from "react";
import { listCachedDiagrams } from "~/app/_actions/admin";
import CacheTable from "./cache-table";

export const metadata: Metadata = {
  title: "Cache | Admin | GitDiagram",
  description: "Manage cached diagrams.",
};

function CacheSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-64 rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="h-64 rounded-lg border-2 border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" />
    </div>
  );
}

async function CacheContent() {
  const entries = await listCachedDiagrams();
  return <CacheTable initialEntries={entries} />;
}

export default function AdminCachePage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-black dark:text-white">
        Cache Management
      </h1>
      <p className="mb-6 text-sm text-gray-600 dark:text-neutral-400">
        View and manage cached diagrams. Deleting a cache entry will cause the
        diagram to be regenerated on the next visit.
      </p>
      <Suspense fallback={<CacheSkeleton />}>
        <CacheContent />
      </Suspense>
    </div>
  );
}
