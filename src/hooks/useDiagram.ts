import { useState, useEffect, useCallback } from "react";

import {
  cacheDiagramAndExplanation,
  getCachedDiagram,
} from "~/app/_actions/cache";
import { getLastGeneratedDate } from "~/app/_actions/repo";
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

  const branchKey = branch ?? "";

  const onStreamComplete = useCallback(
    async ({
      diagram: nextDiagram,
      explanation,
    }: {
      diagram: string;
      explanation: string;
    }) => {
      await cacheDiagramAndExplanation(
        username,
        repo,
        nextDiagram,
        explanation || "No explanation provided",
        false,
        branchKey,
      );

      setDiagram(nextDiagram);
      const date = await getLastGeneratedDate(username, repo, branchKey);
      setLastGenerated(date ?? undefined);
      setLoading(false);
    },
    [branchKey, repo, username],
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
      const cached = await getCachedDiagram(username, repo, branchKey);

      if (cached) {
        setDiagram(cached);
        const date = await getLastGeneratedDate(username, repo, branchKey);
        setLastGenerated(date ?? undefined);
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
  };
}
