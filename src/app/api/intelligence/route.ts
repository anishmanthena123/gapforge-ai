import { z } from "zod";
import {
  guardRequest,
  errorResponse,
  readBody,
  ProviderError,
} from "@/lib/server/http";
import { aiAllowed } from "@/lib/supabase/server";
import { resolvePapers } from "@/lib/server/providers";
import { answerQuestion, designExperiment, assess } from "@/lib/server/ai";
const schema = z.object({
  action: z.enum(["chat", "experiment", "refine"]),
  question: z.string().min(15).max(12000),
  message: z.string().max(4000).default(""),
  paperIds: z.array(z.string().max(100)).max(100),
});
export const maxDuration = 180;
export async function POST(request: Request) {
  try {
    guardRequest(request, 6);
    const input = schema.parse(await readBody(request));
    if (!(await aiAllowed()))
      throw new ProviderError(
        "OpenAI",
        503,
        "Configure OPENAI_API_KEY and sign in to use AI features, or enable ALLOW_GUEST_AI for a trusted local installation.",
      );
    const papers = await resolvePapers(input.paperIds, request.signal);
    if (!papers.length)
      throw new Error(
        "No paper evidence could be re-verified. Run a literature search first.",
      );
    const result =
      input.action === "chat"
        ? await answerQuestion(
            input.question,
            input.message,
            papers,
            request.signal,
          )
        : input.action === "experiment"
          ? await designExperiment(input.question, papers, request.signal)
          : await assess(
              input.question,
              papers,
              "narrower research revisions",
              request.signal,
            );
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
