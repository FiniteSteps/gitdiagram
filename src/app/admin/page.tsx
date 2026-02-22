import type { Metadata } from "next";
import AdminSettingsForm from "./admin-settings-form";
import { getAdminSettings } from "~/app/_actions/admin";

export const metadata: Metadata = {
  title: "Admin Settings | GitDiagram",
  description: "Manage server-side LLM and GitHub configuration.",
};

export default async function AdminPage() {
  const settings = await getAdminSettings();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-2 text-2xl font-bold text-black dark:text-white">
        Admin Settings
      </h1>
      <p className="mb-8 text-sm text-gray-600 dark:text-neutral-400">
        Server-side configuration for LLM providers and GitHub access. These
        values are stored in the database and used by all diagram generation
        requests.
      </p>
      <AdminSettingsForm initial={settings} />
    </div>
  );
}
