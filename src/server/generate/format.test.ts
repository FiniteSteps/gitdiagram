import { describe, expect, it } from "vitest";

import { extractComponentMapping, processClickEvents } from "./format";

describe("extractComponentMapping", () => {
  it("extracts content between tags without including the tags", () => {
    const response =
      "Preamble\n<component_mapping>\nA: src/a.ts\nB: src/b.ts\n</component_mapping>\nEpilogue";
    const result = extractComponentMapping(response);

    expect(result).not.toContain("<component_mapping>");
    expect(result).not.toContain("</component_mapping>");
    expect(result).toContain("A: src/a.ts");
    expect(result).toContain("B: src/b.ts");
  });

  it("returns full response when no tags are present", () => {
    const response = "No tags here.";
    expect(extractComponentMapping(response)).toBe(response);
  });
});

describe("processClickEvents", () => {
  it("builds blob links for files and tree links for directories", () => {
    const diagram = 'flowchart TD\nclick Api "src/api.ts"\nclick Core "src/core"';
    const output = processClickEvents(diagram, "u", "r", "main");

    expect(output).toContain(
      'click Api "https://github.com/u/r/blob/main/src/api.ts"',
    );
    expect(output).toContain(
      'click Core "https://github.com/u/r/tree/main/src/core"',
    );
  });

  it("classifies dotfiles/dotdirs as tree links", () => {
    const diagram =
      'flowchart TD\nclick GH ".github"\nclick VS ".vscode"\nclick Env ".env"';
    const output = processClickEvents(diagram, "u", "r", "main");

    expect(output).toContain(
      'click GH "https://github.com/u/r/tree/main/.github"',
    );
    expect(output).toContain(
      'click VS "https://github.com/u/r/tree/main/.vscode"',
    );
    expect(output).toContain(
      'click Env "https://github.com/u/r/tree/main/.env"',
    );
  });

  it("classifies nested dotdir files with extensions as blob links", () => {
    const diagram = 'flowchart TD\nclick Cfg ".github/workflows/ci.yml"';
    const output = processClickEvents(diagram, "u", "r", "main");

    expect(output).toContain(
      'click Cfg "https://github.com/u/r/blob/main/.github/workflows/ci.yml"',
    );
  });

  it("classifies extension-less files (Makefile, Dockerfile) as tree links", () => {
    const diagram =
      'flowchart TD\nclick MF "Makefile"\nclick DF "Dockerfile"';
    const output = processClickEvents(diagram, "u", "r", "main");

    expect(output).toContain(
      'click MF "https://github.com/u/r/tree/main/Makefile"',
    );
    expect(output).toContain(
      'click DF "https://github.com/u/r/tree/main/Dockerfile"',
    );
  });
});
