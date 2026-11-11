import { InputSchema, type AnalysisEvent } from "@/lib/model";
import { guardRequest, errorResponse, readBody } from "@/lib/server/http";
import { analyze } from "@/lib/server/pipeline";
import { aiAllowed } from "@/lib/supabase/server";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    guardRequest(request, 6);
    const input = InputSchema.parse(await readBody(request));
    const useAI = await aiAllowed();
    const encoder = new TextEncoder();
    const cancellation = new AbortController();
    const signal = AbortSignal.any([
      request.signal,
      cancellation.signal,
      AbortSignal.timeout(240000),
    ]);
    let closed = false;
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: AnalysisEvent) => {
          if (!closed && !signal.aborted)
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        };
        try {
          const result = await analyze(input, emit, useAI, signal);
          emit({ type: "result", data: result });
        } catch (error) {
          emit({
            type: "error",
            error: error instanceof Error ? error.message : "Analysis failed.",
          });
        } finally {
          if (!closed) {
            closed = true;
            controller.close();
          }
        }
      },
      cancel() {
        closed = true;
        cancellation.abort();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
