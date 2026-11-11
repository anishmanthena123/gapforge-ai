"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import type { Core, StylesheetStyle, ElementDefinition } from "cytoscape";
import Link from "next/link";
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCcw,
  Save,
  Download,
  Pin,
  Network,
  ExternalLink,
  Bookmark,
  ShieldCheck,
  LoaderCircle,
  X,
  GitBranch,
  Search,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { type Project, type EdgeType } from "@/lib/model";
import { buildGraph, topicClusters, traceReferences } from "@/lib/graph";
import { filterPapers, deduplicate, rankPapers } from "@/lib/literature";
import { downloadBlob } from "@/lib/report";
import { useWorkspace } from "./workspace-provider";
const labels: Record<EdgeType, string> = {
  citation: "Direct citation",
  "shared-reference": "Shared references",
  "co-citation": "Co-citation",
  similarity: "Word-overlap similarity (inferred)",
  idea: "Question relevance (inferred)",
};
export function PaperMap({ project: p }: { project: Project }) {
  const { save, notice } = useWorkspace();
  const container = useRef<HTMLDivElement>(null),
    cy = useRef<Core | null>(null);
  const [search, setSearch] = useState(""),
    [year, setYear] = useState(""),
    [topic, setTopic] = useState(""),
    [venue, setVenue] = useState(""),
    [mode, setMode] = useState("network"),
    [selected, setSelected] = useState<string | null>(null),
    [edgeId, setEdgeId] = useState<string | null>(null),
    [types, setTypes] = useState<EdgeType[]>([
      "citation",
      "shared-reference",
      "co-citation",
      "similarity",
      "idea",
    ]),
    [gaps, setGaps] = useState(false),
    [busy, setBusy] = useState(false),
    [trace, setTrace] = useState<string | null>(null),
    [graphError, setGraphError] = useState(""),
    [compare, setCompare] = useState<string[]>([]);
  const papers = useMemo(
    () =>
      filterPapers(p.papers, {
        search,
        fromYear: year ? +year : undefined,
        topic,
        venue,
      }),
    [p.papers, search, year, topic, venue],
  );
  const allEdges = useMemo(() => buildGraph(p.papers), [p.papers]);
  const edges = useMemo(() => {
    const ids = new Set(papers.map((p) => p.id));
    return allEdges.filter(
      (e) => ids.has(e.source) && ids.has(e.target) && types.includes(e.type),
    );
  }, [allEdges, papers, types]);
  const challenges = useMemo(
    () =>
      new Set(
        p.challenge?.comparisons
          .filter((c) =>
            ["Direct overlap", "Significant partial overlap"].includes(
              c.classification,
            ),
          )
          .map((c) => c.paperId) ?? [],
      ),
    [p.challenge],
  );
  const clusters = useMemo(() => topicClusters(p.papers), [p.papers]);
  const paper = p.papers.find((x) => x.id === selected);
  const edge = allEdges.find((x) => x.id === edgeId);
  const earlierCutoff =
    [...p.papers].sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999))[
      Math.floor(p.papers.length / 4)
    ]?.year ?? 0;
  useEffect(() => {
    let disposed = false;
    void import("cytoscape")
      .then(({ default: cytoscape }) => {
        if (disposed || !container.current) return;
        const years = papers.flatMap((p) => (p.year === null ? [] : [p.year]));
        const firstYear = years.length ? Math.min(...years) : 0;
        const definitions: ElementDefinition[] = [
          {
            group: "nodes",
            data: {
              id: "idea",
              label: "Your research idea",
              color: "#7397ff",
              size: 44,
            },
            position:
              mode === "timeline" ? { x: -100, y: 250 } : p.positions.idea,
          },
        ];
        papers.forEach((paper, i) =>
          definitions.push({
            group: "nodes",
            data: {
              id: paper.id,
              label:
                (mode === "timeline"
                  ? `${paper.year ?? "Year unavailable"} · `
                  : "") +
                (paper.title.length > 46
                  ? paper.title.slice(0, 44) + "…"
                  : paper.title),
              color: challenges.has(paper.id)
                ? "#e9a365"
                : paper.year && paper.year <= earlierCutoff
                  ? "#65bda4"
                  : paper.relevance >= 0.15
                    ? "#a28bfa"
                    : "#718095",
              size:
                23 + Math.min(17, Math.log2((paper.citations ?? 0) + 1) * 2),
            },
            position:
              mode === "timeline"
                ? {
                    x:
                      paper.year === null
                        ? -230
                        : (paper.year - firstYear) * 95,
                    y: 80 + (i % 6) * 95,
                  }
                : p.positions[paper.id],
          }),
        );
        edges.forEach((e) =>
          definitions.push({
            group: "edges",
            data: {
              ...e,
              color: e.type === "similarity" ? "#8375bd" : "#607089",
            },
          }),
        );
        if (types.includes("idea"))
          papers
            .filter((x) => x.relevance > 0)
            .slice(0, 12)
            .forEach((x) =>
              definitions.push({
                group: "edges",
                data: {
                  id: `idea:${x.id}`,
                  source: "idea",
                  target: x.id,
                  type: "idea",
                  color: "#6483c2",
                },
              }),
            );
        const styles: StylesheetStyle[] = [
          {
            selector: "node",
            style: {
              label: "data(label)",
              "background-color": "data(color)",
              width: "data(size)",
              height: "data(size)",
              "font-size": 10,
              color: "#a6b2c9",
              "text-valign": "bottom",
              "text-margin-y": 9,
              "text-wrap": "wrap",
              "text-max-width": "130px",
              "border-width": 2,
              "border-color": "#1c2639",
            },
          },
          {
            selector: 'node[id="idea"]',
            style: {
              "border-width": 7,
              "border-color": "#35476e",
              "font-size": 12,
              "font-weight": "bold",
            },
          },
          {
            selector: "edge",
            style: {
              width: 1.3,
              "line-color": "data(color)",
              "target-arrow-color": "data(color)",
              "curve-style": "bezier",
              opacity: 0.55,
            },
          },
          {
            selector: 'edge[type="citation"]',
            style: { "target-arrow-shape": "triangle" },
          },
          {
            selector: 'edge[type="similarity"], edge[type="idea"]',
            style: { "line-style": "dashed", width: 1 },
          },
          {
            selector: 'edge[type="co-citation"]',
            style: { "line-style": "dotted" },
          },
          {
            selector: ":selected",
            style: {
              "border-color": "#fff",
              "border-width": 3,
              "line-color": "#fff",
              "target-arrow-color": "#fff",
              opacity: 1,
            },
          },
          { selector: ".faded", style: { opacity: 0.12 } },
        ];
        const instance = cytoscape({
          container: container.current,
          elements: definitions,
          style: styles,
          layout: {
            name:
              mode === "timeline"
                ? "preset"
                : Object.keys(p.positions).length
                  ? "preset"
                  : "cose",
            animate: false,
            padding: 65,
          },
          minZoom: 0.02,
          maxZoom: 3,
          wheelSensitivity: 0.2,
        });
        cy.current = instance;
        instance.on("tap", "node", (e) => {
          const id = e.target.id();
          setSelected(id === "idea" ? null : id);
          setEdgeId(null);
          instance.elements().addClass("faded");
          e.target.closedNeighborhood().removeClass("faded");
        });
        instance.on("tap", "edge", (e) => {
          setEdgeId(e.target.data("type") === "idea" ? null : e.target.id());
          setSelected(null);
          if (e.target.data("type") === "idea")
            notice(
              "Inferred question relevance: title/abstract term overlap. This is not a citation.",
            );
        });
        instance.on("tap", (e) => {
          if (e.target === instance) instance.elements().removeClass("faded");
        });
      })
      .catch(() =>
        setGraphError(
          "The graph renderer could not load. Use the accessible paper and connection controls below.",
        ),
      );
    return () => {
      disposed = true;
      cy.current?.destroy();
      cy.current = null;
    };
  }, [
    papers,
    edges,
    mode,
    challenges,
    earlierCutoff,
    types,
    p.positions,
    notice,
  ]);
  async function expand() {
    if (!paper) return;
    setBusy(true);
    try {
      const res = await fetch("/api/expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId: paper.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const merged = deduplicate([...p.papers, ...data.papers]);
      save({ ...p, papers: rankPapers(merged, p.question) });
      notice(
        data.warning ||
          `Added ${merged.length - p.papers.length} verified reference records.`,
      );
    } catch (error) {
      notice(
        error instanceof Error ? error.message : "Reference expansion failed.",
      );
    } finally {
      setBusy(false);
    }
  }
  const data = [
    ...new Set(
      papers.map((x) => x.year).filter((n): n is number => n !== null),
    ),
  ]
    .sort((a, b) => a - b)
    .map((year) => ({
      year,
      papers: papers.filter((x) => x.year === year).length,
    }));
  function selectPaper(id: string) {
    setSelected(id);
    setEdgeId(null);
    const node = cy.current?.getElementById(id);
    if (node?.length) {
      cy.current?.elements().unselect();
      node.select();
      cy.current?.animate({ center: { eles: node }, duration: 250 });
    }
  }
  return (
    <>
      <div className="map-heading">
        <div>
          <h2>Follow the connections.</h2>
          <p>
            Every paper is a retrieved source. Every relationship carries its
            evidence.
          </p>
        </div>
        <div className="segmented">
          <button
            className={mode === "network" ? "active" : ""}
            onClick={() => setMode("network")}
          >
            <Network size={14} />
            Network
          </button>
          <button
            className={mode === "timeline" ? "active" : ""}
            onClick={() => setMode("timeline")}
          >
            Timeline View
          </button>
        </div>
      </div>
      <div className="graph-filters">
        <label className="search-control">
          <Search size={15} />
          <input
            aria-label="Search graph papers"
            placeholder="Find a paper…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Graph publication year"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        >
          <option value="">All years</option>
          {data.map((d) => (
            <option value={d.year} key={d.year}>
              Since {d.year}
            </option>
          ))}
        </select>
        <select
          aria-label="Isolate topic cluster"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        >
          <option value="">All topic clusters</option>
          {clusters.map((c) => (
            <option
              key={c.label}
              value={c.label === "No provider topic available" ? "" : c.label}
            >
              {c.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Graph journal filter"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
        >
          <option value="">All venues</option>
          {[
            ...new Set(p.papers.flatMap((p) => (p.venue ? [p.venue] : []))),
          ].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <button
          className={`button small ${gaps ? "primary" : ""}`}
          onClick={() => setGaps(!gaps)}
        >
          Show Potential Research Gaps
        </button>
      </div>
      <div className="relationship-filters">
        {(Object.keys(labels) as EdgeType[]).map((t) => (
          <label key={t} className="check-label">
            <input
              type="checkbox"
              checked={types.includes(t)}
              onChange={() =>
                setTypes(
                  types.includes(t)
                    ? types.filter((x) => x !== t)
                    : [...types, t],
                )
              }
            />
            {labels[t]}
          </label>
        ))}
      </div>
      <div className="map-layout">
        <div className="graph-frame">
          <div
            className="graph-canvas"
            ref={container}
            role="img"
            aria-label={`Interactive evidence network: ${papers.length} retrieved papers, ${edges.length} connections. Use the paper selector below for keyboard access.`}
          />
          <div className="graph-title">
            <span className="status-dot" />
            {papers.length} verified records<span>·</span>
            {edges.length} connections
          </div>
          <div className="graph-controls">
            <button
              className="icon-button"
              aria-label="Zoom in"
              onClick={() => cy.current?.zoom(cy.current.zoom() * 1.25)}
            >
              <ZoomIn size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Zoom out"
              onClick={() => cy.current?.zoom(cy.current.zoom() / 1.25)}
            >
              <ZoomOut size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Fit graph"
              onClick={() => cy.current?.fit(undefined, 65)}
            >
              <Maximize size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Reset layout"
              onClick={() => {
                cy.current?.nodes().unlock();
                cy.current
                  ?.layout({
                    name: mode === "timeline" ? "preset" : "cose",
                    animate: false,
                    padding: 65,
                  })
                  .run();
                notice("Graph layout reset.");
              }}
            >
              <RotateCcw size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Save graph layout"
              onClick={() => {
                const positions: Project["positions"] = {};
                cy.current?.nodes().forEach((n) => {
                  positions[n.id()] = n.position();
                });
                save({ ...p, positions });
                notice("Graph positions saved locally.");
              }}
            >
              <Save size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Export graph PNG"
              onClick={() => {
                if (cy.current)
                  downloadBlob(
                    cy.current.png({
                      output: "blob",
                      bg: "#0c1424",
                      scale: 2,
                      full: true,
                    }),
                    "gapforge-network.png",
                  );
              }}
            >
              <Download size={17} />
            </button>
          </div>
          <div className="graph-legend">
            <span>
              <i className="dot blue" />
              Your idea
            </span>
            <span>
              <i className="dot purple" />
              Related
            </span>
            <span>
              <i className="dot green" />
              Earlier studies
            </span>
            <span>
              <i className="dot orange" />
              Possible prior art
            </span>
            <span>
              → citation · — shared refs · ⋯ co-citation · - - inferred
            </span>
          </div>
          {!papers.length && (
            <div className="graph-empty">
              No papers match the current filters.
            </div>
          )}
          {graphError && <p className="error-message">{graphError}</p>}
        </div>
        {paper ? (
          <aside className="paper-detail panel">
            <div className="row between">
              <span className="eyebrow">VERIFIED PAPER METADATA</span>
              <button
                className="icon-button"
                aria-label="Close paper details"
                onClick={() => setSelected(null)}
              >
                <X size={16} />
              </button>
            </div>
            <h3>{paper.title}</h3>
            <p className="meta">
              {paper.authors.join(", ") || "Authors unavailable"}
            </p>
            <p className="meta">
              {paper.year ?? "Unknown year"} · {paper.venue ?? "Unknown venue"}{" "}
              · {paper.citations ?? "Unknown"} citations
            </p>
            <div className="row wrap">
              {paper.topics.map((t) => (
                <span className="topic" key={t}>
                  {t}
                </span>
              ))}
            </div>
            <div className="classification">
              <strong>Classification explanation</strong>
              <p>
                {challenges.has(paper.id)
                  ? "Potential prior art: the separate challenge assessed direct or significant partial overlap. This is an AI interpretation of available evidence."
                  : paper.year && paper.year <= earlierCutoff
                    ? "Earlier study within this retrieved set. This does not establish that the work is foundational or influenced another paper."
                    : paper.relevance >= 0.15
                      ? "Related: computational title/abstract word overlap meets the display threshold."
                      : "Other retrieved paper; relevance remains uncertain."}
              </p>
            </div>
            <span className="eyebrow">
              {paper.abstract ? "RETRIEVED ABSTRACT" : "METADATA ONLY"}
            </span>
            <p className="detail-abstract">
              {paper.abstract ?? "Abstract unavailable."}
            </p>
            <div className="row wrap">
              {paper.url && (
                <a
                  className="button small"
                  href={paper.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Original source
                  <ExternalLink size={13} />
                </a>
              )}
              <button
                className="button small"
                onClick={() =>
                  save({
                    ...p,
                    bookmarks: p.bookmarks.includes(paper.id)
                      ? p.bookmarks.filter((id) => id !== paper.id)
                      : [...p.bookmarks, paper.id],
                  })
                }
              >
                <Bookmark size={14} />
                {p.bookmarks.includes(paper.id) ? "Bookmarked" : "Bookmark"}
              </button>
              <button
                className="button small"
                onClick={() => {
                  const n = cy.current?.getElementById(paper.id);
                  if (n?.locked()) n.unlock();
                  else n?.lock();
                  notice(
                    n?.locked()
                      ? "Node pinned for this session."
                      : "Node unpinned.",
                  );
                }}
              >
                <Pin size={14} />
                Pin / unpin
              </button>
              <button
                className="button small"
                disabled={busy || !paper.references.length}
                onClick={() => void expand()}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={14} />
                ) : (
                  <GitBranch size={14} />
                )}
                Expand references
              </button>
              <button
                className="button small"
                onClick={() => setTrace(paper.id)}
              >
                Trace Research Evolution
              </button>
            </div>
            <p className="meta">
              DOI: {paper.doi ?? "Unavailable"}
              <br />
              OpenAlex: {paper.openalexId ?? "Unavailable"}
              <br />
              Semantic Scholar: {paper.semanticId ?? "Unavailable"}
            </p>
            <Link
              className="button small"
              href={`/research/${p.id}/challenge?focus=${encodeURIComponent(paper.id)}`}
            >
              <ShieldCheck size={14} />
              Challenge using this paper
            </Link>
            <h4>Relevant connections</h4>
            {allEdges
              .filter((e) => e.source === paper.id || e.target === paper.id)
              .slice(0, 12)
              .map((e) => (
                <button
                  className="connection-link"
                  key={e.id}
                  onClick={() => {
                    setSelected(null);
                    setEdgeId(e.id);
                  }}
                >
                  {labels[e.type]} ·{" "}
                  {
                    p.papers.find(
                      (x) =>
                        x.id === (e.source === paper.id ? e.target : e.source),
                    )?.title
                  }
                </button>
              ))}
          </aside>
        ) : edge ? (
          <aside className="paper-detail panel">
            <div className="row between">
              <span className="tag">
                {edge.verified
                  ? "Verified metadata relationship"
                  : "Computational inference"}
              </span>
              <button
                className="icon-button"
                aria-label="Close connection details"
                onClick={() => setEdgeId(null)}
              >
                <X size={16} />
              </button>
            </div>
            <h3>{labels[edge.type]}</h3>
            <p>{p.papers.find((p) => p.id === edge.source)?.title}</p>
            <p>→ {p.papers.find((p) => p.id === edge.target)?.title}</p>
            <p>{edge.explanation}</p>
            <h4>Supporting identifiers</h4>
            {edge.evidence.length ? (
              <ul>
                {edge.evidence.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            ) : (
              <p>
                No verified citation evidence. This relationship uses word
                overlap.
              </p>
            )}
            <p className="meta">
              Provider coverage may be incomplete. A relationship is not
              evidence of scientific agreement or influence.
            </p>
          </aside>
        ) : (
          <aside className="map-instructions panel">
            <Network size={28} />
            <h3>Look closer.</h3>
            <p>Select a paper or connection to inspect its evidence.</p>
            <p>
              Drag to arrange. Scroll to zoom. Save the layout to return to your
              view.
            </p>
            <div className="map-callout">
              <ShieldCheck size={18} />
              <p>
                Solid arrows use verified reference metadata. Dashed links
                represent inferred word overlap.
              </p>
            </div>
            <Link
              href={`/research/${p.id}/challenge?focus=${encodeURIComponent(
                p.papers
                  .slice(0, 20)
                  .map((x) => x.id)
                  .join(","),
              )}`}
              className="button"
            >
              <ShieldCheck size={15} />
              Challenge Novelty Using This Network
            </Link>
            <p className="meta">
              The challenge runs additional searches using this project
              question. For a selected cluster, use its “Challenge cluster” link
              below.
            </p>
          </aside>
        )}
      </div>
      <div className="accessible-map panel">
        <label>
          Inspect a paper
          <select
            aria-label="Inspect a paper"
            value={selected ?? ""}
            onChange={(e) => selectPaper(e.target.value)}
          >
            <option value="">Choose a paper…</option>
            {papers.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Inspect a connection
          <select
            aria-label="Inspect a connection"
            value={edgeId ?? ""}
            onChange={(e) => {
              setEdgeId(e.target.value);
              setSelected(null);
            }}
          >
            <option value="">Choose a relationship…</option>
            {edges.map((e) => (
              <option key={e.id} value={e.id}>
                {labels[e.type]}:{" "}
                {p.papers.find((x) => x.id === e.source)?.title.slice(0, 45)} →{" "}
                {p.papers.find((x) => x.id === e.target)?.title.slice(0, 45)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {trace && (
        <div className="panel">
          <div className="row between">
            <h3>
              Verified reference lineage ·{" "}
              {p.papers.find((p) => p.id === trace)?.title}
            </h3>
            <button
              className="icon-button"
              aria-label="Close lineage"
              onClick={() => setTrace(null)}
            >
              <X size={17} />
            </button>
          </div>
          <p>
            Only backward reference links present in the retrieved network are
            followed. Chronology does not establish influence.
          </p>
          <ol>
            {traceReferences(trace, p.papers).map((x) => (
              <li key={x.id}>
                <button className="text-link" onClick={() => selectPaper(x.id)}>
                  {x.year ?? "Unknown year"} · {x.title}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
      {gaps && (
        <div className="panel">
          <div className="eyebrow">PROVISIONAL RESEARCH GAP OVERLAY</div>
          <p>A missing graph edge is not evidence of a scientific gap.</p>
          {[...(p.assessment?.gaps ?? []), ...(p.challenge?.gaps ?? [])]
            .length ? (
            [...(p.assessment?.gaps ?? []), ...(p.challenge?.gaps ?? [])].map(
              (g, i) => (
                <article key={`${g.id}-${i}`}>
                  <h3>{g.title}</h3>
                  <p>{g.explanation}</p>
                  <blockquote>{g.evidence}</blockquote>
                  <p>
                    Supporting papers:{" "}
                    {g.supportingPaperIds
                      .map((id) => p.papers.find((x) => x.id === id)?.title)
                      .join("; ")}
                  </p>
                  <p>
                    Challenging papers:{" "}
                    {g.challengingPaperIds
                      .map((id) => p.papers.find((x) => x.id === id)?.title)
                      .join("; ") ||
                      "None identified; further search required."}
                  </p>
                  <p>Suggested searches: {g.suggestedSearches.join("; ")}</p>
                  <p>Possible experiment: {g.experiment}</p>
                  <p className="meta">{g.limitation}</p>
                </article>
              ),
            )
          ) : (
            <p>
              No evidence-grounded gap hypotheses available. Generate an AI
              assessment after configuring the integration.
            </p>
          )}
        </div>
      )}
      <div className="panel">
        <div className="row between">
          <div>
            <h3>Topic communities</h3>
            <p className="meta">
              Grouped by each paper’s first provider-supplied topic. These are
              metadata groups, not inferred scientific consensus.
            </p>
          </div>
          <span className="tag">{clusters.length} groups</span>
        </div>
        <div className="cluster-grid">
          {clusters.map((c) => (
            <article className="cluster-card" key={c.label}>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={compare.includes(c.label)}
                  onChange={() =>
                    setCompare(
                      compare.includes(c.label)
                        ? compare.filter((x) => x !== c.label)
                        : [...compare, c.label],
                    )
                  }
                />
                Compare group
              </label>
              <button
                className="text-link"
                onClick={() => setTopic(topic === c.label ? "" : c.label)}
              >
                {c.label}
              </button>
              <p className="meta">{c.papers.length} retrieved papers</p>
              <ol>
                {c.papers.slice(0, 3).map((x) => (
                  <li key={x.id}>
                    <button
                      className="text-link"
                      onClick={() => selectPaper(x.id)}
                    >
                      {x.title}
                    </button>
                  </li>
                ))}
              </ol>
              <Link
                className="text-link"
                href={`/research/${p.id}/challenge?focus=${encodeURIComponent(
                  c.papers
                    .slice(0, 20)
                    .map((x) => x.id)
                    .join(","),
                )}`}
              >
                Challenge cluster with additional searches{" "}
                <ShieldCheck size={13} />
              </Link>
            </article>
          ))}
        </div>
        {compare.length > 1 && (
          <div className="comparison-scroll">
            <table>
              <caption>Selected topic groups · metadata comparison</caption>
              <thead>
                <tr>
                  <th>Topic</th>
                  <th>Papers</th>
                  <th>Years</th>
                  <th>Available abstracts</th>
                </tr>
              </thead>
              <tbody>
                {clusters
                  .filter((c) => compare.includes(c.label))
                  .map((c) => (
                    <tr key={c.label}>
                      <td>{c.label}</td>
                      <td>{c.papers.length}</td>
                      <td>
                        {[...new Set(c.papers.map((p) => p.year))].join(", ")}
                      </td>
                      <td>{c.papers.filter((p) => p.abstract).length}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <section className="panel">
        <h3>Literature over time</h3>
        <p className="meta">
          Publication counts within this search; not a measure of field size or
          influence.
        </p>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="year" stroke="#8290a8" />
              <YAxis allowDecimals={false} stroke="#8290a8" />
              <Tooltip
                contentStyle={{
                  background: "#152034",
                  border: "1px solid #35435a",
                  color: "#e7edff",
                }}
              />
              <Bar dataKey="papers" fill="#8c80e8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </>
  );
}
export function MapIndex() {
  const { projects } = useWorkspace();
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">FOLLOW THE EVIDENCE</div>
          <h1>Research Maps</h1>
          <p>
            Choose a project to explore verified citations and inferred
            connections.
          </p>
        </div>
      </div>
      {projects.length ? (
        projects.map((p) => (
          <Link
            key={p.id}
            className="panel map-index"
            href={`/research/${p.id}/map`}
          >
            <Network size={23} />
            <div>
              <h3>{p.question}</h3>
              <p>{p.papers.length} papers</p>
            </div>
          </Link>
        ))
      ) : (
        <div className="empty-state">
          <Network size={32} />
          <h3>Your map begins with real literature.</h3>
          <Link className="button" href="/research/new">
            Create research analysis
          </Link>
        </div>
      )}
    </>
  );
}
