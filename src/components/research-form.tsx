"use client";
import { useState, useEffect, useRef, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  ArrowRight,
  ShieldCheck,
  Check,
  LoaderCircle,
  X,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import {
  fields,
  InputSchema,
  makeProject,
  stages,
  type ResearchInput,
} from "@/lib/model";
import { runAnalysis } from "@/lib/client-api";
import { useWorkspace } from "./workspace-provider";
const example =
  "Can sparse counterfactual demonstrations reduce spurious visual correlations in robot imitation learning?";
export function ResearchForm() {
  const router = useRouter(),
    params = useSearchParams();
  const { save, notice } = useWorkspace();
  const [question, setQuestion] = useState(params.get("q") ?? "");
  const [field, setField] = useState<ResearchInput["field"]>(
    "Automatic detection",
  );
  const [fromYear, setFromYear] = useState(1990);
  const [toYear, setToYear] = useState(new Date().getFullYear());
  const [depth, setDepth] = useState<ResearchInput["depth"]>("balanced");
  const [maxPapers, setMaxPapers] = useState(30);
  const [busy, setBusy] = useState(false),
    [stage, setStage] = useState(""),
    [detail, setDetail] = useState(""),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (params.get("q")) return;
    try {
      const job = JSON.parse(
        localStorage.getItem("gapforge.analysis-draft") || "null",
      );
      if (job?.input) {
        setQuestion(job.input.question);
        setField(job.input.field);
        setFromYear(job.input.fromYear);
        setToYear(job.input.toYear);
        setDepth(job.input.depth);
        setMaxPapers(job.input.maxPapers);
        setRetry(true);
      }
    } catch {}
    return () => controller.current?.abort();
  }, [params]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = InputSchema.safeParse({
      question,
      field,
      fromYear,
      toYear,
      depth,
      maxPapers,
      mode: "research",
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(" "));
      return;
    }
    setBusy(true);
    controller.current = new AbortController();
    try {
      localStorage.setItem(
        "gapforge.analysis-draft",
        JSON.stringify({
          input: parsed.data,
          status: "running",
          startedAt: new Date().toISOString(),
        }),
      );
      const result = await runAnalysis(
        parsed.data,
        (event) => {
          if (event.type === "progress") {
            setStage(event.stage);
            setDetail(event.detail ?? "");
          }
        },
        controller.current.signal,
      );
      const project = makeProject(parsed.data, result);
      save(project);
      localStorage.removeItem("gapforge.analysis-draft");
      notice("Literature search complete. Project saved in this browser.");
      router.push(`/research/${project.id}`);
    } catch (error) {
      setError(
        error instanceof Error && error.name === "AbortError"
          ? "Analysis cancelled. Your question is saved for retry."
          : error instanceof Error
            ? error.message
            : "Analysis failed.",
      );
      setRetry(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="new-research">
      <div className="page-heading">
        <div>
          <div className="eyebrow">A QUESTION WORTH INVESTIGATING</div>
          <h1>What’s your next idea?</h1>
          <p>Bring a question. We’ll help you find the evidence around it.</p>
        </div>
      </div>
      <form className="research-form panel" onSubmit={submit}>
        <div className="form-title">
          <Search size={21} />
          <h2>Your research question</h2>
          <span className="tag">Literature first</span>
        </div>
        <label htmlFor="question" className="sr-only">
          Research question or proposal
        </label>
        <textarea
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Enter a research question, describe an idea, or paste a proposal…"
          rows={6}
          maxLength={12000}
          required
          minLength={15}
          disabled={busy}
        />
        <div className="row between form-helper">
          <span>Be specific about the problem, method, and context.</span>
          <span className="mono">
            {question.length.toLocaleString()} / 12,000
          </span>
        </div>
        {!question && (
          <button
            type="button"
            className="example-question"
            onClick={() => setQuestion(example)}
          >
            <span>TRY A QUESTION</span>
            {example}
            <ArrowRight size={16} />
          </button>
        )}
        <div className="form-divider">
          <SlidersHorizontal size={15} />
          Shape your search
        </div>
        <div className="form-grid">
          <label>
            Research field
            <select
              value={field}
              onChange={(e) =>
                setField(e.target.value as ResearchInput["field"])
              }
              disabled={busy}
            >
              {fields.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label>
            Analysis depth
            <select
              value={depth}
              onChange={(e) =>
                setDepth(e.target.value as ResearchInput["depth"])
              }
              disabled={busy}
            >
              <option value="quick">Quick exploration · 2 queries</option>
              <option value="balanced">
                Balanced review · up to 4 queries
              </option>
              <option value="deep">Deep search · up to 8 queries</option>
            </select>
          </label>
          <label>
            Publication years
            <div className="year-inputs">
              <input
                aria-label="From publication year"
                type="number"
                min={1800}
                max={2100}
                value={fromYear}
                onChange={(e) => setFromYear(+e.target.value)}
                disabled={busy}
              />
              <span>to</span>
              <input
                aria-label="To publication year"
                type="number"
                min={1800}
                max={2100}
                value={toYear}
                onChange={(e) => setToYear(+e.target.value)}
                disabled={busy}
              />
            </div>
          </label>
          <label>
            Maximum papers
            <select
              value={maxPapers}
              onChange={(e) => setMaxPapers(+e.target.value)}
              disabled={busy}
            >
              {[10, 20, 30, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} papers
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-submit">
          <span>
            <ShieldCheck size={16} />
            Your question is sent to literature providers{"."}
            <br />
            AI synthesis uses OpenAI when configured and authorized.
          </span>
          <button
            type="submit"
            disabled={busy || question.trim().length < 15}
            className="button primary large"
          >
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <Search size={18} />
            )}{" "}
            {busy
              ? "Exploring the evidence…"
              : retry
                ? "Retry analysis"
                : "Analyze research idea"}
            <ArrowRight size={17} />
          </button>
        </div>
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}
        {retry && !busy && (
          <div className="notice">
            <RotateCcw size={16} />
            Your question is stored locally. Retry safely; a project is created
            only after a complete response.
          </div>
        )}
      </form>
      {busy && (
        <div className="progress-panel panel" role="status" aria-live="polite">
          <div className="row between">
            <h3>Following the evidence</h3>
            <button
              className="button small"
              type="button"
              onClick={() => controller.current?.abort()}
            >
              <X size={14} />
              Cancel
            </button>
          </div>
          <div className="progress-steps">
            {stages.map((s, i) => (
              <div
                key={s}
                className={
                  i === stages.indexOf(stage)
                    ? "current"
                    : i < stages.indexOf(stage)
                      ? "complete"
                      : ""
                }
              >
                {i < stages.indexOf(stage) ? (
                  <Check size={15} />
                ) : i === stages.indexOf(stage) ? (
                  <LoaderCircle size={15} className="spin" />
                ) : (
                  <span className="step-number">{i + 1}</span>
                )}
                <span>{s}</span>
              </div>
            ))}
          </div>
          <p>{detail || "Progress comes from actual backend operations."}</p>
        </div>
      )}
      <div className="form-bottom">
        <ShieldCheck size={21} />
        <div>
          <strong>A starting point, with the limits in view.</strong>
          <p>
            Search coverage varies. Missing papers don’t establish originality,
            and every suggested research gap remains provisional.
          </p>
        </div>
      </div>
    </div>
  );
}
