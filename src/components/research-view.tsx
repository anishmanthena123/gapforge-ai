"use client";
import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  ShieldCheck,
  Network,
  FlaskConical,
  FileText,
  CloudUpload,
  LoaderCircle,
  Bookmark,
  MessageSquare,
  Send,
  Search,
  ExternalLink,
} from "lucide-react";
import dynamic from "next/dynamic";
import {
  type Project,
  type Assessment,
  type Experiment,
  AssessmentSchema,
  ExperimentSchema,
} from "@/lib/model";
import { deduplicate, rankPapers } from "@/lib/literature";
import { runAnalysis, intelligence } from "@/lib/client-api";
import { markdownReport, bibtex, downloadBlob, exportPdf } from "@/lib/report";
import { useWorkspace } from "./workspace-provider";
import { PaperList } from "./papers";
const PaperMap = dynamic(() => import("./paper-map").then((m) => m.PaperMap), {
  ssr: false,
  loading: () => <div className="skeleton" aria-label="Loading paper map" />,
});
type View = "overview" | "map" | "challenge" | "experiments";
export function ResearchView({
  id,
  view = "overview",
}: {
  id: string;
  view?: View;
}) {
  const { projects, ready, sync, notice, email } = useWorkspace();
  const p = projects.find((p) => p.id === id);
  const [saving, setSaving] = useState(false);
  if (!ready) return <div className="skeleton" aria-label="Loading research" />;
  if (!p)
    return (
      <div className="empty-state">
        <FileText size={34} />
        <h1>Project not found in this workspace.</h1>
        <p>
          Guest projects live in the browser where they were created. Sign in to
          load cloud copies.
        </p>
        <Link className="button" href="/projects">
          My Projects
        </Link>
      </div>
    );
  const base = `/research/${p.id}`;
  return (
    <>
      <Link href="/projects" className="back-link">
        <ArrowLeft size={14} />
        All projects
      </Link>
      <div className="research-heading">
        <div>
          <div className="row wrap">
            <span className="tag">{p.concepts.field}</span>
            <span className="meta">
              Updated {new Date(p.updatedAt).toLocaleDateString()} · Local
              browser copy
            </span>
          </div>
          <h1>{p.question}</h1>
          <p>
            {p.papers.length} retrieved studies ·{" "}
            {p.papers.filter((x) => x.abstract).length} available abstracts ·
            Full text not processed
          </p>
        </div>
        <div className="research-toolbar">
          <button
            className="button small"
            disabled={saving || !email}
            title={
              !email ? "Sign in in Settings to save a cloud copy" : undefined
            }
            onClick={async () => {
              setSaving(true);
              try {
                await sync(p);
              } catch (error) {
                notice(
                  error instanceof Error ? error.message : "Cloud save failed.",
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <CloudUpload size={15} />
            )}
            Save to cloud
          </button>
          <details className="export-menu">
            <summary className="button small">
              <Download size={15} />
              Export report
            </summary>
            <div>
              <button
                onClick={() =>
                  downloadBlob(
                    markdownReport(p),
                    "gapforge-report.md",
                    "text/markdown",
                  )
                }
              >
                Markdown report
              </button>
              <button
                onClick={() =>
                  void exportPdf(p).catch(() =>
                    notice("PDF export failed. Try Markdown."),
                  )
                }
              >
                PDF report
              </button>
              <button
                onClick={() =>
                  downloadBlob(bibtex(p.papers), "gapforge-citations.bib")
                }
              >
                BibTeX citations
              </button>
            </div>
          </details>
        </div>
      </div>
      <nav className="research-tabs" aria-label="Research views">
        {[
          ["overview", "Evidence overview", FileText, ""],
          ["map", "Paper map", Network, "/map"],
          ["challenge", "Challenge my idea", ShieldCheck, "/challenge"],
          ["experiments", "Experiment designer", FlaskConical, "/experiments"],
        ].map(([key, label, Icon, suffix]) => {
          const I = Icon as typeof Network;
          return (
            <Link
              key={String(key)}
              className={view === key ? "active" : ""}
              href={`${base}${suffix}`}
            >
              <I size={16} />
              {String(label)}
            </Link>
          );
        })}
      </nav>
      {p.warnings.length > 0 && (
        <details className="warnings">
          <summary>
            {p.warnings.length} search / integration limitation
            {p.warnings.length === 1 ? "" : "s"} — inspect coverage
          </summary>
          {p.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </details>
      )}
      {view === "overview" ? (
        <Overview project={p} />
      ) : view === "map" ? (
        <PaperMap project={p} />
      ) : view === "challenge" ? (
        <Challenge project={p} />
      ) : (
        <ExperimentDesigner project={p} />
      )}
      <div className="research-bottom-grid">
        <Notes project={p} />
        <Assistant project={p} />
      </div>
      <div className="notice">
        <ShieldCheck size={16} />
        All gaps and novelty assessments are provisional. A bounded search does
        not prove originality.
      </div>
    </>
  );
}
function Overview({ project: p }: { project: Project }) {
  return (
    <>
      <div className="overview-grid">
        <section className="panel assessment-card">
          <div className="eyebrow">NOVELTY ASSESSMENT · AI INTERPRETATION</div>
          <h2>{p.assessment?.verdict ?? "Insufficient evidence to assess"}</h2>
          <p>
            {p.assessment?.summary ??
              "Retrieved literature is ready to inspect. AI synthesis needs a configured OpenAI integration and authorization; no novelty conclusion has been substituted."}
          </p>
          <Link className="button" href={`/research/${p.id}/challenge`}>
            <ShieldCheck size={16} />
            Challenge My Idea
            <ArrowRight size={15} />
          </Link>
        </section>
        <section className="panel search-strategy">
          <div className="eyebrow">SEARCH STRATEGY</div>
          <h3>More than the exact wording.</h3>
          <div className="row wrap">
            {p.concepts.concepts.map((c) => (
              <span className="topic" key={c}>
                {c}
              </span>
            ))}
          </div>
          <details>
            <summary>{p.queries.length} academic search queries</summary>
            <ol>
              {p.queries.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </details>
          <p className="meta">
            Years {p.input.fromYear}–{p.input.toYear}. Ranking uses
            title/abstract term overlap. Earlier papers within this range are
            included.
          </p>
          {p.concepts.terminology.length > 0 && (
            <p className="meta">
              Alternative terms: {p.concepts.terminology.join(", ")}
            </p>
          )}
          {p.concepts.methods.length > 0 && (
            <p className="meta">
              Candidate methods: {p.concepts.methods.join(", ")}
            </p>
          )}
          {p.concepts.comparisons.length > 0 && (
            <p className="meta">
              Possible comparisons: {p.concepts.comparisons.join("; ")}
            </p>
          )}
        </section>
      </div>
      <div className="section-heading compact">
        <div>
          <h2>Closest existing research</h2>
          <p>
            Verified metadata, retrieved abstracts, and clearly separated
            interpretation.
          </p>
        </div>
        <Link href={`/research/${p.id}/map`} className="text-link">
          <Network size={16} />
          Explore connections <ArrowRight size={14} />
        </Link>
      </div>
      {p.assessment && <Assessment project={p} assessment={p.assessment} />}
      <PaperList papers={p.papers} project={p} />
    </>
  );
}
export function SourceLinks({
  ids,
  project,
}: {
  ids: string[];
  project: Project;
}) {
  return (
    <div className="source-links">
      {ids.flatMap((id) => {
        const p = project.papers.find((p) => p.id === id);
        return p?.url
          ? [
              <a key={id} href={p.url} target="_blank" rel="noreferrer">
                {p.title}
                <ExternalLink size={12} />
              </a>,
            ]
          : [];
      })}
    </div>
  );
}
export function Assessment({
  project: p,
  assessment: a,
}: {
  project: Project;
  assessment: Assessment;
}) {
  const { save } = useWorkspace();
  return (
    <>
      <div className="comparison-scroll">
        <table className="comparison-table">
          <caption>Abstract-level paper comparison · AI interpretation</caption>
          <thead>
            <tr>
              {[
                "Paper / year",
                "Research question",
                "Method",
                "Supported finding",
                "Overlap",
                "Remaining question / limitations",
              ].map((t) => (
                <th key={t}>{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {a.comparisons.map((c) => (
              <tr key={c.paperId}>
                <td>
                  <SourceLinks ids={[c.paperId]} project={p} />
                  <span className="meta">
                    {p.papers.find((p) => p.id === c.paperId)?.year ??
                      "Unknown year"}{" "}
                    · {c.classification}
                  </span>
                </td>
                <td>{c.question}</td>
                <td>{c.method}</td>
                <td>
                  {c.finding}
                  <details>
                    <summary>Inspect evidence</summary>
                    <blockquote>{c.evidence}</blockquote>
                  </details>
                </td>
                <td>{c.overlap}</td>
                <td>
                  {c.difference}
                  <p className="muted">{c.limitation}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {a.claims.map((c, i) => (
        <div className="panel evidence-claim" key={i}>
          <span className="eyebrow">
            SOURCE-SUPPORTED CLAIM · AI INTERPRETATION
          </span>
          <p>{c.text}</p>
          <blockquote>{c.evidence}</blockquote>
          <SourceLinks ids={c.paperIds} project={p} />
          <p className="meta">{c.limitation}</p>
        </div>
      ))}
      {a.gaps.length > 0 && (
        <div className="section-heading compact">
          <div>
            <h2>Potential research gaps</h2>
            <p>Provisional hypotheses to test with broader searches.</p>
          </div>
        </div>
      )}
      <div className="gap-grid">
        {a.gaps.map((g) => (
          <article className="panel gap-card" key={g.id}>
            <div className="row between">
              <span className="tag">Provisional gap</span>
              <button
                className="icon-button"
                aria-label={
                  p.savedGaps.includes(g.id)
                    ? "Unsave research gap"
                    : "Save research gap"
                }
                onClick={() =>
                  save({
                    ...p,
                    savedGaps: p.savedGaps.includes(g.id)
                      ? p.savedGaps.filter((id) => id !== g.id)
                      : [...p.savedGaps, g.id],
                  })
                }
              >
                <Bookmark
                  size={17}
                  fill={p.savedGaps.includes(g.id) ? "currentColor" : "none"}
                />
              </button>
            </div>
            <h3>{g.title}</h3>
            <p>{g.explanation}</p>
            <details>
              <summary>Evidence and uncertainty</summary>
              <blockquote>{g.evidence}</blockquote>
              <strong>Supporting papers</strong>
              <SourceLinks ids={g.supportingPaperIds} project={p} />
              <strong>Challenging evidence</strong>
              {g.challengingPaperIds.length ? (
                <SourceLinks ids={g.challengingPaperIds} project={p} />
              ) : (
                <p>
                  None identified in this search; this does not establish
                  absence.
                </p>
              )}
              <p>{g.limitation}</p>
              <p>Suggested searches: {g.suggestedSearches.join("; ")}</p>
              <p>Possible experiment: {g.experiment}</p>
            </details>
            <Link href={`/research/${p.id}/experiments`} className="text-link">
              <FlaskConical size={15} />
              Design an Experiment <ArrowRight size={14} />
            </Link>
          </article>
        ))}
      </div>
    </>
  );
}
function remapAssessment(
  a: Assessment | null,
  oldPapers: Project["papers"],
  merged: Project["papers"],
): Assessment | null {
  if (!a) return null;
  const aliases = new Map(
    oldPapers.map((p) => [
      p.id,
      merged.find(
        (m) =>
          m.id === p.id ||
          (p.doi && m.doi === p.doi) ||
          (p.openalexId && m.openalexId === p.openalexId) ||
          (p.semanticId && m.semanticId === p.semanticId),
      )?.id ?? p.id,
    ]),
  );
  return AssessmentSchema.parse(
    JSON.parse(JSON.stringify(a), (_key, v) =>
      typeof v === "string" ? (aliases.get(v) ?? v) : v,
    ),
  );
}
function Challenge({ project: p }: { project: Project }) {
  const params = useSearchParams();
  const focusPaperIds = (params.get("focus") ?? "")
    .split(",")
    .filter((id) => p.papers.some((x) => x.id === id))
    .slice(0, 20);
  const { save, notice } = useWorkspace();
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [error, setError] = useState("");
  async function challenge() {
    setBusy(true);
    setError("");
    try {
      const result = await runAnalysis(
        { ...p.input, mode: "challenge", focusPaperIds },
        (e) => {
          if (e.type === "progress") setStatus(e.detail || e.stage);
        },
      );
      const papers = rankPapers(
        deduplicate([...p.papers, ...result.papers]),
        p.question,
      );
      const assessment = remapAssessment(
        result.assessment,
        result.papers,
        papers,
      );
      save({
        ...p,
        papers,
        challenge: assessment,
        challengeQueries: result.queries,
        challengePaperIds: result.papers.map(
          (x) =>
            papers.find((m) => m.id === x.id || (x.doi && x.doi === m.doi))
              ?.id ?? x.id,
        ),
        warnings: [...new Set([...p.warnings, ...result.warnings])],
        searchHistory: [
          ...p.searchHistory,
          {
            at: new Date().toISOString(),
            mode: "challenge",
            queries: result.queries,
            count: result.papers.length,
          },
        ],
      });
      notice(
        "Adversarial literature search completed; new evidence was added to the map.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Challenge failed.");
    } finally {
      setBusy(false);
    }
  }
  async function refine() {
    setBusy(true);
    setError("");
    try {
      const assessment = AssessmentSchema.parse(
        await intelligence(
          "refine",
          p.question,
          p.papers.map((x) => x.id),
        ),
      );
      save({ ...p, challenge: assessment });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refinement failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="challenge-hero panel">
        <div className="challenge-icon">
          <ShieldCheck size={31} />
        </div>
        <div>
          <div className="eyebrow">YOUR IDEA. A SKEPTICAL SECOND LOOK.</div>
          <h2>Let’s try to prove it already exists.</h2>
          {focusPaperIds.length > 0 && (
            <p className="tag">
              Focused on {focusPaperIds.length} selected network papers, plus
              additional literature searches.
            </p>
          )}
          <p>
            A separate, targeted search for equivalent methods, earlier
            terminology, and prior art that could challenge your contribution.
          </p>
          <div className="row wrap">
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void challenge()}
            >
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <ShieldCheck size={17} />
              )}
              Challenge My Idea
            </button>
            <button
              className="button"
              disabled={busy || !p.papers.length}
              onClick={() => void refine()}
            >
              Make My Idea More Original <ArrowRight size={15} />
            </button>
          </div>
          {busy && (
            <p role="status" className="meta">
              {status || "Checking retrieved evidence…"}
            </p>
          )}
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
        </div>
      </section>
      <section className="panel">
        <div className="eyebrow">CLAIMS TO TEST</div>
        <div className="row wrap">
          {p.concepts.claims.map((c) => (
            <span className="topic" key={c}>
              {c}
            </span>
          ))}
        </div>
        <p className="meta">
          Searches challenge these candidate claims; extracting a claim does not
          verify it.
        </p>
      </section>
      {p.challengeQueries.length > 0 && (
        <details className="panel">
          <summary>
            Adversarial search strategy · {p.challengeQueries.length} queries
          </summary>
          <ol>
            {p.challengeQueries.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        </details>
      )}
      {p.challenge ? (
        <>
          <div className="verdict">
            <span className="eyebrow">
              PROVISIONAL CONCLUSION · AI INTERPRETATION
            </span>
            <h2>{p.challenge.verdict}</h2>
            <p>{p.challenge.summary}</p>
          </div>
          <Assessment project={p} assessment={p.challenge} />
          <div className="section-heading compact">
            <h2>Narrower, testable directions</h2>
          </div>
          {p.challenge.revisions.map((r, i) => (
            <div className="panel revision" key={i}>
              <span className="tag">Provisional revised question</span>
              <h3>{r.question}</h3>
              <p>{r.difference}</p>
              <SourceLinks ids={r.paperIds} project={p} />
              <p>
                <strong>Possible experiment:</strong> {r.experiment}
              </p>
              <p>
                <strong>Originality risks:</strong> {r.risk}
              </p>
              <p className="meta">
                {r.difficulty} · {r.resources}
              </p>
              <button
                className="button small"
                onClick={() =>
                  router.push(
                    `/research/new?q=${encodeURIComponent(r.question)}`,
                  )
                }
              >
                Research this variation <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </>
      ) : (
        <div className="empty-state">
          <ShieldCheck size={28} />
          <h3>Insufficient evidence to assess</h3>
          <p>
            {p.challengeQueries.length
              ? "The targeted search completed, but no supported AI assessment is available. Inspect the collected papers and integration limitations."
              : "Run the challenge to add new prior-art searches and evidence to your project."}
          </p>
        </div>
      )}
    </>
  );
}
function ExperimentDesigner({ project: p }: { project: Project }) {
  const { save, notice } = useWorkspace();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function generate() {
    setBusy(true);
    setError("");
    try {
      const exp = ExperimentSchema.parse(
        await intelligence(
          "experiment",
          p.question,
          p.papers.map((x) => x.id),
        ),
      );
      save({ ...p, experiment: exp });
      notice(
        "Proposed experiment created. Review its assumptions and edit before use.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Experiment design failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="panel experiment-intro">
        <FlaskConical size={27} />
        <div>
          <h2>From a question to a test.</h2>
          <p>
            Generate a structured, field-specific proposal grounded in your
            collected literature. Every design is a suggestion, with no
            hypothetical findings presented as results.
          </p>
        </div>
        <button
          className="button primary"
          disabled={busy || !p.papers.length}
          onClick={() => void generate()}
        >
          {busy ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <FlaskConical size={16} />
          )}{" "}
          {p.experiment ? "Regenerate proposal" : "Design an Experiment"}
        </button>
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {p.experiment ? (
        <ExperimentEditor
          key={p.experiment.title}
          project={p}
          initial={p.experiment}
        />
      ) : (
        <div className="empty-state">
          <FlaskConical size={30} />
          <h3>A feasible experiment starts with a clear hypothesis.</h3>
          <p>
            Collect papers first, then configure OpenAI and sign in to generate
            a proposal.
          </p>
        </div>
      )}
    </>
  );
}
function ExperimentEditor({
  project: p,
  initial,
}: {
  project: Project;
  initial: Experiment;
}) {
  const { save, notice } = useWorkspace();
  const [exp, setExp] = useState(initial);
  const labels: Record<string, string> = {
    title: "Proposed title",
    question: "Research question",
    hypothesis: "Testable hypothesis",
    independentVariables: "Independent variables",
    dependentVariables: "Dependent variables",
    controls: "Control groups",
    baselines: "Baselines",
    methodology: "Experimental methodology",
    equipment: "Required equipment",
    datasets: "Dataset suggestions · verify availability",
    frameworks: "Software frameworks · verify suitability",
    metrics: "Evaluation metrics",
    statistics: "Statistical analysis",
    challenges: "Expected challenges",
    limitations: "Limitations",
    resources: "Resource requirements",
  };
  return (
    <section className="panel">
      <div className="row between wrap">
        <span className="tag">AI-generated suggestion · editable</span>
        <button
          className="button small"
          onClick={() =>
            downloadBlob(
              JSON.stringify(exp, null, 2),
              "gapforge-experiment.json",
              "application/json",
            )
          }
        >
          <Download size={14} />
          Export experiment
        </button>
      </div>
      <div className="experiment-fields">
        {Object.entries(labels).map(([key, label]) => {
          const value = exp[key as keyof Experiment];
          return (
            <label key={key}>
              {label}
              <textarea
                rows={key === "methodology" ? 5 : 3}
                value={Array.isArray(value) ? value.join("\n") : String(value)}
                onChange={(e) =>
                  setExp({
                    ...exp,
                    [key]: Array.isArray(value)
                      ? e.target.value.split("\n")
                      : e.target.value,
                  })
                }
              />
            </label>
          );
        })}
      </div>
      <h3>Six-month research timeline</h3>
      <div className="timeline-editor">
        {exp.timeline.map((t, i) => (
          <label key={i}>
            Month {t.month}
            <textarea
              value={t.task}
              onChange={(e) =>
                setExp({
                  ...exp,
                  timeline: exp.timeline.map((x, j) =>
                    j === i ? { ...x, task: e.target.value } : x,
                  ),
                })
              }
            />
          </label>
        ))}
      </div>
      <SourceLinks ids={exp.paperIds} project={p} />
      <button
        className="button primary"
        onClick={() => {
          save({ ...p, experiment: exp });
          notice("Experiment edits saved locally.");
        }}
      >
        Save experiment
      </button>
    </section>
  );
}
function Notes({ project: p }: { project: Project }) {
  const { save, notice } = useWorkspace();
  const [notes, setNotes] = useState(p.notes);
  useEffect(() => setNotes(p.notes), [p.id, p.notes]);
  return (
    <section className="panel notes-panel">
      <div className="row between">
        <h3>Research notes</h3>
        <span className="tag">Private workspace</span>
      </div>
      <label className="sr-only" htmlFor="research-notes">
        Research notes
      </label>
      <textarea
        id="research-notes"
        placeholder="What stands out? Record your questions and next steps…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={7}
      />
      <button
        className="button small"
        onClick={() => {
          save({ ...p, notes });
          notice("Notes saved in this browser.");
        }}
      >
        Save notes
      </button>
    </section>
  );
}
function Assistant({ project: p }: { project: Project }) {
  const { save } = useWorkspace();
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function ask(e: FormEvent, search = false) {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setError("");
    try {
      if (search) {
        const result = await runAnalysis(
          {
            ...p.input,
            question:
              message.length >= 15 ? message : `${p.question} ${message}`,
            mode: "research",
          },
          () => {},
        );
        const papers = deduplicate([...p.papers, ...result.papers]);
        save({
          ...p,
          papers: rankPapers(papers, p.question),
          warnings: [...new Set([...p.warnings, ...result.warnings])],
          queries: [...new Set([...p.queries, ...result.queries])],
          searchHistory: [
            ...p.searchHistory,
            {
              at: new Date().toISOString(),
              mode: "assistant-search",
              queries: result.queries,
              count: result.papers.length,
            },
          ],
          messages: [
            ...p.messages,
            {
              role: "user",
              text: `Additional search: ${message}`,
              paperIds: [],
            },
            {
              role: "assistant",
              text: `Retrieved ${result.papers.length} verified provider records. They have been added to your project. Search coverage is shown in the project history.`,
              paperIds: [],
            },
          ],
        });
      } else {
        const result = await intelligence(
          "chat",
          p.question,
          p.papers.map((x) => x.id),
          message,
        );
        save({
          ...p,
          messages: [
            ...p.messages,
            { role: "user", text: message, paperIds: [] },
            {
              role: "assistant",
              text: result.answer,
              paperIds: result.sources.map(
                (s: { paperId: string }) => s.paperId,
              ),
            },
          ],
        });
      }
      setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assistant request failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel assistant">
      <div className="row">
        <MessageSquare size={18} />
        <h3>Ask the evidence</h3>
      </div>
      <div className="chat-messages">
        {!p.messages.length && (
          <p className="muted">
            Which study should I read first? What is the strongest baseline? Ask
            a question grounded in your collected abstracts.
          </p>
        )}
        {p.messages.map((m, i) => (
          <div key={i} className={`chat-message ${m.role}`}>
            <span className="eyebrow">
              {m.role === "assistant"
                ? "AI INTERPRETATION / SEARCH STATUS"
                : "YOUR QUESTION"}
            </span>
            <p>{m.text}</p>
            <SourceLinks ids={m.paperIds} project={p} />
          </div>
        ))}
      </div>
      <form onSubmit={(e) => void ask(e)}>
        <label className="sr-only" htmlFor="assistant-question">
          Question for research assistant
        </label>
        <textarea
          id="assistant-question"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask about this research…"
          rows={2}
          maxLength={4000}
        />
        <div className="row between">
          <button
            type="button"
            className="text-link"
            disabled={busy || !message.trim()}
            onClick={(e) => void ask(e, true)}
          >
            <Search size={14} />
            Search more literature
          </button>
          <button className="button small" disabled={busy || !message.trim()}>
            {busy ? (
              <LoaderCircle className="spin" size={14} />
            ) : (
              <Send size={14} />
            )}
            Ask
          </button>
        </div>
      </form>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
