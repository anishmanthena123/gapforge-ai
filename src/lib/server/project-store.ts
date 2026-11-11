import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ProjectSchema, type Paper, type Project } from "@/lib/model";
export async function loadCloudProjects(
  db: SupabaseClient,
): Promise<Project[]> {
  const { data: projects, error } = await db
    .from("research_projects")
    .select("id,question,workspace,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error)
    throw new Error(
      "Cloud storage unavailable. Apply the GapForge migration in your dedicated Supabase project.",
    );
  if (!projects?.length) return [];
  const ids = projects.map((p) => p.id);
  const results = await Promise.all([
    db
      .from("project_papers")
      .select("project_id,paper_id,source_key,bookmarked,position")
      .in("project_id", ids),
    db.from("papers").select("id,external_key,title,year,metadata"),
    db.from("paper_references").select("paper_id,reference_external_id"),
    db
      .from("novelty_challenges")
      .select("project_id,kind,content")
      .in("project_id", ids),
    db
      .from("experiment_designs")
      .select("project_id,content")
      .in("project_id", ids),
    db.from("project_notes").select("project_id,content").in("project_id", ids),
    db
      .from("gap_hypotheses")
      .select("project_id,external_key,saved")
      .in("project_id", ids),
  ]);
  for (const r of results)
    if (r.error)
      throw new Error(
        "Cloud project details could not be loaded. Verify migration and account permissions.",
      );
  const links = results[0].data ?? [];
  const paperRows = results[1].data ?? [];
  const refs = results[2].data ?? [];
  const assessments = results[3].data ?? [];
  const experiments = results[4].data ?? [];
  const notes = results[5].data ?? [];
  const gaps = results[6].data ?? [];
  return projects.map((row) => {
    const projectLinks = links.filter((l) => l.project_id === row.id);
    const papers = projectLinks.flatMap((l) => {
      const r = paperRows.find((x) => x.id === l.paper_id);
      return r
        ? [
            {
              ...r.metadata,
              id: l.source_key,
              title: r.title,
              year: r.year,
              references: refs
                .filter((x) => x.paper_id === r.id)
                .map((x) => x.reference_external_id),
            } as Paper,
          ]
        : [];
    });
    const byId = new Map(projectLinks.map((r) => [r.paper_id, r.source_key]));
    return ProjectSchema.parse({
      ...row.workspace,
      id: row.id,
      question: row.question,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      papers,
      assessment:
        assessments.find(
          (x) => x.project_id === row.id && x.kind === "analysis",
        )?.content ?? null,
      challenge:
        assessments.find(
          (x) => x.project_id === row.id && x.kind === "challenge",
        )?.content ?? null,
      experiment:
        experiments.find((x) => x.project_id === row.id)?.content ?? null,
      notes: notes.find((x) => x.project_id === row.id)?.content ?? "",
      bookmarks: projectLinks
        .filter((l) => l.bookmarked)
        .map((l) => byId.get(l.paper_id)),
      positions: Object.fromEntries(
        projectLinks
          .filter((l) => l.position)
          .map((l) => [byId.get(l.paper_id), l.position]),
      ),
      savedGaps: gaps
        .filter((x) => x.project_id === row.id && x.saved)
        .map((x) => x.external_key),
    });
  });
}
