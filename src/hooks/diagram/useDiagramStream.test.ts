import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDiagramStream } from "~/hooks/diagram/useDiagramStream";

vi.mock("~/features/diagram/api", () => ({
  streamDiagramGeneration: vi.fn(async (_params, handlers) => {
    await handlers.onMessage({ status: "started", message: "starting" });
    await handlers.onMessage({ status: "explanation_chunk", chunk: "Repo details" });
    await handlers.onMessage({
      status: "complete",
      diagram: "flowchart TD\nA-->B",
      explanation: "done",
    });
  }),
}));

vi.mock("~/components/model-config-dialog", () => ({
  getModelConfig: vi.fn(() => undefined),
}));

// Ensure localStorage is available in test env
const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(() => null),
};
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

describe("useDiagramStream", () => {
  it("updates state through stream lifecycle", async () => {
    const onComplete = vi.fn(async () => undefined);
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useDiagramStream({
        username: "acme",
        repo: "demo",
        onComplete,
        onError,
      }),
    );

    await act(async () => {
      await result.current.runGeneration();
    });

    expect(result.current.state.status).toBe("complete");
    expect(result.current.state.diagram).toContain("flowchart TD");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });
});
