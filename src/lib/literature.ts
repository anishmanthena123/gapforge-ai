import { z } from "zod";
import { safeUrl, type Paper } from "./model";
const OA = z.object({
  id: z.string(),
  display_name: z.string().optional(),
  title: z.string().optional(),
  publication_year: z.number().nullable().optional(),
  doi: z.string().nullable().optional(),
  authorships: z
    .array(z.object({ author: z.object({ display_name: z.string() }) }))
    .optional(),
  abstract_inverted_index: z
    .record(z.string(), z.array(z.number()))
    .nullable()
    .optional(),
  primary_location: z
    .object({
      landing_page_url: z.string().nullable().optional(),
      source: z
        .object({ display_name: z.string().nullable().optional() })
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
  open_access: z
    .object({ oa_url: z.string().nullable().optional() })
    .optional(),
  cited_by_count: z.number().nullable().optional(),
  topics: z.array(z.object({ display_name: z.string() })).optional(),
  referenced_works: z.array(z.string()).optional(),
});
const SS = z.object({
  paperId: z.string(),
  title: z.string(),
  year: z.number().nullable().optional(),
  authors: z.array(z.object({ name: z.string() })).optional(),
  venue: z.string().nullable().optional(),
  abstract: z.string().nullable().optional(),
  externalIds: z
    .object({ DOI: z.string().nullable().optional() })
    .nullable()
    .optional(),
  url: z.string().nullable().optional(),
  openAccessPdf: z
    .object({ url: z.string().nullable().optional() })
    .nullable()
    .optional(),
  citationCount: z.number().nullable().optional(),
  fieldsOfStudy: z.array(z.string()).nullable().optional(),
  references: z
    .array(
      z.object({
        paperId: z.string().nullable().optional(),
        externalIds: z
          .object({ DOI: z.string().nullable().optional() })
          .nullable()
          .optional(),
      }),
    )
    .optional(),
});
export const normalizeDoi = (v: string | null | undefined) =>
  v
    ? v
        .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
        .replace(/^doi:\s*/i, "")
        .trim()
        .toLowerCase()
    : null;
export function restoreAbstract(
  index: Record<string, number[]> | null | undefined,
): string | null {
  if (!index) return null;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index))
    for (const pos of positions) if (pos >= 0 && pos < 50000) words[pos] = word;
  return words.join(" ").trim() || null;
}
export function normalizeOpenAlex(value: unknown): Paper | null {
  const parsed = OA.safeParse(value);
  if (!parsed.success) return null;
  const p = parsed.data;
  const id = p.id.match(/W\d+$/)?.[0];
  const title = p.display_name || p.title;
  if (!id || !title) return null;
  const doi = normalizeDoi(p.doi);
  return {
    id: `oa:${id}`,
    title,
    authors: p.authorships?.map((a) => a.author.display_name) ?? [],
    year: p.publication_year ?? null,
    venue: p.primary_location?.source?.display_name ?? null,
    abstract: restoreAbstract(p.abstract_inverted_index),
    doi,
    openalexId: id,
    semanticId: null,
    url:
      safeUrl(p.primary_location?.landing_page_url) ||
      (doi ? `https://doi.org/${doi}` : `https://openalex.org/${id}`),
    openAccessUrl: safeUrl(p.open_access?.oa_url),
    citations: p.cited_by_count ?? null,
    providers: ["OpenAlex"],
    topics: p.topics?.map((t) => t.display_name) ?? [],
    references:
      p.referenced_works?.map((r) => `oa:${r.split("/").pop()}`) ?? [],
    retrievedAt: new Date().toISOString(),
    relevance: 0,
  };
}
export function normalizeSemanticScholar(value: unknown): Paper | null {
  const parsed = SS.safeParse(value);
  if (!parsed.success) return null;
  const p = parsed.data;
  if (!/^[a-f\d]{40}$/i.test(p.paperId)) return null;
  const doi = normalizeDoi(p.externalIds?.DOI);
  return {
    id: `ss:${p.paperId}`,
    title: p.title,
    authors: p.authors?.map((a) => a.name) ?? [],
    year: p.year ?? null,
    venue: p.venue || null,
    abstract: p.abstract || null,
    doi,
    openalexId: null,
    semanticId: p.paperId,
    url:
      safeUrl(p.url) ||
      (doi
        ? `https://doi.org/${doi}`
        : `https://www.semanticscholar.org/paper/${p.paperId}`),
    openAccessUrl: safeUrl(p.openAccessPdf?.url),
    citations: p.citationCount ?? null,
    providers: ["Semantic Scholar"],
    topics: p.fieldsOfStudy ?? [],
    references:
      p.references?.flatMap((r) =>
        r.paperId
          ? [`ss:${r.paperId}`]
          : r.externalIds?.DOI
            ? [`doi:${normalizeDoi(r.externalIds.DOI)}`]
            : [],
      ) ?? [],
    retrievedAt: new Date().toISOString(),
    relevance: 0,
  };
}
const titleKey = (p: Paper) =>
  `${p.title
    .toLowerCase()
    .normalize("NFKD")
    .replace(
      /[^a-z0-9]+/g,
      "",
    )}:${p.year ?? "unknown"}:${p.authors[0]?.toLowerCase().split(" ").pop() ?? ""}`;
