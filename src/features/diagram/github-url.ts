export interface ParsedGitHubRepo {
  username: string;
  repo: string;
  branch?: string;
}

const VALID_NAME = /^[a-zA-Z0-9._-]+$/;

export function parseGitHubRepoUrl(url: string): ParsedGitHubRepo | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }

  if (parsed.hostname !== "github.com") return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const username = segments[0]!;
  const repo = segments[1]!.replace(/\.git$/, "");

  if (!VALID_NAME.test(username) || !VALID_NAME.test(repo)) return null;

  let branch: string | undefined;
  if (
    segments.length >= 4 &&
    (segments[2] === "tree" || segments[2] === "blob")
  ) {
    branch = segments.slice(3).join("/");
  }

  return { username, repo, branch };
}
