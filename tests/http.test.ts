import { afterEach, describe, it, expect, vi } from "vitest";
import {
  fetchJson,
  takeRateLimit,
  guardRequest,
  readBody,
} from "../src/lib/server/http";
import { runAnalysis } from "../src/lib/client-api";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("request reliability", () => {
  it("honors a bounded 429 retry and succeeds", async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("", { status: 429, headers: { "retry-after": "1" } }),
      )
      .mockResolvedValue(new Response('{"ok":true}'));
    vi.stubGlobal("fetch", fetcher);
    const pending = fetchJson("https://example.org");
    const assertion = expect(pending).resolves.toEqual({ ok: true });
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not hammer a provider with a long Retry-After", async () => {
    const f = vi
      .fn()
      .mockResolvedValue(
        new Response("", { status: 429, headers: { "retry-after": "60" } }),
      );
    vi.stubGlobal("fetch", f);
    await expect(fetchJson("https://example.org")).rejects.toThrow(
      "Retry later",
    );
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("enforces rate limits and origin checks", () => {
    expect(takeRateLimit("test-user", 1, 100)).toBe(true);
    expect(takeRateLimit("test-user", 1, 101)).toBe(false);
    expect(takeRateLimit("test-user", 1, 60101)).toBe(true);
    expect(() =>
      guardRequest(
        new Request("https://app.example/api", {
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toThrow("Cross-origin");
  });
  it("bounds chunked request bodies", async () => {
    await expect(
      readBody(
        new Request("https://example.org", {
          method: "POST",
          body: "x".repeat(2000001),
        }),
      ),
    ).rejects.toThrow("too large");
  });
  it("handles a job failure and never returns partial papers as success", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            '{"type":"progress","stage":"Searching literature"}\n{"type":"error","error":"Providers failed"}\n',
          ),
        ),
    );
    await expect(
      runAnalysis(
        {
          question: "Test fixture research question",
          field: "Robotics",
          fromYear: 2000,
          toYear: 2026,
          depth: "quick",
          maxPapers: 10,
          mode: "research",
        },
        () => {},
      ),
    ).rejects.toThrow("Providers failed");
  });
});
