import { describe, it, expect } from "vitest";
import {
  normalizeOpenAlex,
  normalizeSemanticScholar,
  deduplicate,
  restoreAbstract,
  filterPapers,
} from "../src/lib/literature";
import { buildGraph, traceReferences } from "../src/lib/graph";
import { openalexFixture, semanticFixture, paper } from "./fixtures";
describe("provider normalization and provenance", () => {
  it("normalizes OpenAlex without inventing metadata", () => {
    const p = normalizeOpenAlex(openalexFixture)!;
    expect(p.id).toBe("oa:W100");
    expect(p.doi).toBe("10.0000/fixture-robot");
    expect(p.abstract).toBe(
      "Counterfactual demonstrations are compared in a robot learning test",
    );
    expect(p.references).toEqual(["oa:W200", "oa:W999"]);
    expect(p.providers).toEqual(["OpenAlex"]);
  });
  it("normalizes Semantic Scholar and preserves absent abstracts", () => {
    const p = normalizeSemanticScholar(semanticFixture)!;
    expect(p.abstract).toBeNull();
    expect(p.semanticId).toBe("a".repeat(40));
    expect(p.providers).toEqual(["Semantic Scholar"]);
  });
  it("rejects malformed or unverifiable identifiers", () => {
    expect(normalizeOpenAlex({ id: "invented", title: "Fake" })).toBeNull();
    expect(
      normalizeSemanticScholar({ ...semanticFixture, paperId: "fake" }),
    ).toBeNull();
  });
  it("preserves missing abstracts and missing authors", () => {
    expect(restoreAbstract(null)).toBeNull();
    expect(
      normalizeOpenAlex({
        id: "https://openalex.org/W101",
        title: "TEST FIXTURE",
      })?.authors,
    ).toEqual([]);
  });
  it("removes unsafe publication URLs", () =>
    expect(
      normalizeOpenAlex({
        ...openalexFixture,
        doi: null,
        primary_location: { landing_page_url: "javascript:alert(1)" },
      })?.url,
    ).toBe("https://openalex.org/W100"));
});
describe("deduplication and graph integrity", () => {
  it("merges DOI duplicates and cross-provider reference aliases", () => {
    const a = normalizeOpenAlex(openalexFixture)!;
    const b = normalizeSemanticScholar(semanticFixture)!;
    const c = paper({
      id: "oa:W300",
      title: "TEST FIXTURE: A different paper",
      doi: null,
      openalexId: "W300",
      references: [b.id],
    });
    const result = deduplicate([a, b, c]);
    expect(result).toHaveLength(2);
    expect(result[0].providers).toHaveLength(2);
    expect(result[1].references).toEqual([a.id]);
  });
  it("deduplicates title/year/author but distinguishes different authors", () => {
    const a = paper({ doi: null });
    expect(
      deduplicate([a, { ...a, id: "oa:W101", openalexId: "W101" }]),
    ).toHaveLength(1);
    expect(
      deduplicate([
        a,
        {
          ...a,
          id: "oa:W101",
          openalexId: "W101",
          authors: ["Different Person"],
        },
      ]),
    ).toHaveLength(2);
  });
  it("uses citing → cited direction and never adds unretrieved nodes", () => {
    const a = paper(),
      b = paper({
        id: "oa:W200",
        title: "TEST FIXTURE: earlier comparison",
        openalexId: "W200",
        doi: null,
        year: 2019,
        references: [],
      });
    const edges = buildGraph([a, b]);
    expect(edges.find((e) => e.type === "citation")).toMatchObject({
      source: a.id,
      target: b.id,
      verified: true,
    });
    expect(
      edges
        .filter((e) => e.type === "citation")
        .some((e) => e.target === "oa:W999"),
    ).toBe(false);
    expect(traceReferences(a.id, [a, b]).map((p) => p.id)).toEqual([
      b.id,
      a.id,
    ]);
  });
  it("calculates bibliographic coupling and labels inferred similarity", () => {
    const edges = buildGraph([
      paper(),
      paper({
        id: "oa:W201",
        openalexId: "W201",
        doi: null,
        references: ["oa:W999"],
      }),
    ]);
    expect(edges.find((e) => e.type === "shared-reference")?.evidence).toEqual([
      "oa:W999",
    ]);
    expect(edges.find((e) => e.type === "similarity")?.verified).toBe(false);
  });
  it("only creates co-citation from a retrieved third paper", () => {
    const a = paper({ references: [] }),
      b = paper({ id: "oa:W200", references: [] }),
      c = paper({ id: "oa:W300", references: [a.id, b.id] });
    expect(
      buildGraph([a, b]).filter((e) => e.type === "co-citation"),
    ).toHaveLength(0);
    expect(
      buildGraph([a, b, c]).find((e) => e.type === "co-citation")?.evidence,
    ).toEqual([c.id]);
  });
  it("filters papers by supported metadata", () => {
    const a = paper(),
      b = paper({
        id: "oa:W200",
        year: 2025,
        openAccessUrl: "https://example.org/open",
        citations: 4,
      });
    expect(
      filterPapers([a, b], { fromYear: 2024, openAccess: true }).map(
        (p) => p.id,
      ),
    ).toEqual([b.id]);
    expect(filterPapers([a, b], { minCitations: 10 }).map((p) => p.id)).toEqual(
      [a.id],
    );
    expect(filterPapers([a, b], { topic: "missing" })).toEqual([]);
  });
});
