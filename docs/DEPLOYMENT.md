# Deployment guide

No deployment was performed. The application requires a Node.js server; a static GitHub Pages export cannot run its API routes.

## Small private installation

1. Create/review a dedicated Supabase project, apply the migration, enable email/password auth, and run Supabase security/performance advisors. Validate with two real test accounts that users cannot read or write each other's projects.
2. Supply public Supabase values before the frontend build. Supply provider keys only as server-side environment secrets. Keep `ALLOW_GUEST_AI=false` for a hosted installation.
3. On a Node.js 24 host, run `npm ci`, `npm run check`, then `npm run start`. For a managed Next.js host, use `npm ci`, build command `npm run build`, and the provider's Node runtime. Do not use static export.
4. Configure HTTPS, your Supabase Site URL and confirmation redirects. Keep authenticated API responses private/no-store. Do not cache Set-Cookie responses.
5. Allow outbound HTTPS to `api.openalex.org`, `api.semanticscholar.org`, `api.openai.com`, and your Supabase project host. Preserve the deployment's TLS trust and proxy configuration. In a Node 24 environment requiring an HTTP proxy, enable Node's supported environment-proxy behavior or use your platform's supported agent configuration.
6. Ensure the platform supports streaming responses and a five-minute route duration. The analysis itself has a four-minute deadline. Use quick searches on hosts with shorter limits, or move jobs to a worker before offering deep searches.
7. Verify a real literature search, one-provider failure recovery, a novelty challenge, account sign-in, cloud save/reopen, graph selection, and Markdown/PDF exports. Review actual returned abstracts and references manually.

## Public and multi-instance hosting

The in-memory cache and IP request buckets are suitable only for a modest single-process installation. Before a public launch:

- Use a shared rate limiter/cache and verified user-level quotas; normalize forwarding headers only at a trusted reverse proxy. Current IP buckets are not a billing or abuse-control guarantee.
- Move deep analysis to a durable queue with persistent job checkpoints, retry/backoff scheduling, cancellation, and bounded parallel provider calls. Wire the reserved `analysis_jobs` table to that worker.
- Add paginated cloud reads and server-side paper search; the initial UI loads a modest catalogue and does not promise unlimited history.
- Add per-account provider budgets, monitoring, provider circuit breakers, and a secret-rotation procedure. Configure CSP with Next.js-compatible nonces and complete an environment-specific security review.
- Use a proper Unicode font/subsetting pipeline for publication-ready PDF reports, and review typography, citations, and scientific interpretation with representative research topics.
- Verify Supabase advisors, deployed email confirmation and session expiry, independent browser accessibility on core research pages, and real provider integration tests using approved credentials.

## Database migration behavior

`save_research_project(payload)` executes in one transaction and obeys RLS. It reuses paper metadata across the user's projects, replaces project links/derived graph rows, upserts notes, and retains query history without duplicate retries. No service-role key is needed.

Deleting a project from the UI removes only that browser's copy. Cloud deletion is intentionally not presented as an implemented action. For account retention/deletion policies, add a clearly confirmed cloud deletion flow and comply with your deployment's data policy before inviting external users.
