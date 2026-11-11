import type { Paper, GraphEdge } from "./model";
import { similarity } from "./literature";
export function buildGraph(papers: Paper[]): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const known = new Set(papers.map((p) => p.id));
  for (const p of papers) {
    for (const ref of p.references)
      if (known.has(ref) && ref !== p.id)
        edges.push({
          id: `cite:${p.id}:${ref}`,
          source: p.id,
          target: ref,
          type: "citation",
          verified: true,
          explanation:
            "The source paper lists the target in its provider-supplied references. An arrow points from the citing paper to the cited paper.",
          evidence: [ref],
          weight: 1,
        });
  }
  for (let i = 0; i < papers.length; i++)
    for (let j = i + 1; j < papers.length; j++) {
      const a = papers[i],
        b = papers[j];
      const common = a.references.filter((r) => b.references.includes(r));
      if (common.length)
        edges.push({
          id: `shared:${a.id}:${b.id}`,
          source: a.id,
          target: b.id,
          type: "shared-reference",
          verified: true,
          explanation: `Provider metadata lists ${common.length} shared reference identifiers (bibliographic coupling).`,
          evidence: common,
          weight: common.length,
        });
      const citing = papers.filter(
        (p) => p.references.includes(a.id) && p.references.includes(b.id),
      );
      if (citing.length)
        edges.push({
          id: `co:${a.id}:${b.id}`,
          source: a.id,
          target: b.id,
          type: "co-citation",
          verified: true,
          explanation:
            "Both papers are cited by the following retrieved studies; coverage is limited to this network.",
          evidence: citing.map((p) => p.id),
          weight: citing.length,
        });
      const sim = similarity(
        `${a.title} ${a.abstract ?? ""}`,
        `${b.title} ${b.abstract ?? ""}`,
      );
      if (sim >= 0.2)
        edges.push({
          id: `sim:${a.id}:${b.id}`,
          source: a.id,
          target: b.id,
          type: "similarity",
          verified: false,
          explanation: `Computationally inferred word overlap (cosine on binary term sets: ${sim.toFixed(2)}). This is not a verified citation or a finding of agreement.`,
          evidence: [],
          weight: sim,
        });
    }
  return edges;
}
export function topicClusters(papers: Paper[]) {
  const groups = new Map<string, Paper[]>();
  for (const p of papers) {
    const label = p.topics[0] || "No provider topic available";
    groups.set(label, [...(groups.get(label) ?? []), p]);
  }
  return [...groups].map(([label, papers]) => ({ label, papers }));
}
export function traceReferences(id: string, papers: Paper[]): Paper[] {
  const seen = new Set<string>();
  const byId = new Map(papers.map((p) => [p.id, p]));
  function visit(key: string) {
    if (seen.has(key)) return;
    seen.add(key);
    byId.get(key)?.references.forEach((r) => {
      if (byId.has(r)) visit(r);
    });
  }
  visit(id);
  return papers
    .filter((p) => seen.has(p.id))
    .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
}
