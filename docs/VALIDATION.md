# Validation record

Validated in the managed development environment using Node.js 24.19.0 and system Chromium. No live paid AI requests, hosted schema changes, or deployment were performed.

| Check                                  | Result                                                     |
| -------------------------------------- | ---------------------------------------------------------- |
| TypeScript strict checking             | Passed                                                     |
| ESLint                                 | Passed, no warnings                                        |
| Vitest unit/integration tests          | 39 passed across 6 files                                   |
| Actual migration/RPC in PGlite         | Passed, including two-user RLS and anonymous access denial |
| Next.js production build               | Passed                                                     |
| Playwright production-server workflows | 5 passed                                                   |
| Landing-page accessibility             | No serious or critical axe violations                      |
| Production dependency audit            | 0 known vulnerabilities reported by npm audit              |

## Coverage

Unit/integration coverage includes OpenAlex and Semantic Scholar response normalization, absent abstracts, invalid IDs and unsafe URLs, DOI/title deduplication, reference-alias integrity, citation direction, shared references, co-citation requirements, verified/inferred edge distinctions, filtering, adversarial queries, focused-network challenges, abstract evidence attribution, novelty schema validation, export reference integrity, local persistence/account namespacing, rate limits/Retry-After, body limits/origin checks, total/partial provider failure, and actual RLS/RPC behavior.

Browser checks cover the landing page, mobile navigation, theme persistence, project creation, metadata display, bookmarks/reading queue, notes/reload, accessible graph node and edge selection, graph PNG download, the separate challenge search, Markdown export, provider error recovery with no substituted papers, unauthenticated cloud denial, experiment generation/edit/save, cited assistant replies, valid PDF output, and landing-page accessibility.

All paper/AI responses used by deterministic tests are explicitly labeled `TEST FIXTURE` and restricted to `tests/` and `e2e/`. The actual production pipeline and SQL migration execute in the tests; provider results and paid AI responses are controlled fixtures. This does not establish live API compatibility.

## External integration limits

The environment's outbound proxy returned `CONNECT tunnel failed, response 403` for both `api.openalex.org` and `api.semanticscholar.org`. No real papers were substituted for those failures. OpenAI was not called with a live key. Supabase clients, authentication, normalized persistence, and migration are implemented, but no hosted migration or live account creation was performed. Email confirmation, session expiry, hosted advisors, live provider field compatibility, and end-to-end cloud save/reopen require a dedicated configured deployment.

The package lockfile was checked with a clean npm install. Default UI screenshots were visually inspected. Accessibility checks cover the landing page and mobile workflow; they are not a complete independent WCAG audit of every research view.

## Repeat locally

```bash
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
npm audit --omit=dev
```

For an existing Linux Chromium installation:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```
