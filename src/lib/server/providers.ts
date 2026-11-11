import "server-only";
import {
  normalizeOpenAlex,
  normalizeSemanticScholar,
  deduplicate,
} from "@/lib/literature";
import type { Paper, ResearchInput } from "@/lib/model";
import { fetchJson } from "./http";
const cache = new Map<string, { until: number; papers: Paper[] }>();
function remember(key: string, papers: Paper[]) {
  if (cache.size >= 500) cache.delete(cache.keys().next().value!);
  cache.set(key, { until: Date.now() + 15 * 60000, papers });
  for (const p of papers) {
    cache.set(p.id, { until: Date.now() + 15 * 60000, papers: [p] });
  }
  if (cache.size > 1000) {
    for (const [k, v] of cache) if (v.until < Date.now()) cache.delete(k);
    while (cache.size > 1000) cache.delete(cache.keys().next().value!);
  }
}
const ssFields =
  "title,authors,year,venue,abstract,externalIds,url,openAccessPdf,citationCount,fieldsOfStudy,references.paperId,references.externalIds";
function oaUrl(path: string) {
  const url = new URL(`https://api.openalex.org/${path}`);
  if (process.env.OPENALEX_API_KEY)
    url.searchParams.set("api_key", process.env.OPENALEX_API_KEY);
  return url;
}
function ssInit(signal?: AbortSignal): RequestInit {
  return {
    signal,
    headers: process.env.SEMANTIC_SCHOLAR_API_KEY
      ? { "x-api-key": process.env.SEMANTIC_SCHOLAR_API_KEY }
      : {},
  };
}
export async function searchProvider(
  provider: "OpenAlex" | "Semantic Scholar",
  query: string,
  input: ResearchInput,
  signal?: AbortSignal,
): Promise<Paper[]> {
  const key = JSON.stringify([
    provider,
    query,
    input.fromYear,
    input.toYear,
    input.maxPapers,
    input.depth,
  ]);
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return cached.papers;
  const papers: Paper[] = [];
  const pages = input.depth === "deep" ? 2 : 1;
  let cursor = "*";
  for (let page = 0; page < pages && papers.length < input.maxPapers; page++) {
    let data: unknown;
    if (provider === "OpenAlex") {
      const url = oaUrl("works");
      url.searchParams.set("search", query);
      url.searchParams.set(
        "filter",
        `from_publication_date:${input.fromYear}-01-01,to_publication_date:${input.toYear}-12-31,is_retracted:false`,
      );
      url.searchParams.set("per-page", String(Math.min(50, input.maxPapers)));
      url.searchParams.set("cursor", cursor);
      data = await fetchJson(url.href, { signal });
      const result = data as {
        results?: unknown[];
        meta?: { next_cursor?: string };
      };
      if (!Array.isArray(result.results))
        throw new Error("OpenAlex returned an invalid response.");
      papers.push(
        ...(result.results ?? [])
          .map(normalizeOpenAlex)
          .filter((p): p is Paper => !!p),
      );
      if (!result.meta?.next_cursor) break;
      cursor = result.meta.next_cursor;
    } else {
      const url = new URL(
        "https://api.semanticscholar.org/graph/v1/paper/search",
      );
      url.searchParams.set("query", query);
      url.searchParams.set("year", `${input.fromYear}:${input.toYear}`);
      url.searchParams.set("limit", String(Math.min(50, input.maxPapers)));
      url.searchParams.set(
        "offset",
        String(page * Math.min(50, input.maxPapers)),
      );
      url.searchParams.set("fields", ssFields);
      data = await fetchJson(url.href, ssInit(signal));
      const result = data as { data?: unknown[]; next?: number };
      if (!Array.isArray(result.data))
        throw new Error("Semantic Scholar returned an invalid response.");
      papers.push(
        ...(result.data ?? [])
          .map(normalizeSemanticScholar)
          .filter((p): p is Paper => !!p),
      );
      if (!result.next) break;
    }
  }
  remember(key, papers);
  return papers;
}
export async function resolvePapers(
  ids: string[],
  signal?: AbortSignal,
): Promise<Paper[]> {
  const papers: Paper[] = [];
  for (const id of [...new Set(ids)].slice(0, 100)) {
    const found = cache.get(id);
    if (found && found.until > Date.now()) {
      papers.push(...found.papers);
      continue;
    }
    try {
      let paper: Paper | null = null;
      if (/^oa:W\d+$/.test(id)) {
        paper = normalizeOpenAlex(
          await fetchJson(oaUrl(`works/${id.slice(3)}`).href, { signal }),
        );
      } else if (/^ss:[a-f\d]{40}$/i.test(id)) {
        const url = new URL(
          `https://api.semanticscholar.org/graph/v1/paper/${id.slice(3)}`,
        );
        url.searchParams.set("fields", ssFields);
        paper = normalizeSemanticScholar(
          await fetchJson(url.href, ssInit(signal)),
        );
      }
      if (paper) {
        remember(paper.id, [paper]);
        papers.push(paper);
      }
    } catch {
      if (signal?.aborted) throw new Error("Request cancelled.");
    }
  }
  return deduplicate(papers);
}
