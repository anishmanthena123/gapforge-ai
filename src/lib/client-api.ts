import type { ResearchInput, AnalysisEvent, AnalysisResult } from "./model";
export async function runAnalysis(
  input: ResearchInput,
  onEvent: (e: AnalysisEvent) => void,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error || "Analysis request failed.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response stream.");
  let buffer = "";
  let result: AnalysisResult | undefined;
  const decoder = new TextDecoder();
  function line(text: string) {
    if (!text.trim()) return;
    const event = JSON.parse(text) as AnalysisEvent;
    onEvent(event);
    if (event.type === "error") throw new Error(event.error);
    if (event.type === "result") result = event.data;
  }
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const text of lines) line(text);
  }
  buffer += decoder.decode();
  if (buffer.trim()) line(buffer);
  if (!result)
    throw new Error(
      "The analysis ended before completion. Retry the saved question.",
    );
  return result;
}
export async function intelligence(
  action: "chat" | "experiment" | "refine",
  question: string,
  paperIds: string[],
  message = "",
) {
  const res = await fetch("/api/intelligence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, question, paperIds, message }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "AI request failed.");
  return data;
}
