"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Sparkles, ChevronUp, ChevronDown } from "lucide-react";
import React from "react";
import { isExampleRepo } from "~/lib/exampleRepos";
import { ExportDropdown } from "./export-dropdown";
import { VersionSelector } from "./version-selector";
import { Switch } from "~/components/ui/switch";
import { parseGitHubRepoUrl } from "~/features/diagram/github-url";
import type { DiagramVersion } from "~/app/_actions/cache";

interface MainCardProps {
  isHome?: boolean;
  username?: string;
  repo?: string;
  branch?: string;
  onCopy?: () => void;
  lastGenerated?: Date;
  onExportImage?: () => void;
  onRegenerate?: () => void;
  zoomingEnabled?: boolean;
  onZoomToggle?: () => void;
  loading?: boolean;
  // Version history
  versions?: DiagramVersion[];
  currentVersion?: number | null;
  totalVersions?: number;
  versionLoading?: boolean;
  onSelectVersion?: (version: number) => void;
}

export default function MainCard({
  isHome = true,
  username,
  repo,
  branch,
  onCopy,
  lastGenerated,
  onExportImage,
  onRegenerate,
  zoomingEnabled,
  onZoomToggle,
  loading,
  versions,
  currentVersion,
  totalVersions,
  versionLoading,
  onSelectVersion,
}: MainCardProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [error, setError] = useState("");
  const [activeDropdown, setActiveDropdown] = useState<"export" | null>(null);
  const router = useRouter();
  const isExampleRepoSelected =
    !isHome && !!username && !!repo && isExampleRepo(username, repo);

  useEffect(() => {
    if (username && repo) {
      const branchPath = branch ? `/tree/${branch}` : "";
      setRepoUrl(`https://github.com/${username}/${repo}${branchPath}`);
    }
  }, [username, repo, branch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const parsed = parseGitHubRepoUrl(repoUrl);
    if (!parsed) {
      setError("Please enter a valid GitHub repository URL");
      return;
    }

    const { username, repo, branch } = parsed;
    const sanitizedUsername = encodeURIComponent(username);
    const sanitizedRepo = encodeURIComponent(repo);
    const branchParam = branch ? `?branch=${encodeURIComponent(branch)}` : "";
    router.push(`/${sanitizedUsername}/${sanitizedRepo}${branchParam}`);
  };

  const handleDropdownToggle = (dropdown: "export") => {
    setActiveDropdown(activeDropdown === dropdown ? null : dropdown);
  };

  return (
    <Card className="neo-panel relative w-full max-w-3xl !bg-[hsl(var(--neo-panel))] p-4 sm:p-8">
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Input
            placeholder="https://github.com/username/repo"
            className="neo-input flex-1 rounded-md px-3 py-4 text-base font-bold placeholder:text-base placeholder:font-normal placeholder:text-gray-700 sm:px-4 sm:py-6 sm:text-lg sm:placeholder:text-lg dark:placeholder:text-neutral-400"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            required
          />
          <Button
            type="submit"
            className="neo-button p-4 px-4 text-base sm:p-6 sm:px-6 sm:text-lg"
          >
            Diagram
          </Button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Dropdowns Container */}
        {!isHome && (
          <div className="space-y-4">
            {/* Only show buttons and dropdowns when not loading */}
            {!loading && (
              <>
                {/* Buttons Container */}
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-4">
                  {onRegenerate && (
                    <button
                      type="button"
                      disabled={isExampleRepoSelected}
                      title={
                        isExampleRepoSelected
                          ? "Regeneration is disabled for example repositories."
                          : undefined
                      }
                      className={`flex items-center justify-between gap-2 rounded-md border-[3px] border-black px-4 py-2 font-medium text-black transition-colors sm:max-w-[250px] dark:text-black ${
                        isExampleRepoSelected
                          ? "cursor-not-allowed bg-purple-200 opacity-70 dark:bg-[#251b3a] dark:text-[hsl(var(--foreground))]"
                          : "bg-purple-300 hover:bg-purple-400 dark:border-[#2d1d4e] dark:bg-[hsl(var(--neo-subtle-muted))] dark:hover:bg-[hsl(var(--neo-subtle))]"
                      }`}
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveDropdown(null);
                        if (isExampleRepoSelected) return;
                        onRegenerate();
                      }}
                    >
                      Regenerate Diagram
                    </button>
                  )}
                  {onCopy && lastGenerated && onExportImage && (
                    <div className="flex flex-col items-center justify-center gap-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleDropdownToggle("export");
                        }}
                        className={`flex cursor-pointer items-center justify-between gap-2 rounded-md border-[3px] border-black px-4 py-2 font-medium text-black transition-colors sm:max-w-[250px] dark:text-black ${
                          activeDropdown === "export"
                            ? "bg-purple-400 dark:border-[#2d1d4e] dark:bg-[hsl(var(--neo-button))]"
                            : "bg-purple-300 hover:bg-purple-400 dark:border-[#2d1d4e] dark:bg-[hsl(var(--neo-subtle-muted))] dark:hover:bg-[hsl(var(--neo-button-hover))]"
                        }`}
                      >
                        <span>Export Diagram</span>
                        {activeDropdown === "export" ? (
                          <ChevronUp size={20} />
                        ) : (
                          <ChevronDown size={20} />
                        )}
                      </button>
                    </div>
                  )}
                  {/* Version selector */}
                  {versions && currentVersion != null && totalVersions != null && totalVersions > 0 && onSelectVersion && (
                    <VersionSelector
                      versions={versions}
                      currentVersion={currentVersion}
                      totalVersions={totalVersions}
                      loading={versionLoading ?? false}
                      onSelectVersion={onSelectVersion}
                    />
                  )}

                  {lastGenerated && (
                    <>
                      <label
                        htmlFor="zoom-toggle"
                        className="font-medium text-black dark:text-neutral-100"
                      >
                        Enable Zoom
                      </label>
                      <Switch
                        id="zoom-toggle"
                        checked={zoomingEnabled}
                        onCheckedChange={onZoomToggle}
                      />
                    </>
                  )}
                </div>

                {/* Dropdown Content */}
                <div
                  className={`transition-all duration-200 ${
                    activeDropdown
                      ? "pointer-events-auto max-h-[500px] opacity-100"
                      : "pointer-events-none max-h-0 opacity-0"
                  }`}
                >
                  {activeDropdown === "export" && (
                    <ExportDropdown
                      onCopy={onCopy!}
                      lastGenerated={lastGenerated!}
                      onExportImage={onExportImage!}
                      isOpen={true}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        )}

      </form>

      {/* Decorative Sparkle */}
      <div className="absolute -bottom-8 -left-12 hidden sm:block">
        <Sparkles
          className="h-20 w-20 fill-sky-400 text-black dark:fill-[hsl(var(--neo-button))] dark:text-[hsl(var(--background))]"
          strokeWidth={0.6}
          style={{ transform: "rotate(-15deg)" }}
        />
      </div>
    </Card>
  );
}
