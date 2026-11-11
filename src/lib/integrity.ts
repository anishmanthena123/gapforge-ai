import type { Project } from "./model";
export function assertProjectIntegrity(project: Project) {
  const ids = new Set(project.papers.map((p) => p.id));
  if (ids.size !== project.papers.length)
    throw new Error(
      "Duplicate paper records must be deduplicated before export.",
    );
  for (const p of project.papers) {
    if (
      !(p.openalexId && /^W\d+$/.test(p.openalexId)) &&
      !(p.semanticId && /^[a-f\d]{40}$/i.test(p.semanticId))
    )
      throw new Error("A paper lacks a verified external identifier.");
  }
  const refs: string[] = [
    ...project.bookmarks,
    ...project.challengePaperIds,
    ...(project.experiment?.paperIds ?? []),
    ...project.messages.flatMap((m) => m.paperIds),
  ];
  for (const a of [project.assessment, project.challenge])
    if (a) {
      refs.push(
        ...a.comparisons.map((c) => c.paperId),
        ...a.claims.flatMap((c) => c.paperIds),
        ...a.gaps.flatMap((g) => [
          ...g.supportingPaperIds,
          ...g.challengingPaperIds,
        ]),
        ...a.revisions.flatMap((r) => r.paperIds),
      );
    }
  if (refs.some((id) => !ids.has(id)))
    throw new Error(
      "A report citation refers to a paper outside the verified project library.",
    );
}
