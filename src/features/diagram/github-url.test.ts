import { describe, expect, it } from "vitest";

import { parseGitHubRepoUrl } from "~/features/diagram/github-url";

describe("parseGitHubRepoUrl", () => {
  it("parses valid repository urls", () => {
    expect(parseGitHubRepoUrl("https://github.com/vercel/next.js")).toEqual({
      username: "vercel",
      repo: "next.js",
    });
  });

  it("parses branch urls with /tree/", () => {
    expect(
      parseGitHubRepoUrl(
        "https://github.com/FiniteSteps/gitdiagram/tree/feature/web",
      ),
    ).toEqual({
      username: "FiniteSteps",
      repo: "gitdiagram",
      branch: "feature/web",
    });
  });

  it("parses simple branch urls", () => {
    expect(
      parseGitHubRepoUrl("https://github.com/user/repo/tree/main"),
    ).toEqual({
      username: "user",
      repo: "repo",
      branch: "main",
    });
  });

  it("parses blob urls and extracts the ref path", () => {
    expect(
      parseGitHubRepoUrl(
        "https://github.com/user/repo/blob/develop/src/index.ts",
      ),
    ).toEqual({
      username: "user",
      repo: "repo",
      branch: "develop/src/index.ts",
    });
  });

  it("strips .git suffix from repo name", () => {
    expect(
      parseGitHubRepoUrl("https://github.com/user/repo.git"),
    ).toEqual({
      username: "user",
      repo: "repo",
    });
  });

  it("handles trailing slashes", () => {
    expect(parseGitHubRepoUrl("https://github.com/user/repo/")).toEqual({
      username: "user",
      repo: "repo",
    });
    expect(
      parseGitHubRepoUrl("https://github.com/user/repo/tree/main/"),
    ).toEqual({
      username: "user",
      repo: "repo",
      branch: "main",
    });
  });

  it("returns null for invalid urls", () => {
    expect(parseGitHubRepoUrl("https://gitlab.com/vercel/next.js")).toBeNull();
    expect(parseGitHubRepoUrl("not-a-url")).toBeNull();
  });
});
