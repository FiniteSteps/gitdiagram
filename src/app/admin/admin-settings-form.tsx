"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  saveAdminSettings,
  type AdminSettingsData,
} from "~/app/_actions/admin";

type LLMProvider = "openai" | "azure_openai";
type TestStatus = "idle" | "testing" | "ok" | "error";

interface AdminSettingsFormProps {
  readonly initial: AdminSettingsData | null;
}

// ── Helpers ───────────────────────────────────────────────────────────

function validate(
  provider: LLMProvider,
  apiKey: string,
  azureEndpoint: string,
  githubPat: string,
) {
  const errors: Record<string, string> = {};
  const key = apiKey.trim();
  if (key) {
    if (provider === "openai" && !key.startsWith("sk-")) {
      errors.openaiApiKey = "OpenAI keys typically start with sk-";
    }
  }
  const ep = azureEndpoint.trim();
  if (provider === "azure_openai" && ep) {
    try {
      new URL(ep);
    } catch {
      errors.azureEndpoint = "Must be a valid URL";
    }
  }
  const pat = githubPat.trim();
  if (pat && !pat.startsWith("ghp_") && !pat.startsWith("github_pat_")) {
    errors.githubPat = "GitHub PATs usually start with ghp_ or github_pat_";
  }
  return errors;
}

