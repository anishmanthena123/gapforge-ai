import "server-only";
import { rankPapers, deduplicate } from "@/lib/literature";
import {
  stages,
  type ResearchInput,
  type AnalysisResult,
  type AnalysisEvent,
  type Paper,
} from "@/lib/model";
import { extractConcepts, assess } from "./ai";
import { searchProvider, resolvePapers } from "./providers";
export async function analyze(
  input: ResearchInput,
  emit: (event: AnalysisEvent) => void,
  useAI: boolean,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const warnings: string[] = [];
  emit({ type: "progress", stage: stages[0] });
  let concepts;
  try {
    concepts = await extractConcepts(input, useAI, signal);
  } catch {
    if (signal?.aborted) throw new Error("Analysis cancelled.");
    concepts = await extractConcepts(input, false, signal);
    warnings.push(
      "AI concept extraction failed; search queries use a transparent terminology heuristic.",
    );
  }
  if (!useAI)
    warnings.push(
      "AI synthesis is unavailable. Queries use a terminology heuristic; no AI findings or novelty verdict were generated.",
    );
  emit({
    type: "progress",
    stage: stages[1],
    detail: `${concepts.queries.length} search queries · ${concepts.field}`,
  });
  const focus = input.focusPaperIds?.length
    ? await resolvePapers(input.focusPaperIds, signal)
    : [];
  if (input.focusPaperIds?.length && !focus.length)
    warnings.push(
      "Selected-network records could not be re-verified; the challenge uses the research question only.",
    );
  if (focus.length)
    concepts.queries = [
      ...new Set([
        ...focus
          .slice(0, 2)
          .map(
            (p) =>
              `${p.title.slice(0, 140)} ${concepts.concepts.slice(0, 3).join(" ")}`,
          ),
        ...concepts.queries,
      ]),
    ];
  const queries = concepts.queries.slice(
    0,
    input.depth === "quick" ? 2 : input.depth === "balanced" ? 4 : 8,
  );
  const all: Paper[] = [...focus];
  let successes = 0;
  emit({ type: "progress", stage: stages[2] });
  for (const [i, query] of queries.entries()) {
    if (signal?.aborted) throw new Error("Analysis cancelled.");
    const result = await Promise.allSettled([
      searchProvider("OpenAlex", query, input, signal),
      searchProvider("Semantic Scholar", query, input, signal),
    ]);
    result.forEach((r, n) => {
      const provider = n === 0 ? "OpenAlex" : "Semantic Scholar";
      if (r.status === "fulfilled") {
        all.push(...r.value);
        successes++;
      } else {
        warnings.push(
          `${provider}: ${r.reason instanceof Error ? r.reason.message : "Search failed."}`,
        );
      }
    });
    emit({
      type: "progress",
      stage: stages[2],
      detail: `Completed query ${i + 1} of ${queries.length}; ${all.length} records received.`,
    });
  }
  if (!successes)
    throw new Error(
      `Literature search failed. ${[...new Set(warnings.filter((w) => !w.startsWith("AI")))].join(" ")} No research results were substituted.`,
    );
  emit({ type: "progress", stage: stages[3] });
  const unique = deduplicate(all);
  emit({ type: "progress", stage: stages[4] });
  const papers = rankPapers(unique, input.question).slice(0, input.maxPapers);
  emit({
    type: "progress",
    stage: stages[5],
    detail: `${papers.length} unique studies; ${papers.filter((p) => p.abstract).length} abstracts available.`,
  });
  let assessment = null;
  if (useAI && papers.length) {
    try {
      assessment = await assess(input.question, papers, input.mode, signal);
    } catch {
      if (signal?.aborted) throw new Error("Analysis cancelled.");
      warnings.push(
        "AI synthesis failed evidence validation or the provider was unavailable. Retrieved metadata is preserved; no verdict was substituted.",
      );
    }
  }
  emit({
    type: "progress",
    stage: stages[6],
    detail: assessment
      ? "Abstract-level assessment complete."
      : "No supported AI novelty verdict available.",
  });
  emit({ type: "progress", stage: stages[7] });
  return {
    papers,
    queries,
    concepts,
    warnings: [...new Set(warnings)],
    assessment,
  };
}