export function deduplicate(papers: Paper[]): Paper[] {
  const list: Paper[] = [];
  const aliases = new Map<string, string>();
  for (const p of papers) {
    const hit = list.find(
      (x) =>
        (p.doi && x.doi === p.doi) ||
        (p.openalexId && x.openalexId === p.openalexId) ||
        (p.semanticId && x.semanticId === p.semanticId) ||
        titleKey(x) === titleKey(p),
    );
    if (!hit) {
      list.push({ ...p });
      continue;
    }
    aliases.set(p.id, hit.id);
    hit.providers = Array.from(new Set([...hit.providers, ...p.providers]));
    hit.abstract ??= p.abstract;
    hit.doi ??= p.doi;
    hit.openalexId ??= p.openalexId;
    hit.semanticId ??= p.semanticId;
    hit.openAccessUrl ??= p.openAccessUrl;
    hit.references = Array.from(new Set([...hit.references, ...p.references]));
    hit.topics = Array.from(new Set([...hit.topics, ...p.topics]));
  }
  for (const p of list) {
    if (p.openalexId) aliases.set(`oa:${p.openalexId}`, p.id);
    if (p.semanticId) aliases.set(`ss:${p.semanticId}`, p.id);
    if (p.doi) aliases.set(`doi:${p.doi}`, p.id);
  }
  return list.map((p) => ({
    ...p,
    references: [
      ...new Set(p.references.map((r) => aliases.get(r) ?? r)),
    ].filter((r) => r !== p.id),
  }));
}
const stop = new Set(
  "the a an of to in for and or with can does how what is are by on from using under this that research study which".split(
    " ",
  ),
);
export function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .match(/[a-z][a-z0-9-]{2,}/g)
      ?.filter((t) => !stop.has(t)) ?? [],
  );
}
export function similarity(a: string, b: string): number {
  const x = tokens(a),
    y = tokens(b);
  const shared = [...x].filter((t) => y.has(t)).length;
  return shared / Math.sqrt(Math.max(1, x.size * y.size));
}
export function rankPapers(papers: Paper[], question: string): Paper[] {
  return papers
    .map((p) => ({
      ...p,
      relevance: similarity(
        question,
        `${p.title} ${p.title} ${p.abstract ?? ""} ${p.topics.join(" ")}`,
      ),
    }))
    .sort((a, b) => b.relevance - a.relevance);
}
export function filterPapers(
  papers: Paper[],
  f: {
    search?: string;
    fromYear?: number;
    venue?: string;
    topic?: string;
    provider?: string;
    openAccess?: boolean;
    minCitations?: number;
  },
) {
  return papers.filter(
    (p) =>
      (!f.search ||
        `${p.title} ${p.authors.join(" ")}`
          .toLowerCase()
          .includes(f.search.toLowerCase())) &&
      (!f.fromYear || (p.year !== null && p.year >= f.fromYear)) &&
      (!f.venue || p.venue === f.venue) &&
      (!f.topic || p.topics.includes(f.topic)) &&
      (!f.provider || p.providers.includes(f.provider as "OpenAlex")) &&
      (!f.openAccess || !!p.openAccessUrl) &&
      (!f.minCitations || (p.citations ?? 0) >= f.minCitations),
  );
}