function EyeIcon({ open }: Readonly<{ open: boolean }>) {
  return open ? (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path d="M10 3C5 3 1.73 7.11 1 10c.73 2.89 4 7 9 7s8.27-4.11 9-7c-.73-2.89-4-7-9-7zm0 12a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z" />
    </svg>
  ) : (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473C18.566 13.73 20 12 20 10c-.73-2.89-4-7-9-7-1.72 0-3.28.5-4.61 1.32L3.707 2.293zM10 5a5 5 0 014.546 7.132l-1.57-1.57A3 3 0 0010 7a2.98 2.98 0 00-1.562.44L6.974 5.976A6.96 6.96 0 0110 5zM1 10c.73-2.89 4-7 9-7 .87 0 1.7.13 2.48.36L3.53 12.31C2.15 11.28 1.28 10.15 1 10z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function TestStatusBadge({
  status,
  message,
}: Readonly<{ status: TestStatus; message: string }>) {
  if (status === "idle") return null;
  const styles = {
    testing:
      "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    ok: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    error: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  };
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status === "testing" ? "Testing…" : message}
    </span>
  );
}

// ── Form ──────────────────────────────────────────────────────────────

export default function AdminSettingsForm({ initial }: AdminSettingsFormProps) {
  // ── State ──
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

  // Show/hide secrets (#3)
  const [showApiKey, setShowApiKey] = useState(false);
  const [showGithubPat, setShowGithubPat] = useState(false);

  // Test connection (#2)
  const [openaiTest, setOpenaiTest] = useState<{
    status: TestStatus;
    message: string;
  }>({ status: "idle", message: "" });
  const [githubTest, setGithubTest] = useState<{
    status: TestStatus;
    message: string;
  }>({ status: "idle", message: "" });

  // Confirmation dialog (#10)
  const [showConfirm, setShowConfirm] = useState(false);

  // ── Dirty tracking (#4) ──
  const isDirty = useMemo(() => {
    const i = initial;
    return (
      provider !== ((i?.llmProvider as LLMProvider) ?? "openai") ||
      openaiApiKey !== (i?.openaiApiKey ?? "") ||
      openaiModel !== (i?.openaiModel ?? "") ||
      azureEndpoint !== (i?.azureEndpoint ?? "") ||
      azureDeployment !== (i?.azureDeployment ?? "") ||
      azureApiVersion !== (i?.azureApiVersion ?? "2025-04-01-preview") ||
      githubPat !== (i?.githubPat ?? "")
    );
  }, [
    provider,
    openaiApiKey,
    openaiModel,
    azureEndpoint,
    azureDeployment,
    azureApiVersion,
    githubPat,
    initial,
  ]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    globalThis.addEventListener("beforeunload", handler);
    return () => globalThis.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ── Validation (#5) ──
  const validationErrors = useMemo(
    () => validate(provider, openaiApiKey, azureEndpoint, githubPat),
    [provider, openaiApiKey, azureEndpoint, githubPat],
  );
  const hasValidationErrors = Object.keys(validationErrors).length > 0;

  // ── Keyboard shortcut (Cmd/Ctrl+S) ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty && !hasValidationErrors && !saving) {
          setShowConfirm(true);
        }
      }
    };
    globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
  }, [isDirty, hasValidationErrors, saving]);

  // ── Handlers ──
  const doSave = useCallback(async () => {
    setShowConfirm(false);
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
  }, [
    openaiApiKey,
    openaiModel,
    provider,
    azureEndpoint,
    azureDeployment,
    azureApiVersion,
    githubPat,
  ]);

  const handleSubmit = useCallback(
    (e: { preventDefault: () => void }) => {
      e.preventDefault();
      if (hasValidationErrors) return;
      setShowConfirm(true);
    },
    [hasValidationErrors],
  );

  const testOpenAI = useCallback(async () => {
    if (!openaiApiKey.trim()) return;
    setOpenaiTest({ status: "testing", message: "" });
    try {
      const res = await fetch("/api/admin/test-openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: openaiApiKey.trim(),
          azureEndpoint: azureEndpoint.trim() || undefined,
          azureDeployment: azureDeployment.trim() || undefined,
          azureApiVersion: azureApiVersion.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { ok: boolean; message: string };
      setOpenaiTest({
        status: data.ok ? "ok" : "error",
        message: data.message,
      });
    } catch (err) {
      setOpenaiTest({
        status: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }, [provider, openaiApiKey, azureEndpoint, azureDeployment, azureApiVersion]);

  const testGitHub = useCallback(async () => {
    if (!githubPat.trim()) return;
    setGithubTest({ status: "testing", message: "" });
    try {
      const res = await fetch("/api/admin/test-github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pat: githubPat.trim() }),
      });
      const data = (await res.json()) as { ok: boolean; message: string };
      setGithubTest({
        status: data.ok ? "ok" : "error",
        message: data.message,
      });
    } catch (err) {
      setGithubTest({
        status: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }, [githubPat]);

  // ── Styles ──
  const inputClass =
    "w-full rounded-md border-2 border-black px-3 py-2 text-sm font-medium dark:border-neutral-700 dark:bg-neutral-900 dark:text-white";
  const labelClass =
    "block text-sm font-semibold mb-1 text-black dark:text-neutral-200";
  const errorClass = "mt-1 text-xs text-red-600 dark:text-red-400";
  const testBtnClass =
    "rounded-md border-2 border-black px-3 py-1 text-xs font-medium transition-colors hover:bg-gray-100 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800";

  return (
    <>
      {/* Unsaved changes banner (#4) */}
      {isDirty && (
        <div className="mb-6 rounded-md border-2 border-amber-400 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200">
          You have unsaved changes.{" "}
          <span className="text-xs text-amber-600 dark:text-amber-400">
            (Cmd/Ctrl+S to save)
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ── LLM Provider ──────────────────────────────────────── */}
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

          {/* API Key with eye toggle (#3) and test button (#2) */}
          <div>
            <label htmlFor="openai-api-key" className={labelClass}>
              {provider === "azure_openai"
                ? "Azure API Subscription Key"
                : "OpenAI API Key"}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="openai-api-key"
                  type={showApiKey ? "text" : "password"}
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  placeholder={
                    provider === "azure_openai"
                      ? "Your Azure subscription key"
                      : "sk-..."
                  }
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black dark:text-neutral-500 dark:hover:text-white"
                  aria-label={showApiKey ? "Hide API key" : "Show API key"}
                >
                  <EyeIcon open={showApiKey} />
                </button>
              </div>
              <button
                type="button"
                disabled={
                  !openaiApiKey.trim() || openaiTest.status === "testing"
                }
                onClick={() => void testOpenAI()}
                className={testBtnClass}
              >
                Test
              </button>
            </div>
            {validationErrors.openaiApiKey && (
              <p className={errorClass}>{validationErrors.openaiApiKey}</p>
            )}
            <TestStatusBadge
              status={openaiTest.status}
              message={openaiTest.message}
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
                {validationErrors.azureEndpoint && (
                  <p className={errorClass}>
                    {validationErrors.azureEndpoint}
                  </p>
                )}
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

        {/* ── GitHub ─────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-black dark:text-white">
            GitHub Access
          </h2>
          <div>
            <label htmlFor="github-pat" className={labelClass}>
              GitHub Personal Access Token
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="github-pat"
                  type={showGithubPat ? "text" : "password"}
                  value={githubPat}
                  onChange={(e) => setGithubPat(e.target.value)}
                  placeholder="ghp_..."
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowGithubPat((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black dark:text-neutral-500 dark:hover:text-white"
                  aria-label={
                    showGithubPat ? "Hide GitHub PAT" : "Show GitHub PAT"
                  }
                >
                  <EyeIcon open={showGithubPat} />
                </button>
              </div>
              <button
                type="button"
                disabled={
                  !githubPat.trim() || githubTest.status === "testing"
                }
                onClick={() => void testGitHub()}
                className={testBtnClass}
              >
                Test
              </button>
            </div>
            {validationErrors.githubPat && (
              <p className={errorClass}>{validationErrors.githubPat}</p>
            )}
            <TestStatusBadge
              status={githubTest.status}
              message={githubTest.message}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-neutral-500">
              Increases GitHub API rate limits from 60/hr to 5,000/hr.
            </p>
          </div>
        </section>

        {/* ── Submit ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving || !isDirty || hasValidationErrors}
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

      {/* ── Confirmation dialog (#10) ───────────────────────────── */}
      {showConfirm && (
        <dialog
          open
          className="fixed inset-0 z-50 flex items-center justify-center bg-transparent"
        >
          <div className="rounded-lg border-[3px] border-black bg-white p-6 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
            <h3 className="mb-2 text-lg font-bold text-black dark:text-white">
              Confirm Save
            </h3>
            <p className="mb-6 text-sm text-gray-600 dark:text-neutral-400">
              Are you sure you want to update the admin settings? These changes
              will take effect immediately for all diagram generation requests.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded-md border-2 border-black px-3 py-1 text-xs font-medium text-black transition-colors hover:bg-gray-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void doSave()}
                className="rounded-md border-[3px] border-black bg-purple-400 px-4 py-1 text-xs font-bold text-black transition-colors hover:bg-purple-500 dark:border-[#2d1d4e] dark:bg-[hsl(var(--neo-button))] dark:text-black"
              >
                Save
              </button>
            </div>
          </div>
          <button
            type="button"
            className="fixed inset-0 -z-10 cursor-default bg-black/40"
            onClick={() => setShowConfirm(false)}
            tabIndex={-1}
            aria-label="Close dialog"
          />
        </dialog>
      )}
    </>
  );
}
