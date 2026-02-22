from app.routers.generate import process_click_events, _extract_component_mapping


def test_process_click_events_builds_blob_and_tree_links():
    diagram = 'flowchart TD\nclick Api "src/api.ts"\nclick Core "src/core"'
    output = process_click_events(diagram, "u", "r", "main")

    assert 'click Api "https://github.com/u/r/blob/main/src/api.ts"' in output
    assert 'click Core "https://github.com/u/r/tree/main/src/core"' in output


def test_process_click_events_dotfiles_classified_as_directories():
    """Dotfiles like .github, .vscode should be classified as tree (directory) links."""
    diagram = 'flowchart TD\nclick GH ".github"\nclick VS ".vscode"\nclick Env ".env"'
    output = process_click_events(diagram, "u", "r", "main")

    assert 'click GH "https://github.com/u/r/tree/main/.github"' in output
    assert 'click VS "https://github.com/u/r/tree/main/.vscode"' in output
    assert 'click Env "https://github.com/u/r/tree/main/.env"' in output


def test_process_click_events_extensionless_files_classified_as_directories():
    """Extension-less files like Makefile, Dockerfile use tree (we can't distinguish without tree data)."""
    diagram = 'flowchart TD\nclick MF "Makefile"\nclick DF "Dockerfile"\nclick LI "LICENSE"'
    output = process_click_events(diagram, "u", "r", "main")

    assert 'click MF "https://github.com/u/r/tree/main/Makefile"' in output
    assert 'click DF "https://github.com/u/r/tree/main/Dockerfile"' in output
    assert 'click LI "https://github.com/u/r/tree/main/LICENSE"' in output


def test_process_click_events_nested_dotfiles_as_files():
    """Dotfiles in subdirectories with extensions should be files."""
    diagram = 'flowchart TD\nclick Cfg ".github/workflows/ci.yml"'
    output = process_click_events(diagram, "u", "r", "main")

    assert 'click Cfg "https://github.com/u/r/blob/main/.github/workflows/ci.yml"' in output


def test_extract_component_mapping_excludes_tags():
    """The extracted mapping should not include the XML tags themselves."""
    response = "Some preamble\n<component_mapping>\nA: src/a.ts\nB: src/b.ts\n</component_mapping>\nSome epilogue"
    result = _extract_component_mapping(response)
    assert "<component_mapping>" not in result
    assert "</component_mapping>" not in result
    assert "A: src/a.ts" in result
    assert "B: src/b.ts" in result


def test_extract_component_mapping_returns_full_response_when_no_tags():
    """If no tags are present, the full response is returned."""
    response = "No tags here, just text."
    result = _extract_component_mapping(response)
    assert result == response
