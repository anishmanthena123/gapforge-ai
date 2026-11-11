# Implementation and evidence boundaries

## Source provenance

Provider adapters accept official identifiers, preserve the provider list and retrieval timestamp, restore OpenAlex inverted abstracts, and retain nulls for unavailable authors, venue, year, abstract, DOI, access URL, or citation count. No sample papers ship in the application. Source URLs are limited to HTTP(S).

Deduplication uses DOI, matching provider IDs, then normalized title/year/first-author surname. References to duplicate aliases are canonicalized before graph calculation. Word-overlap ranking is a computational relevance heuristic, not a scientific quality or originality score. Searches use the selected publication window; an early year bound is needed to include older foundational work.

OpenAlex uses cursor pagination; Semantic Scholar uses offsets. Deep searches allow two pages per query, with an explicit final paper cap. Each request has a timeout and bounded exponential retries. Long `Retry-After` values return an actionable limit response instead of repeated requests. One working provider can complete a search; total provider failure creates no completed project. Query and paper caches are process-local, bounded, and expire after 15 minutes.

## AI interpretation

The server uses OpenAI's Responses API `responses.parse()` and `zodTextFormat()`. Research questions, abstracts and metadata are treated as untrusted data in the prompt. No full text is claimed or retrieved. OpenAI storage is disabled with `store: false`.

Structured assessments require categorical verdicts, source identifiers, limitations, and evidence excerpts. Source IDs must be present in the retrieved set. Comparison/claim/gap evidence must appear verbatim in a supplied abstract. Without an abstract, supported findings and methods are marked unavailable; claims and gaps without supporting excerpts are rejected. An invalid synthesis is discarded while preserving retrieved metadata.

Exact excerpt matching is not proof that a generated interpretation logically follows from that excerpt. Human review remains necessary. Revisions and experiments are suggestions and may contain errors. AI request logs do not contain proposals, abstracts, or API keys. Provider error logging includes only host, status, and attempt.

Chat and experiment endpoints receive paper IDs and re-resolve those IDs on the server; they do not trust client-supplied abstracts or arbitrary source URLs. AI endpoints require an OpenAI key and a verified Supabase user unless guest AI is explicitly enabled for a trusted local installation.

## Graph relationships

| Relationship            | Evidence and direction                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Direct citation         | Source paper lists target identifier in provider references. Arrow: citing → cited. Both nodes must be retrieved. |
| Shared references       | Exact intersection of reference identifiers; no third-paper metadata is invented.                                 |
| Co-citation             | A retrieved third paper references both nodes. Limited to retrieved coverage.                                     |
| Word-overlap similarity | Binary term-set cosine on titles and available abstracts. Dashed and explicitly inferred.                         |
| Question relevance      | Computed term overlap with the research question; not a citation.                                                 |

Blue represents the question, violet a term-overlap display threshold, green earlier papers in the retrieved set, orange a direct/significant overlap interpretation from the separate novelty challenge, and gray other records. Green does not establish historical influence. Each selected paper explains its classification.

Groups use the first topic from provider metadata. Timeline positions use publication year. Reference traversal follows only verified backward edges. There is no asserted contradiction, shared methodology, inferred historical influence, or gap based solely on a missing link.

## Storage and authorization

Browser storage is separated by verified account ID, with a guest namespace. Importing guest projects is explicit. Cloud loading ignores stale authentication responses after an account switch. Cloud upload is an explicit action and re-verifies provider metadata first.

All 15 public tables enable RLS. Policies restrict rows to `auth.uid()`, include update `WITH CHECK`, and target the authenticated role. Private child tables use `(project_id, owner_id)` and `(paper_id, owner_id)` foreign keys so users cannot attach data to another user's project. No user-editable JWT metadata grants permission. The save RPC is `SECURITY INVOKER`, uses an empty search path, checks authentication, and is revoked from anonymous/public execution.

Paper metadata is stored once within an account and linked to its projects. Query history, references, graph edges, groups, assessments, saved gaps, experiments, and notes are normalized. The API ignores client paper metadata when writing the cloud catalogue. A user can edit their own interpretation/notes directly; the database does not independently certify scientific truth.

The schema was validated in local PostgreSQL-compatible PGlite using two users and anonymous/authenticated roles. Hosted Supabase advisors and email confirmation were not run because no hosted schema changes or live account actions were authorized by the brief. Run advisors in your dedicated deployment before public launch.

## Retry and cancellation

Analysis streams actual stage transitions over NDJSON. The browser stores the input before starting, cancels on request, and creates a project only after the terminal result. A total failure leaves the draft available for retry. Server requests are cancellable, have per-provider timeouts, and have a four-minute analysis deadline. Retrying is safe for reads and the cloud save RPC is transactional/idempotent. This is not a durable queue or checkpoint-resume implementation.

## Documentation reviewed

- Installed Next.js 16.4.6 App Router, route-handler, cookie, server/client component, and deployment guides in `node_modules/next/dist/docs/`.
- [OpenAI Structured Outputs Node example](https://github.com/openai/openai-node/blob/master/examples/responses/structured-outputs.ts) and [SDK README](https://github.com/openai/openai-node).
- [OpenAlex API documentation](https://docs.openalex.org/) and [official documentation repository](https://github.com/ourresearch/openalex-docs). Some published authentication guidance differs by API policy generation; provider errors remain visible and no fixed free quota is promised.
- [Semantic Scholar Academic Graph](https://api.semanticscholar.org/api-docs/graph). Live documentation/API access was blocked in this environment; field compatibility needs live verification.
- [Supabase changelog](https://supabase.com/changelog), server-side auth/client guidance via connected documentation, [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), and [API key guidance](https://supabase.com/docs/guides/api/api-keys).
