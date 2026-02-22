import type { Metadata } from "next";
import { Suspense } from "react";
import AdminSettingsForm from "../admin-settings-form";
import { getAdminSettings } from "~/app/_actions/admin";

export const metadata: Metadata = {
  title: "Settings | Admin | GitDiagram",
  description: "Manage server-side LLM and GitHub configuration.",
};

function SettingsSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-6 w-40 rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="space-y-3">
        <div className="h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="flex gap-3">
          <div className="h-10 w-24 rounded-md bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-10 w-32 rounded-md bg-neutral-200 dark:bg-neutral-800" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-4 w-28 rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-10 w-full rounded-md bg-neutral-200 dark:bg-neutral-800" />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-10 w-full rounded-md bg-neutral-200 dark:bg-neutral-800" />
      </div>
      <div className="h-10 w-32 rounded-md bg-neutral-200 dark:bg-neutral-800" />
    </div>
  );
}

async function SettingsContent() {
  const settings = await getAdminSettings();
  return <AdminSettingsForm initial={settings} />;
}

export default function AdminSettingsPage() {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-black dark:text-white">
        Settings
      </h1>
      <p className="mb-8 text-sm text-gray-600 dark:text-neutral-400">
        Server-side configuration for LLM providers and GitHub access. These
        values are stored in the database and used by all diagram generation
        requests.
      </p>
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}
