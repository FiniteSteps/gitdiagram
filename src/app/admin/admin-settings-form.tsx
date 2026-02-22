"use client";

import { useState, useCallback } from "react";
import { saveAdminSettings, type AdminSettingsData } from "~/app/_actions/admin";

type LLMProvider = "openai" | "azure_openai";

interface AdminSettingsFormProps {
  readonly initial: AdminSettingsData | null;
}

export default function AdminSettingsForm({ initial }: AdminSettingsFormProps) {
  const [provider, setProvider] = useState<LLMProvider>(
    (initial?.llmProvider as LLMProvider) ?? "openai",
  );
  const [openaiApiKey, setOpenaiApiKey] = useState(initial?.openaiApiKey ?? "");
  const [openaiModel, setOpenaiModel] = useState(initial?.openaiModel ?? "");
  const [azureEndpoint, setAzureEndpoint] = useState(
    initial?.azureEndpoint ?? "",
  );
  const [azureDeployment, setAzureDeployment] = useState(
    initial?.azureDeployment ?? "",
  );
  const [azureApiVersion, setAzureApiVersion] = useState(
    initial?.azureApiVersion ?? "2025-04-01-preview",
  );
  const [githubPat, setGithubPat] = useState(initial?.githubPat ?? "");
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      setStatusMessage(null);

      const result = await saveAdminSettings({
        openaiApiKey: openaiApiKey.trim() || null,
        openaiModel: openaiModel.trim() || null,
        llmProvider: provider,
        azureEndpoint: azureEndpoint.trim() || null,
        azureDeployment: azureDeployment.trim() || null,
        azureApiVersion: azureApiVersion.trim() || null,
        githubPat: githubPat.trim() || null,
      });

      setSaving(false);
      if (result.ok) {
        setStatusMessage({ type: "success", text: "Settings saved." });
      } else {
        setStatusMessage({
          type: "error",
          text: result.error ?? "Failed to save settings.",
        });
      }
    },
    [
      openaiApiKey,
      openaiModel,
      provider,
      azureEndpoint,
      azureDeployment,
      azureApiVersion,
      githubPat,
    ],
  );

  const inputClass =
    "w-full rounded-md border-2 border-black px-3 py-2 text-sm font-medium dark:border-neutral-700 dark:bg-neutral-900 dark:text-white";
  const labelClass = "block text-sm font-semibold mb-1 text-black dark:text-neutral-200";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* ── LLM Provider ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-black dark:text-white">
          LLM Provider
        </h2>

        <fieldset className="space-y-2">
          <legend className={labelClass}>Provider</legend>
          <div className="flex gap-3">
            {(["openai", "azure_openai"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProvider(p)}
                className={`rounded-md border-[3px] px-4 py-2 text-sm font-medium transition-colors ${
                  provider === p
                    ? "border-black bg-purple-400 text-black dark:border-[#2d1d4e] dark:bg-[hsl(var(--neo-button))] dark:text-black"
                    : "border-black bg-purple-100 text-black hover:bg-purple-200 dark:border-[#2d1d4e] dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                }`}
              >
                {p === "openai" ? "OpenAI" : "Azure OpenAI"}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="openai-api-key" className={labelClass}>
            {provider === "azure_openai"
              ? "Azure API Subscription Key"
              : "OpenAI API Key"}
          </label>
          <input
            id="openai-api-key"
            type="password"
            value={openaiApiKey}
            onChange={(e) => setOpenaiApiKey(e.target.value)}
            placeholder={
              provider === "azure_openai"
                ? "Your Azure subscription key"
                : "sk-..."
            }
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="openai-model" className={labelClass}>
            Model Name{" "}
            <span className="font-normal text-gray-500">
              (blank = env OPENAI_MODEL or gpt-5.2)
            </span>
          </label>
          <input
            id="openai-model"
            value={openaiModel}
            onChange={(e) => setOpenaiModel(e.target.value)}
            placeholder="e.g. gpt-5.2"
            className={inputClass}
          />
        </div>

        {provider === "azure_openai" && (
          <div className="space-y-4 rounded-md border-2 border-dashed border-purple-300 p-4 dark:border-[#2d1d4e]">
            <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">
              Azure OpenAI Settings
            </p>
            <div>
              <label htmlFor="az-endpoint" className={labelClass}>
                Endpoint
              </label>
              <input
                id="az-endpoint"
                value={azureEndpoint}
                onChange={(e) => setAzureEndpoint(e.target.value)}
                placeholder="https://my-resource.openai.azure.com/"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="az-deployment" className={labelClass}>
                Deployment Name
              </label>
              <input
                id="az-deployment"
                value={azureDeployment}
                onChange={(e) => setAzureDeployment(e.target.value)}
                placeholder="gpt-5.2-chat"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="az-api-version" className={labelClass}>
                API Version
              </label>
              <input
                id="az-api-version"
                value={azureApiVersion}
                onChange={(e) => setAzureApiVersion(e.target.value)}
                placeholder="2025-04-01-preview"
                className={inputClass}
                required
              />
            </div>
          </div>
        )}
      </section>

      {/* ── GitHub ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-black dark:text-white">
          GitHub Access
        </h2>
        <div>
          <label htmlFor="github-pat" className={labelClass}>
            GitHub Personal Access Token
          </label>
          <input
            id="github-pat"
            type="password"
            value={githubPat}
            onChange={(e) => setGithubPat(e.target.value)}
            placeholder="ghp_..."
            className={inputClass}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-neutral-500">
            Increases GitHub API rate limits from 60/hr to 5 000/hr.
          </p>
        </div>
      </section>

      {/* ── Submit ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md border-[3px] border-black bg-purple-400 px-6 py-2 text-sm font-bold text-black transition-colors hover:bg-purple-500 disabled:opacity-50 dark:border-[#2d1d4e] dark:bg-[hsl(var(--neo-button))] dark:text-black"
        >
          {saving ? "Saving…" : "Save Settings"}
        </button>
        {statusMessage && (
          <span
            className={`text-sm font-medium ${
              statusMessage.type === "success"
                ? "text-green-700 dark:text-green-400"
                : "text-red-700 dark:text-red-400"
            }`}
          >
            {statusMessage.text}
          </span>
        )}
      </div>

      {initial?.updatedAt && (
        <p className="text-xs text-gray-400 dark:text-neutral-600">
          Last updated: {new Date(initial.updatedAt).toLocaleString()}
        </p>
      )}
    </form>
  );
}
