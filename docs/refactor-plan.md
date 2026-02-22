# Refactor Plan

Larger architectural and code-quality improvements identified during the QA audit (Feb 2026). Items are grouped by area and ordered by impact. Each section includes the problem, affected files, a proposed approach, and estimated effort.

---

## 1. Python Backend: Blocking Sync HTTP on Async Event Loop

**Severity:** Critical  
**Files:** `backend/app/services/github_service.py`, `backend/app/routers/generate.py`

### Problem

`GitHubService` uses synchronous `requests.get()` for all GitHub API calls (default branch, file tree, README, installation token). These are called directly inside async route handlers, blocking the uvicorn event loop for the duration of 3–4 HTTP round-trips per request. Under concurrent load this serializes all requests through the event loop thread.

### Current Code

```python
# generate.py
def _get_github_data(username, repo, github_pat):
    github_service = GitHubService(pat=github_pat)          # sync
    return github_service.get_github_data(username, repo)    # 3× requests.get()
```

Mermaid validation is correctly wrapped in `asyncio.to_thread()`, but GitHub calls are not.

### Proposed Approach

**Option A (minimal):** Wrap `_get_github_data` in `asyncio.to_thread()`:

```python
github_data = await asyncio.to_thread(_get_github_data, parsed.username, parsed.repo, parsed.github_pat)
```

**Option B (proper):** Migrate `GitHubService` to `httpx.AsyncClient`:

1. Replace `requests` with `httpx` (already has `httpx` in dev deps for testing).
2. Change `_fetch_json` to `async def _fetch_json` using `httpx.AsyncClient`.
3. Make `get_github_data` async; parallelize file tree + README with `asyncio.gather()`.
4. Remove `requests` from production dependencies.

Option B is preferred — it also enables parallelizing the file-tree and README fetches (currently sequential), shaving ~50% off the GitHub data-fetch latency.

### Effort

Option A: ~15 min. Option B: ~1–2 hours.

---

## 2. Python Backend: OpenAI Client Created Per LLM Call

**Severity:** Medium  
**Files:** `backend/app/services/openai_service.py`

### Problem

`stream_completion` and `count_input_tokens` each call `self._create_client()`, creating a new `AsyncOpenAI` (or `AsyncAzureOpenAI`) with its own HTTP connection pool for every invocation. A single diagram generation triggers 3–6 LLM calls, each establishing a fresh TLS handshake.

### Current Code

```python
client = self._create_client(resolved_api_key, azure)
stream = await client.responses.create(**payload)
try:
    async for event in stream:
        ...
finally:
    await stream.close()
    await client.close()
```

### Proposed Approach

Cache clients by configuration tuple `(api_key, azure_endpoint)` using a simple dict or `functools.lru_cache`. Introduce a lifecycle method (`close_all_clients`) called at shutdown.

```python
class OpenAIService:
    def __init__(self):
        self.default_api_key = os.getenv("OPENAI_API_KEY")
        self._clients: dict[tuple, AsyncOpenAI] = {}

    def _get_or_create_client(self, api_key: str, azure: AzureConfig | None) -> AsyncOpenAI:
        key = (api_key, azure.endpoint if azure else None)
        if key not in self._clients:
            self._clients[key] = self._create_client(api_key, azure)
        return self._clients[key]
```

### Effort

~1 hour.

---

## 3. Python Backend: GitHub App Token Cache Discarded Per Request

**Severity:** Medium  
**Files:** `backend/app/services/github_service.py`, `backend/app/routers/generate.py`

### Problem

`_get_github_data()` creates a new `GitHubService` instance per request. The installation token cache (`self.access_token`, `self.token_expires_at`) is instance-bound, so it's discarded after each request. Under load, every request generates a new JWT and requests a new installation token — potentially hitting GitHub's token creation rate limits.

### Current Code

```python
def _get_github_data(username, repo, github_pat):
    github_service = GitHubService(pat=github_pat)  # new instance every time
    return github_service.get_github_data(username, repo)
```

### Proposed Approach

Use a module-level singleton for the non-PAT case. When a user-provided PAT is present, create a short-lived instance; otherwise reuse the shared instance whose installation token cache persists across requests.

