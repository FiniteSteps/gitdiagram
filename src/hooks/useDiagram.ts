import { useState, useEffect, useCallback } from "react";

import {
  cacheDiagramAndExplanation,
  getLatestDiagramFromHistory,
  getDiagramVersions,
  getDiagramByVersion,
  type DiagramVersion,
} from "~/app/_actions/cache";
import { getGenerationCost } from "~/features/diagram/api";
import { useDiagramStream } from "~/hooks/diagram/useDiagramStream";
import { useDiagramExport } from "~/hooks/diagram/useDiagramExport";
import { isExampleRepo } from "~/lib/exampleRepos";

export function useDiagram(username: string, repo: string, branch?: string) {
  const [diagram, setDiagram] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [lastGenerated, setLastGenerated] = useState<Date | undefined>();
  const [cost, setCost] = useState<string>("");

  // ── Version state ──────────────────────────────────────────────────
  const [versions, setVersions] = useState<DiagramVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);
  const [totalVersions, setTotalVersions] = useState<number>(0);
  const [versionLoading, setVersionLoading] = useState<boolean>(false);

  const branchKey = branch ?? "";

  /** Refresh the version list from the DB */
  const refreshVersions = useCallback(async () => {
    const versionList = await getDiagramVersions(username, repo, branchKey);
    setVersions(versionList);
    setTotalVersions(versionList.length);
    return versionList;
  }, [username, repo, branchKey]);

  const onStreamComplete = useCallback(
    async ({
      diagram: nextDiagram,
      explanation,
    }: {
      diagram: string;
      explanation: string;
    }) => {
      const newVersion = await cacheDiagramAndExplanation(
        username,
        repo,
        nextDiagram,
        explanation || "No explanation provided",
        false,
        branchKey,
      );

      setDiagram(nextDiagram);
      setLastGenerated(new Date());
      setLoading(false);

      // Refresh version list and set current to the new version
      const versionList = await refreshVersions();
      if (newVersion) {
        setCurrentVersion(newVersion);
      } else if (versionList.length > 0) {
        setCurrentVersion(versionList[0]!.version);
      }
    },
    [branchKey, repo, username, refreshVersions],
  );

  const onStreamError = useCallback((message: string) => {
    setError(message);
    setLoading(false);
  }, []);

  const { state, runGeneration } = useDiagramStream({
    username,
    repo,
    branch,
    onComplete: onStreamComplete,
    onError: onStreamError,
  });

  useEffect(() => {
    if (state.status === "error") {
      setLoading(false);
    }
  }, [state.status]);

  const getDiagram = useCallback(async () => {
    setLoading(true);
    setError("");
    setCost("");

    try {
      // Try loading from versioned history first
      const latest = await getLatestDiagramFromHistory(
        username,
        repo,
        branchKey,
      );

      if (latest) {
        setDiagram(latest.diagram);
        setLastGenerated(latest.createdAt);
        setCurrentVersion(latest.version);

        // Load version list
        const versionList = await getDiagramVersions(
          username,
          repo,
          branchKey,
        );
        setVersions(versionList);
        setTotalVersions(
          versionList.length > 0 ? versionList.length : 1, // at least 1 for legacy fallback
        );
        setLoading(false);
        return;
      }

      const costEstimate = await getGenerationCost(username, repo);

      if (costEstimate.error) {
        setError(costEstimate.error);
        setLoading(false);
        return;
      }

      setCost(costEstimate.cost ?? "");
      await runGeneration();
    } catch {
      setError("Something went wrong. Please try again later.");
      setLoading(false);
    }
  }, [branchKey, repo, runGeneration, username]);

  useEffect(() => {
    void getDiagram();
  }, [getDiagram]);

  const { handleCopy, handleExportImage } = useDiagramExport(diagram);

  const handleRegenerate = useCallback(async () => {
    if (isExampleRepo(username, repo)) {
      return;
    }

    setLoading(true);
    setError("");
    setCost("");

    try {
      const costEstimate = await getGenerationCost(username, repo);

      if (costEstimate.error) {
        setError(costEstimate.error);
        setLoading(false);
        return;
      }

      setCost(costEstimate.cost ?? "");
      await runGeneration();
    } catch {
      setError("Something went wrong. Please try again later.");
      setLoading(false);
    }
  }, [repo, runGeneration, username]);

  /** Switch to a specific historical version */
  const selectVersion = useCallback(
    async (version: number) => {
      if (version === currentVersion) return;

      setVersionLoading(true);
      setError("");

      try {
        const row = await getDiagramByVersion(
          username,
          repo,
          version,
          branchKey,
        );
        if (row) {
          setDiagram(row.diagram);
          setCurrentVersion(row.version);
          setLastGenerated(row.createdAt);
        } else {
          setError("Version not found.");
        }
      } catch {
        setError("Failed to load version.");
      } finally {
        setVersionLoading(false);
      }
    },
    [branchKey, currentVersion, repo, username],
  );

  return {
    diagram,
    error,
    loading,
    lastGenerated,
    cost,
    handleCopy,
    handleExportImage,
    handleRegenerate,
    state,
    // version data
    versions,
    currentVersion,
    totalVersions,
    versionLoading,
    selectVersion,
  };
}
