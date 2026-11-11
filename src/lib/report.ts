import type { Project, Paper, Assessment } from "./model";
import { assertProjectIntegrity } from "./integrity";
import { buildGraph } from "./graph";
export function citation(p: Paper) {
  return `${p.authors.length ? p.authors.join(", ") : "Authors unavailable"} (${p.year ?? "Year unavailable"}). ${p.title}. ${p.venue ?? ""} ${p.doi ? `https://doi.org/${p.doi}` : (p.url ?? "")}`.trim();
}
function assessmentLines(a: Assessment | null, papers: Paper[]) {
  if (!a)
    return [
      "Insufficient evidence to assess. No supported AI synthesis is available.",
    ];
  const ref = (ids: string[]) =>
    ids
      .map((id) => papers.find((p) => p.id === id))
      .filter((p): p is Paper => !!p)
      .map((p) => `[${p.title}](${p.url ?? ""})`)
      .join("; ");
  return [
    `**${a.verdict}**`,
    a.summary,
    ...a.comparisons.map(
      (c) =>
        `### ${papers.find((p) => p.id === c.paperId)?.title ?? "Unresolved source (excluded)"}\nAI interpretation: ${c.classification}\nQuestion: ${c.question}\nMethod: ${c.method}\nSupported finding: ${c.finding}\nOverlap: ${c.overlap}\nDifference: ${c.difference}\nRetrieved abstract evidence: ${c.evidence}\nLimitations: ${c.limitation}`,
    ),
    ...a.claims.map(
      (c) =>
        `${c.text}\nSources: ${ref(c.paperIds)}\nEvidence: ${c.evidence}\nLimitations: ${c.limitation}`,
    ),
    ...a.gaps.map(
      (g) =>
        `### Provisional gap: ${g.title}\n${g.explanation}\nSupporting sources: ${ref(g.supportingPaperIds)}\nChallenging sources: ${ref(g.challengingPaperIds)}\nEvidence: ${g.evidence}\nLimitations: ${g.limitation}\nSuggested searches: ${g.suggestedSearches.join("; ")}\nProposed experiment: ${g.experiment}`,
    ),
    ...a.revisions.map(
      (r) =>
        `### Provisional revised question\n${r.question}\n${r.difference}\nPrior work: ${ref(r.paperIds)}\nExperiment: ${r.experiment}\nRisks: ${r.risk}\nDifficulty: ${r.difficulty}\nResources: ${r.resources}`,
    ),
  ];
}
export function markdownReport(p: Project): string {
  assertProjectIntegrity(p);
  const edges = buildGraph(p.papers);
  return [
    `# GapForge AI Research Report`,
    `Generated ${new Date().toISOString()} · Metadata/abstract-level review; full text was not processed.`,
    `## Research question`,
    p.question,
    `## Background and search methodology`,
    `Field: ${p.concepts.field}\nPublication range: ${p.input.fromYear}–${p.input.toYear}\nDepth: ${p.input.depth}\nSearch history: ${JSON.stringify(p.searchHistory)}\nQueries:\n${p.queries.map((q) => `- ${q}`).join("\n")}`,
    `## Retrieved literature`,
    ...p.papers.map(
      (x) =>
        `### ${x.title}\n${citation(x)}\nProvider: ${x.providers.join(", ")} · Retrieved: ${x.retrievedAt}\n${x.abstract ? `Retrieved abstract: ${x.abstract}` : "Abstract unavailable."}`,
    ),
    `## Closest existing studies and novelty assessment`,
    ...assessmentLines(p.assessment, p.papers),
    `## Adversarial novelty challenge`,
    `Targeted queries: ${p.challengeQueries.join("; ") || "No separate challenge has been run."}`,
    ...assessmentLines(p.challenge, p.papers),
    `## Evidence map`,
    `${p.papers.length} verified provider records; ${edges.filter((e) => e.type === "citation").length} direct citation links, ${edges.filter((e) => e.type === "shared-reference").length} shared-reference links, ${edges.filter((e) => e.type === "co-citation").length} co-citation links and ${edges.filter((e) => !e.verified).length} computational word-overlap links. A missing edge does not demonstrate a research gap.`,
    ...edges
      .filter((e) => e.type !== "similarity")
      .map(
        (e) =>
          `${e.source} → ${e.target}: ${e.type}. Supporting identifiers: ${e.evidence.join(", ")}`,
      ),
    `## Proposed experiment (AI suggestion; no results)`,
    p.experiment
      ? JSON.stringify(p.experiment, null, 2)
      : "No experiment generated.",
    `## Personal notes`,
    p.notes || "No notes.",
    `## Limitations`,
    `This is a bounded search, not an exhaustive systematic review. Metadata and abstracts may be incomplete. Citation counts are provider-specific. Computational word overlap is not evidence of scientific agreement, contradiction, or influence. All gap hypotheses and originality assessments remain provisional.`,
    ...p.warnings,
    `## Verified bibliography`,
    ...p.papers.map((x, i) => `${i + 1}. ${citation(x)}`),
  ].join("\n\n");
}
export function bibtex(papers: Paper[]) {
  const clean = (s: string) => s.replace(/[{}\\]/g, " ");
  return papers
    .map(
      (p, i) =>
        `@misc{gapforge${i + 1},\n  title = {${clean(p.title)}},\n  author = {${p.authors.map(clean).join(" and ")}},\n${p.year ? `  year = {${p.year}},\n` : ""}${p.doi ? `  doi = {${clean(p.doi)}},\n` : ""}  url = {${clean(p.url ?? "")}}\n}`,
    )
    .join("\n\n");
}
export function downloadBlob(
  data: Blob | string,
  name: string,
  type = "text/plain",
) {
  const blob = typeof data === "string" ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function exportPdf(project: Project) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let page = doc.addPage([595, 842]),
    y = 790;
  const clean = (v: string) =>
    v
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7e]/g, "?");
  for (const line of markdownReport(project).split("\n")) {
    let remaining = clean(line);
    do {
      let size = Math.min(95, remaining.length);
      while (
        size > 1 &&
        font.widthOfTextAtSize(remaining.slice(0, size), 10) > 490
      )
        size--;
      const text = remaining.slice(0, size);
      remaining = remaining.slice(size);
      if (y < 50) {
        page = doc.addPage([595, 842]);
        y = 790;
      }
      page.drawText(text, {
        x: 48,
        y,
        size: 10,
        font,
        color: rgb(0.08, 0.1, 0.18),
      });
      y -= 14;
    } while (remaining);
    y -= 4;
  }
  const bytes = await doc.save();
  downloadBlob(
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    "gapforge-report.pdf",
  );
}
