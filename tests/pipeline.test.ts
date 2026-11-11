import { describe, it, expect, vi, beforeEach } from "vitest";
import { paper, input } from "./fixtures";
import { type AnalysisEvent } from "../src/lib/model";
vi.mock("../src/lib/server/providers", () => ({
  searchProvider: vi.fn(),
  resolvePapers: vi.fn(),
}));
import { searchProvider, resolvePapers } from "../src/lib/server/providers";
import { analyze } from "../src/lib/server/pipeline";
beforeEach(() => {
  vi.mocked(searchProvider).mockReset();
});
describe("actual pipeline states and partial provider failure", () => {
  it("continues with one provider and explicitly records failures", async () => {
    vi.mocked(searchProvider).mockImplementation(async (provider) => {
      if (provider === "Semantic Scholar") throw new Error("Rate limited");
      return [paper()];
    });
    const events: AnalysisEvent[] = [];
    const result = await analyze(input, (e) => events.push(e), false);
    expect(result.papers).toHaveLength(1);
    expect(result.assessment).toBeNull();
    expect(result.warnings.join(" ")).toContain(
      "Semantic Scholar: Rate limited",
    );
    expect(
      events
        .filter((e) => e.type === "progress")
        .map((e) => (e.type === "progress" ? e.stage : "")),
    ).toContain("Deduplicating studies");
  });
  it("reports total failure without substituting fixture records", async () => {
    vi.mocked(searchProvider).mockImplementation(async () => {
      throw new Error("Network denied");
    });
    let failure: unknown;
    try {
      await analyze(input, () => {}, false);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain(
      "No research results were substituted",
    );
  });
  it("allows a successful zero-result search with no AI verdict", async () => {
    vi.mocked(searchProvider).mockResolvedValue([]);
    const result = await analyze(input, () => {}, false);
    expect(result.papers).toEqual([]);
    expect(result.assessment).toBeNull();
  });
});

it("uses selected-network evidence while running additional adversarial searches", async () => {
  vi.mocked(resolvePapers).mockResolvedValue([paper()]);
  vi.mocked(searchProvider).mockResolvedValue([]);
  const result = await analyze(
    { ...input, mode: "challenge", focusPaperIds: [paper().id] },
    () => {},
    false,
  );
  expect(result.papers[0].id).toBe(paper().id);
  expect(result.queries[0]).toContain(paper().title);
  expect(searchProvider).toHaveBeenCalled();
});