```python
_default_github_service = GitHubService()

def _get_github_data(username, repo, github_pat):
    service = GitHubService(pat=github_pat) if github_pat else _default_github_service
    return service.get_github_data(username, repo)
```

### Effort

~30 min.

---

## 4. SSE Stream: No Client Disconnect Detection

**Severity:** Medium  
**Files:** `backend/app/routers/generate.py`, `src/app/api/generate/stream/route.ts`

### Problem

Both backends continue making expensive LLM API calls even after the client disconnects. A user who navigates away mid-generation still consumes 3–6 LLM calls and the associated cost.

### Proposed Approach

**Python (FastAPI):** Accept the `Request` object inside the generator and check `await request.is_disconnected()` between stages:

```python
async def event_generator():
    ...
    if await request.is_disconnected():
        return
    # proceed to next LLM stage
```

**TypeScript (Next.js):** Use `AbortSignal` from the request:

```typescript
const signal = request.signal;
// Between stages:
if (signal.aborted) return;
```

### Effort

~1 hour across both backends.

---

## 5. Click Event Path-Type Heuristic Misclassifies Dotfiles

**Severity:** Medium  
**Files:** `backend/app/routers/generate.py` (L111–120), `src/server/generate/format.ts` (L20–22)

### Problem

Both backends use the same heuristic to decide whether a path is a file or directory:

```
is_file = "." in path && !path.endsWith("/")
```

This misclassifies:
- **Dotfiles/directories as files:** `.github`, `.vscode`, `.env` → uses `/blob/` (wrong)
- **Extension-less files as directories:** `Makefile`, `Dockerfile`, `LICENSE` → uses `/tree/` (wrong)

### Proposed Approach

Check only the final path component for a dot (excludes leading-dot directories):

```python
filename = trimmed_path.rsplit("/", 1)[-1]
is_file = "." in filename[1:]  # ignore leading dot
```

Or ideally, use the file tree data (already available) to definitively determine file vs directory. The GitHub tree API returns a `type` field (`"blob"` or `"tree"`) that could be passed through the pipeline.

### Effort

~1 hour (simple heuristic fix) or ~3 hours (pipe tree types through pipeline).

---

## 6. TypeScript `extractComponentMapping` Double-Nesting Bug

**Severity:** Medium  
**File:** `src/server/generate/format.ts` (L28–37)

### Problem

The TS version of `extractComponentMapping` has the same bug that was fixed in the Python backend — it includes the opening `<component_mapping>` tag in the extracted text, which then gets double-wrapped when passed to `toTaggedMessage`:

```typescript
return response.slice(startIndex, endIndex);  // includes <component_mapping>
```

### Proposed Fix

```typescript
return response.slice(startIndex + startTag.length, endIndex);
```

### Effort

~5 min, but needs a unit test added.

---

## 7. Mermaid Rendering — Fragile setTimeout for SVG Ready

**Severity:** Low–Medium  
**File:** `src/components/mermaid-diagram.tsx`

### Problem

The component uses `mermaid.contentLoaded()` followed by a hardcoded `setTimeout(100ms)` to wait for SVG rendering before initializing `svg-pan-zoom`. On slow machines or complex diagrams this race can fail, resulting in pan/zoom not working.

### Current Code

```tsx
mermaid.contentLoaded();
setTimeout(() => {
  void initializePanZoom();
}, 100);
```

### Proposed Approach

Use `mermaid.run()` (async, returns when rendering is complete) instead of `contentLoaded()`:

```tsx
const renderMermaid = async () => {
  await mermaid.run({ querySelector: '.mermaid' });
  await initializePanZoom();
};
void renderMermaid();
```

`mermaid.run()` is available in mermaid v10+ and returns a Promise that resolves when all diagrams in the selector are rendered — eliminating the timing issue entirely.

### Effort

~30 min, including testing across themes and diagram sizes.

---

## 8. Remove Unused Python Dependencies

**Severity:** Low  
**File:** `backend/pyproject.toml`

### Problem

Two dependencies are never imported anywhere in the backend:
- `aiohttp==3.13.3` — unused (would be relevant if migrating to async HTTP)
- `tiktoken==0.12.0` — unused (token counting uses the OpenAI API instead)

