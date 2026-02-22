"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useState, useEffect, useCallback } from "react";
import type {
  LLMProvider,
  ModelConfig,
  AzureOpenAIConfig,
} from "~/features/diagram/types";

const MODEL_CONFIG_KEY = "model_config";

const DEFAULT_AZURE: AzureOpenAIConfig = {
  endpoint: "",
  deployment: "",
  apiVersion: "2025-04-01-preview",
};

const DEFAULT_CONFIG: ModelConfig = {
  provider: "openai",
  modelName: "",
  apiKey: "",
};

function loadModelConfig(): ModelConfig {
  if (typeof globalThis.window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(MODEL_CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return JSON.parse(raw) as ModelConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveModelConfig(config: ModelConfig): void {
  localStorage.setItem(MODEL_CONFIG_KEY, JSON.stringify(config));
}

export function getModelConfig(): ModelConfig | undefined {
  const config = loadModelConfig();
  if (config.provider === "openai" && !config.apiKey && !config.modelName) {
    return undefined;
  }
  return config;
}

interface ModelConfigDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (config: ModelConfig) => void;
}

const PROVIDERS: { value: LLMProvider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "azure_openai", label: "Azure OpenAI" },
];

export function ModelConfigDialog({
  isOpen,
  onClose,
  onSubmit,
}: ModelConfigDialogProps) {
  const [provider, setProvider] = useState<LLMProvider>("openai");
  const [modelName, setModelName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [azure, setAzure] = useState<AzureOpenAIConfig>({ ...DEFAULT_AZURE });

  // Load persisted config on open
  useEffect(() => {
    if (!isOpen) return;
    const stored = loadModelConfig();
    setProvider(stored.provider);
    setModelName(stored.modelName ?? "");
    setApiKey(stored.apiKey ?? "");
    setAzure(stored.azure ?? { ...DEFAULT_AZURE });
  }, [isOpen]);

  const updateAzure = useCallback(
    (field: keyof AzureOpenAIConfig, value: string) => {
      setAzure((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const isValid = useCallback(() => {
    // At minimum the provider must be set
    if (provider === "azure_openai") {
      return !!(
        azure.endpoint.trim() &&
        azure.deployment.trim() &&
        azure.apiVersion.trim() &&
        apiKey.trim()
      );
    }
    // OpenAI: allow saving even without key (server default used)
    return true;
  }, [provider, azure, apiKey]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const config: ModelConfig = {
      provider,
      modelName: modelName.trim() || undefined,
      apiKey: apiKey.trim() || undefined,
      azure: provider === "azure_openai" ? azure : undefined,
    };
    saveModelConfig(config);
    onSubmit(config);
  };

  const handleClear = () => {
    localStorage.removeItem(MODEL_CONFIG_KEY);
    // Also clear the legacy openai_key
    localStorage.removeItem("openai_key");
    setProvider("openai");
    setModelName("");
    setApiKey("");
    setAzure({ ...DEFAULT_AZURE });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="neo-panel max-h-[90vh] overflow-y-auto p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-black dark:text-neutral-100">
            Manage Models
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 text-black dark:text-neutral-200"
        >
          {/* Description */}
          <p className="text-sm">
            Choose your LLM provider and configure connection settings. All
            settings are stored locally in your browser.
          </p>

          {/* Provider selector */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Provider</legend>
            <div className="flex gap-3">
              {PROVIDERS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setProvider(p.value)}
                  className={`rounded-md border-[3px] px-4 py-2 text-sm font-medium transition-colors ${
                    provider === p.value
                      ? "border-black bg-purple-400 text-black dark:border-[#2d1d4e] dark:bg-[hsl(var(--neo-button))] dark:text-black"
                      : "border-black bg-purple-100 text-black hover:bg-purple-200 dark:border-[#2d1d4e] dark:bg-[hsl(var(--neo-panel-muted))] dark:text-[hsl(var(--foreground))] dark:hover:bg-[hsl(var(--neo-subtle-muted))]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Model name (shared) */}
          <fieldset className="space-y-1">
            <label htmlFor="mc-model" className="text-sm font-semibold">
              Model Name{" "}
              <span className="font-normal text-gray-600 dark:text-neutral-400">
                (optional — server default used if blank)
              </span>
            </label>
            <Input
              id="mc-model"
              placeholder={
                provider === "azure_openai"
                  ? "e.g. gpt-5.2-chat"
                  : "e.g. gpt-5.2"
              }
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="neo-input rounded-md px-3 py-2 text-base font-bold placeholder:font-normal placeholder:text-gray-700 dark:placeholder:text-neutral-400"
            />
          </fieldset>

          {/* API Key (shared) */}
          <fieldset className="space-y-1">
            <label htmlFor="mc-apikey" className="text-sm font-semibold">
              {provider === "azure_openai"
                ? "Azure API Subscription Key"
                : "OpenAI API Key"}
            </label>
            <Input
              id="mc-apikey"
              type="password"
              placeholder={
                provider === "azure_openai"
                  ? "Your Azure subscription key"
                  : "sk-..."
              }
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="neo-input rounded-md px-3 py-2 text-base font-bold placeholder:font-normal placeholder:text-gray-700 dark:placeholder:text-neutral-400"
            />
          </fieldset>

          {/* Azure-specific fields */}
          {provider === "azure_openai" && (
            <div className="space-y-4 rounded-md border-2 border-dashed border-purple-300 p-4 dark:border-[#2d1d4e]">
              <p className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                Azure OpenAI Settings
              </p>

              <fieldset className="space-y-1">
                <label htmlFor="mc-az-endpoint" className="text-sm font-medium">
                  Endpoint
                </label>
                <Input
                  id="mc-az-endpoint"
                  placeholder="https://my-resource.openai.azure.com/"
                  value={azure.endpoint}
                  onChange={(e) => updateAzure("endpoint", e.target.value)}
                  className="neo-input rounded-md px-3 py-2 text-base font-bold placeholder:font-normal placeholder:text-gray-700 dark:placeholder:text-neutral-400"
                  required
                />
              </fieldset>

              <fieldset className="space-y-1">
                <label
                  htmlFor="mc-az-deployment"
                  className="text-sm font-medium"
                >
                  Deployment Name
                </label>
                <Input
                  id="mc-az-deployment"
                  placeholder="gpt-5.2-chat"
                  value={azure.deployment}
                  onChange={(e) => updateAzure("deployment", e.target.value)}
                  className="neo-input rounded-md px-3 py-2 text-base font-bold placeholder:font-normal placeholder:text-gray-700 dark:placeholder:text-neutral-400"
                  required
                />
              </fieldset>

              <fieldset className="space-y-1">
                <label
                  htmlFor="mc-az-apiversion"
                  className="text-sm font-medium"
                >
                  API Version
                </label>
                <Input
                  id="mc-az-apiversion"
                  placeholder="2025-04-01-preview"
                  value={azure.apiVersion}
                  onChange={(e) => updateAzure("apiVersion", e.target.value)}
                  className="neo-input rounded-md px-3 py-2 text-base font-bold placeholder:font-normal placeholder:text-gray-700 dark:placeholder:text-neutral-400"
                  required
                />
              </fieldset>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleClear}
              className="neo-link text-sm"
            >
              Reset
            </button>
            <div className="flex gap-3">
              <Button
                type="button"
                onClick={onClose}
                className="neo-button-muted px-4 py-2"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isValid()}
                className="neo-button px-4 py-2 disabled:opacity-50"
              >
                Save
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
