import { describe, it, expect } from "vitest";
import { AssessmentSchema, InputSchema, makeProject } from "../src/lib/model";
import { validateAttribution, heuristicConcepts } from "../src/lib/server/ai";
import { markdownReport, bibtex } from "../src/lib/report";
import { readProjects, writeProjects, mergeProjects } from "../src/lib/storage";
import { assessment, paper, input } from "./fixtures";
const result = {
  papers: [paper()],
  queries: ["test fixture query"],
  concepts: heuristicConcepts(input),
  warnings: [],
  assessment,
};
describe("evidence boundaries", () => {
  it("rejects numeric or guaranteed originality verdicts", () => {
    expect(
      AssessmentSchema.safeParse({ ...assessment, verdict: "100% novel" })
        .success,
    ).toBe(false);
  });
  it("rejects unknown paper attribution", () => {
    expect(() =>
      validateAttribution(
        {
          ...assessment,
          claims: [{ ...assessment.claims[0], paperIds: ["invented"] }],
        },
        [paper()],
      ),
    ).toThrow("outside");
  });
  it("rejects invented abstract quotations", () => {
    expect(() =>
      validateAttribution(
        {
          ...assessment,
          claims: [
            { ...assessment.claims[0], evidence: "This result was invented." },
          ],
        },
        [paper()],
      ),
    ).toThrow("verifiable");
  });
  it("does not infer findings from a missing abstract", () => {
    const a = validateAttribution(
      {
        ...assessment,
        claims: [],
        comparisons: assessment.comparisons.map((x) => ({ ...x })),
      },
      [paper({ abstract: null })],
    );
    expect(a.comparisons[0].classification).toBe("Insufficient information");
    expect(a.comparisons[0].finding).toContain("cannot be verified");
  });
  it("generates distinct adversarial searches", () => {
    const normal = heuristicConcepts(input),
      challenge = heuristicConcepts({ ...input, mode: "challenge" });
    expect(challenge.queries.length).toBeGreaterThan(normal.queries.length);
    expect(challenge.terminology).toContain("causal intervention");
  });
  it("rejects invalid question bounds and year ranges", () => {
    expect(InputSchema.safeParse({ ...input, question: "tiny" }).success).toBe(
      false,
    );
    expect(
      InputSchema.safeParse({ ...input, fromYear: 2026, toYear: 1990 }).success,
    ).toBe(false);
  });
});
describe("persistence and reports", () => {
  it("roundtrips projects without fabricating missing abstracts", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, v: string) => data.set(key, v),
    };
    const p = makeProject(input, result);
    writeProjects(storage, [p]);
    expect(readProjects(storage)[0]).toEqual(p);
    expect(readProjects(storage, "other-user")).toEqual([]);
  });
  it("handles corrupt local state and chooses newer versions", () => {
    expect(readProjects({ getItem: () => "{invalid" })).toEqual([]);
    const p = makeProject(input, result),
      newer = { ...p, updatedAt: "2099-01-01T00:00:00Z", notes: "newer note" };
    expect(mergeProjects([p], [newer])[0].notes).toBe("newer note");
  });
  it("exports only stored references with provenance and limitations", () => {
    const p = makeProject(input, {
      ...result,
      papers: [paper({ abstract: null })],
      assessment: null,
    });
    const report = markdownReport(p);
    expect(report).toContain("Abstract unavailable.");
    expect(report).toContain("10.0000/fixture-robot");
    expect(report).toContain("full text was not processed");
    expect(report).not.toContain("guaranteed original");
    expect(bibtex(p.papers)).toContain("Fixture Author");
  });
});
it("refuses to export an invented reference outside the retrieved project", () => {
  const p = makeProject(input, result);
  p.assessment = {
    ...assessment,
    claims: [{ ...assessment.claims[0], paperIds: ["invented-source"] }],
  };
  expect(() => markdownReport(p)).toThrow("outside the verified project");
});