These add to Docker image size, attack surface, and `uv sync` time.

### Proposed Fix

Remove both from `pyproject.toml` dependencies. If the async HTTP migration (item 1) adopts `httpx`, `aiohttp` is still unnecessary.

### Effort

~5 min.

---

## 9. Python Backend: Missing README Should Not Crash Generation

**Severity:** Medium  
**File:** `backend/app/services/github_service.py` (L186–197)

### Problem

The TypeScript backend was already fixed (QA round 2), but the Python backend's `get_github_readme()` still raises `ValueError("No README found")` for repos without a README, crashing the entire generation pipeline.

### Proposed Fix

Return an empty string instead of raising:

```python
def get_github_readme(self, username: str, repo: str) -> str:
    try:
        data = _fetch_json(...)
    except ValueError:
        return ""    # no README is fine — generate from file tree only

    content = data.get("content")
    if not isinstance(content, str) or not content:
        return ""
    ...
```

### Effort

~10 min.

---

## 10. Error Message Sanitization (Both Backends)

**Severity:** Medium  
**Files:** `backend/app/routers/generate.py`, `src/app/api/generate/stream/route.ts`

### Problem

Both backends return raw `str(exc)` error messages to clients. OpenAI and GitHub API errors can include internal URLs, partial API keys (in auth headers), or rate-limit details.

### Proposed Approach

Create an error classifier that maps known exception types to safe, user-friendly messages:

```python
def safe_error_message(exc: Exception) -> str:
    if isinstance(exc, openai.AuthenticationError):
        return "OpenAI API key is invalid or expired."
    if isinstance(exc, openai.RateLimitError):
        return "OpenAI rate limit exceeded. Please try again later."
    if "GitHub" in str(type(exc).__name__):
        return "GitHub API error. The repository may be private or inaccessible."
    return "An internal error occurred. Please try again."
```

Log the full exception server-side; return only the safe message to the client.

### Effort

~1 hour.

---

## 11. Python Backend: Eliminate Dead `model_config` / `api_key` / `github_pat` Fields

**Severity:** Low  
**Files:** `backend/app/routers/generate.py`, `src/server/generate/types.ts`

### Problem

After the admin-panel refactor, the frontend never sends `api_key`, `github_pat`, or `model_config` in the request body. The Python `GenerateRequest` model and the TypeScript `generateRequestSchema` still accept these fields. In the Python backend, `_resolve_from_model_config()` reads them and uses them — meaning the FastAPI backend still relies on client-supplied secrets while the Next.js backend uses admin DB config.

### Decision Needed

If the FastAPI backend should also use server-side config (like the Next.js backend), these fields and `_resolve_from_model_config()` need to be replaced with an equivalent `getResolvedAdminConfig()` mechanism. If the FastAPI backend is being deprecated in favor of the Next.js route handlers, simply document it and leave as-is.

### Effort

If migrating: ~2 hours (port admin-config DB access to Python). If deprecating: ~10 min (add deprecation notice).

---

## Priority Matrix

| Priority | Item | Impact | Effort |
|----------|------|--------|--------|
| **P0** | 1. Async GitHub HTTP | Fixes event-loop blocking under load | 1–2h |
| **P0** | 6. TS extractComponentMapping | Active bug (double-nested tags) | 5 min |
| **P0** | 9. Python missing README crash | Active bug matching TS fix | 10 min |
| **P1** | 4. Client disconnect detection | Prevents wasted LLM spend | 1h |
| **P1** | 10. Error message sanitization | Security (info leakage) | 1h |
| **P1** | 5. Click event dotfile heuristic | Incorrect GitHub links | 1h |
| **P2** | 2. OpenAI client pooling | Performance (TLS overhead) | 1h |
| **P2** | 3. GitHub App token singleton | Performance (rate limits) | 30 min |
| **P2** | 7. Mermaid `run()` migration | UX reliability | 30 min |
| **P3** | 8. Remove unused deps | Housekeeping | 5 min |
| **P3** | 11. Dead request fields | Housekeeping / architecture decision | varies |
