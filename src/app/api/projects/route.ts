import { validateAttribution } from "@/lib/server/ai";
import { assertProjectIntegrity } from "@/lib/integrity";
import { ProjectSchema } from "@/lib/model";
import { serverSupabase } from "@/lib/supabase/server";
import {
  guardRequest,
  errorResponse,
  readBody,
  ProviderError,
} from "@/lib/server/http";
import { resolvePapers } from "@/lib/server/providers";
import { loadCloudProjects } from "@/lib/server/project-store";
import { buildGraph, topicClusters } from "@/lib/graph";
export const maxDuration = 300;
async function signedIn() {
  const db = await serverSupabase();
  if (!db)
    throw new ProviderError("Supabase", 503, "Supabase is not configured.");
  const { data, error } = await db.auth.getUser();
  if (error || !data.user)
    throw new ProviderError(
      "Supabase",
      401,
      "Sign in to access private cloud projects.",
    );
  return db;
}
export async function GET() {
  try {
    const db = await signedIn();
    return Response.json(
      { projects: await loadCloudProjects(db) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    guardRequest(request, 6);
    const db = await signedIn();
    const project = ProjectSchema.parse(await readBody(request));
    assertProjectIntegrity(project);
    const papers = await resolvePapers(
      project.papers.map((p) => p.id),
      request.signal,
    );
    if (papers.length !== project.papers.length)
      throw new Error(
        "Cloud save paused: some paper metadata could not be re-verified with its provider. Your local project remains available.",
      );
    if (project.assessment)
      project.assessment = validateAttribution(project.assessment, papers);
    if (project.challenge)
      project.challenge = validateAttribution(project.challenge, papers);
    const payload = {
      ...project,
      papers,
      edges: buildGraph(papers),
      clusters: topicClusters(papers).map((c) => ({
        label: c.label,
        paperIds: c.papers.map((p) => p.id),
      })),
    };
    const { error } = await db.rpc("save_research_project", { payload });
    if (error)
      throw new Error(
        "Cloud save failed. Verify the GapForge migration and your account permissions; your local project remains available.",
      );
    return Response.json(
      { saved: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
