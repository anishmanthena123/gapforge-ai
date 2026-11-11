import { z } from "zod";
import { resolvePapers } from "@/lib/server/providers";
import { guardRequest, errorResponse, readBody } from "@/lib/server/http";
export async function POST(request: Request) {
  try {
    guardRequest(request, 12);
    const { paperId } = z
      .object({ paperId: z.string().max(100) })
      .parse(await readBody(request));
    const [paper] = await resolvePapers([paperId], request.signal);
    if (!paper)
      throw new Error("Paper could not be verified from its provider.");
    const papers = await resolvePapers(
      paper.references.slice(0, 12),
      request.signal,
    );
    return Response.json(
      {
        papers,
        warning:
          papers.length < Math.min(12, paper.references.length)
            ? "Some references could not be retrieved; only verified records are shown."
            : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
