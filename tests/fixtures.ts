// DETERMINISTIC TEST FIXTURES. Invented identifiers and texts; NEVER imported by production code.
import type { Paper, Assessment, ResearchInput } from "../src/lib/model";
export const input: ResearchInput = {
  question:
    "Can counterfactual demonstrations improve robot imitation learning?",
  field: "Robotics",
  fromYear: 1990,
  toYear: 2026,
  depth: "quick",
  maxPapers: 10,
  mode: "research",
};
export const openalexFixture = {
  id: "https://openalex.org/W100",
  display_name: "TEST FIXTURE: Robot learning comparisons",
  publication_year: 2021,
  doi: "https://doi.org/10.0000/fixture-robot",
  authorships: [{ author: { display_name: "Fixture Author" } }],
  abstract_inverted_index: {
    Counterfactual: [0],
    demonstrations: [1],
    are: [2],
    compared: [3],
    in: [4],
    a: [5],
    robot: [6],
    learning: [7],
    test: [8],
  },
  primary_location: {
    landing_page_url: "https://example.org/test-fixture",
    source: { display_name: "Test-only journal" },
  },
  open_access: { oa_url: null },
  cited_by_count: 20,
  topics: [{ display_name: "Test-only robotics" }],
  referenced_works: ["https://openalex.org/W200", "https://openalex.org/W999"],
};
export const semanticFixture = {
  paperId: "a".repeat(40),
  title: "TEST FIXTURE: Robot learning comparisons",
  year: 2021,
  authors: [{ name: "Fixture Author" }],
  externalIds: { DOI: "10.0000/FIXTURE-ROBOT" },
  abstract: null,
  url: "https://example.org/test-fixture",
  citationCount: 21,
  fieldsOfStudy: ["Test-only robotics"],
  references: [{ paperId: "b".repeat(40) }],
};
export const paper = (overrides: Partial<Paper> = {}): Paper => ({
  id: "oa:W100",
  title: "TEST FIXTURE: Robot learning comparisons",
  authors: ["Fixture Author"],
  year: 2021,
  venue: "Test-only journal",
  abstract:
    "Counterfactual demonstrations are compared in a robot learning test",
  doi: "10.0000/fixture-robot",
  openalexId: "W100",
  semanticId: null,
  url: "https://example.org/test-fixture",
  openAccessUrl: null,
  citations: 20,
  providers: ["OpenAlex"],
  topics: ["Test-only robotics"],
  references: ["oa:W200", "oa:W999"],
  retrievedAt: "2026-01-01T00:00:00.000Z",
  relevance: 0.3,
  ...overrides,
});
export const assessment: Assessment = {
  verdict: "Insufficient evidence to assess",
  summary: "TEST FIXTURE: limited abstract-level evidence.",
  comparisons: [
    {
      paperId: "oa:W100",
      classification: "Significant partial overlap",
      question: "Test-only question",
      method: "Test-only comparison",
      finding: "A comparison is described.",
      overlap: "Shared test-only topic",
      difference: "Outcomes are unknown.",
      evidence: "Counterfactual demonstrations are compared",
      limitation: "Test fixture abstract only.",
    },
  ],
  claims: [
    {
      text: "The test abstract describes a comparison.",
      paperIds: ["oa:W100"],
      evidence: "Counterfactual demonstrations are compared",
      limitation: "No full text.",
    },
  ],
  gaps: [],
  revisions: [],
};
