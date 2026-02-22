# C4 Diagrams – Audit Report

---

## Evidence Summary – Files Inspected

### Configuration & Infrastructure
| File | Purpose |
|---|---|
| `package.json` | Frontend deps (Next.js 16, React 19, Mermaid 11, Drizzle ORM, OpenAI SDK, Neon, PostHog, svg-pan-zoom) |
| `backend/pyproject.toml` | Backend deps (FastAPI, httpx, openai, PyJWT, uvicorn, api-analytics) |
| `docker-compose.yml` | Single `api` service (FastAPI backend on port 8000) |
| `drizzle.config.ts` | Drizzle → PostgreSQL, table prefix `gitdiagram_*` |
| `next.config.js` | PostHog proxy rewrites, env validation |
| `src/env.js` | Server env schema: POSTGRES_URL, ADMIN_SECRET |
| `start-database.sh` | Local Postgres setup script |

### Frontend (Next.js)
| File | Purpose |
|---|---|
| `src/app/page.tsx` | Home page with Hero + MainCard |
| `src/app/layout.tsx` | Root layout, Header, PostHog + Theme providers |
| `src/app/providers.tsx` | PostHog client init, ThemeProvider (next-themes) |
| `src/app/[username]/[repo]/` | Dynamic repo diagram page |
| `src/app/admin/` | Admin panel (settings, prompts, cache, audit) |
| `src/middleware.ts` | Admin auth middleware (ADMIN_SECRET via header/cookie/query) |
| `src/hooks/useDiagram.ts` | Main diagram orchestration hook |
| `src/hooks/diagram/useDiagramStream.ts` | SSE stream state machine |
| `src/features/diagram/api.ts` | API client routing (FastAPI vs legacy) |
| `src/features/diagram/sse.ts` | SSE buffer parser |
| `src/features/diagram/github-url.ts` | GitHub URL parser |
| `src/components/mermaid-diagram.tsx` | Mermaid renderer + svg-pan-zoom |
| `src/app/_actions/cache.ts` | Server actions: diagram cache CRUD, version history |
| `src/app/_actions/admin.ts` | Server actions: admin settings |
| `src/app/_actions/prompts.ts` | Server actions: prompt management |
| `src/server/db/index.ts` | DB client (Neon HTTP for prod, postgres.js for dev) |
| `src/server/db/schema.ts` | 6 tables: diagram_cache, diagram_history, admin_settings, prompt_sets, prompt_stages, prompt_history, admin_audit_log |
| `src/server/generate/github.ts` | TypeScript GitHub client (mirrors backend) |
| `src/server/generate/openai.ts` | TypeScript OpenAI/Azure OpenAI streaming client |
| `src/server/generate/mermaid.ts` | In-process Mermaid.parse() validator with DOMPurify patching |
| `src/server/generate/prompts.ts` | TypeScript prompt mirrors |
| `src/app/api/generate/stream/route.ts` | Legacy SSE stream route handler |
| `src/app/api/generate/cost/route.ts` | Legacy cost estimation route handler |

### Backend (FastAPI)
| File | Purpose |
|---|---|
| `backend/app/main.py` | FastAPI app: CORS, API Analytics, lifespan, health check |
| `backend/app/routers/generate.py` | `/generate/stream` (SSE) + `/generate/cost` — full 3-stage pipeline + Mermaid fix loop |
| `backend/app/services/github_service.py` | GitHub API client: PAT + GitHub App auth (JWT+installation token), file tree, README |
| `backend/app/services/openai_service.py` | Async OpenAI/Azure OpenAI client pool, stream_completion, count_input_tokens |
| `backend/app/services/mermaid_service.py` | Mermaid syntax validation via Node.js subprocess |
| `backend/app/services/model_config.py` | Model resolution from OPENAI_MODEL env var (default: gpt-5.2) |
| `backend/app/services/pricing.py` | Token cost estimation with model pricing tables |
| `backend/app/prompts.py` | 4 system prompts: explanation, mapping, diagram, fix |
| `backend/app/core/observability.py` | Structured JSON logging + Timer |
| `backend/app/core/errors.py` | Safe error message mapping |
| `backend/app/utils/format_message.py` | User message formatting |
| `backend/scripts/validate_mermaid.mjs` | Node.js Mermaid validator subprocess |

---

## Assumptions Made

1. **Deployment mapping**: Based on CLAUDE.md and configuration evidence, the Next.js frontend is deployed to Vercel and the FastAPI backend to Railway. These deployment targets are documented but not verified from infrastructure-as-code.
2. **PostHog is an external system**: PostHog is initialized client-side in `providers.tsx` with a proxied API host. Treated as an external analytics system.
3. **API Analytics**: The `api-analytics` middleware in `main.py` sends data externally; since its destination is opaque (only an API key is configured), it is not shown as a separate external system. It could be added if the target is confirmed.
4. **Database is Neon Serverless Postgres in production**: Based on `src/server/db/index.ts` which checks `POSTGRES_URL` for `neon.tech`.
5. **GitHub App auth is production-ready**: The `GitHubService` class implements JWT-based GitHub App authentication as a fallback when PAT is unavailable.

---

## Uncertainties

1. **Exact deployment topology**: No Terraform, Pulumi, or Railway/Vercel config files were found in the repository. The Vercel/Railway mapping comes from CLAUDE.md documentation only.
2. **API Analytics destination**: The `api-analytics` PyPI package is used but the external service it reports to is not explicitly named in the code.
3. **Rate limiting implementation**: The frontend handles 429 responses, but no rate limiting middleware was found in the backend code. It may be handled at the infrastructure level (Railway, Vercel, or nginx).
4. **nginx configuration**: `backend/nginx/api.conf` exists but was not deeply inspected. It may provide reverse proxy / rate limiting in front of the FastAPI backend.

---

## Missing Information

1. **Infrastructure-as-code**: No Terraform, Pulumi, CDK, or Railway/Vercel deployment configuration files.
2. **CI/CD pipeline**: No GitHub Actions, CircleCI, or other CI configuration was found (may exist in the default branch but not in `feature/web`).
3. **Monitoring/alerting**: Beyond the structured logging in `observability.py`, no external monitoring integration (Datadog, Sentry, etc.) was found.
4. **Authentication for end users**: No user authentication system was found; admin access uses a shared secret. End users are anonymous.

---

## Suggested Next Steps

1. **Add infrastructure-as-code** (e.g., `vercel.json`, Railway config, or Terraform) to make deployment topology verifiable.
2. **Document the API Analytics target** in environment variable documentation.
3. **Inspect nginx config** (`backend/nginx/api.conf`) to determine if it introduces additional architectural elements (rate limiting, SSL termination).
4. **Add CI/CD pipeline** configuration to the repository.
5. **Consider adding Sentry or similar** for error tracking to complement the structured logging.

---

## Syntax Validation Results

All four diagrams were validated against the project's own Mermaid validator (`backend/scripts/validate_mermaid.mjs`):

| File | Result |
|---|---|
| `c4/c4-context.mmd` | `{"valid":true}` |
| `c4/c4-container.mmd` | `{"valid":true}` |
| `c4/c4-component.mmd` | `{"valid":true}` |
| `c4/c4-code.mmd` | `{"valid":true}` |

---

## Gap Analysis

| Area | Status | Notes |
|---|---|---|
| Users & actors | Complete | End User and Admin identified from code |
| External systems | Complete | GitHub API, OpenAI/Azure OpenAI, PostHog |
| Containers | Complete | Next.js frontend, FastAPI backend, legacy backend, PostgreSQL, Mermaid validator |
| Components (frontend) | Complete | All major hooks, actions, pages, services mapped |
| Components (backend) | Complete | All services, router, prompts, pricing, observability mapped |
| Code-level (pipeline) | Complete | Full 3-stage + fix loop sequence documented |
| Database schema | Documented | 6 tables identified in schema.ts |
| Auth flows | Documented | GitHub PAT/App auth, Admin ADMIN_SECRET middleware |
| Deployment | Partial | Documented in CLAUDE.md but no IaC in repo |
