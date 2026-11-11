"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Bookmark,
  ExternalLink,
  Copy,
  ChevronDown,
  Search,
  BookOpen,
  Library,
} from "lucide-react";
import { type Paper, type Project } from "@/lib/model";
import { filterPapers } from "@/lib/literature";
import { citation } from "@/lib/report";
import { useWorkspace } from "./workspace-provider";
export function PaperCard({
  paper,
  project,
}: {
  paper: Paper;
  project?: Project;
}) {
  const { save, notice } = useWorkspace();
  const [open, setOpen] = useState(false);
  const saved = project?.bookmarks.includes(paper.id);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notice("Copied to clipboard.");
    } catch {
      notice("Clipboard unavailable. Select and copy the source text.");
    }
  };
  return (
    <article className="paper-card">
      <div className="paper-card-main">
        <div className="paper-number">
          <BookOpen size={19} />
        </div>
        <div className="paper-text">
          <div className="row wrap meta">
            <span>{paper.year ?? "Year unavailable"}</span>
            <span className="provider-tag">{paper.providers.join(" + ")}</span>
            {paper.openAccessUrl && (
              <a
                href={paper.openAccessUrl}
                target="_blank"
                rel="noreferrer"
                className="open-access"
              >
                Open access <ExternalLink size={11} />
              </a>
            )}
          </div>
          <h3>
            {paper.url ? (
              <a href={paper.url} target="_blank" rel="noreferrer">
                {paper.title}
                <ArrowSource />
              </a>
            ) : (
              paper.title
            )}
          </h3>
          <p className="paper-authors">
            {paper.authors.slice(0, 5).join(", ") || "Authors unavailable"}
            {paper.authors.length > 5 ? " et al." : ""}
          </p>
          <p className="meta">
            {paper.venue ?? "Venue unavailable"}
            <span>·</span>
            {paper.citations !== null
              ? `${paper.citations.toLocaleString()} citations (provider metadata)`
              : "Citation count unavailable"}
          </p>
          <div className="row wrap">
            {paper.topics.slice(0, 3).map((topic) => (
              <span className="topic" key={topic}>
                {topic}
              </span>
            ))}
          </div>
        </div>
        {project && (
          <button
            className={`icon-button ${saved ? "is-saved" : ""}`}
            aria-label={saved ? "Remove bookmark" : "Bookmark paper"}
            onClick={() =>
              save({
                ...project,
                bookmarks: saved
                  ? project.bookmarks.filter((id) => id !== paper.id)
                  : [...project.bookmarks, paper.id],
              })
            }
          >
            <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
          </button>
        )}
      </div>
      <div className="paper-actions">
        <button
          className="text-link"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          {open ? "Hide abstract" : "Read abstract"}
          <ChevronDown size={14} />
        </button>
        <span className="action-spacer" />
        <button
          className="text-link"
          onClick={() => void copy(citation(paper))}
        >
          <Copy size={13} />
          Copy citation
        </button>
        {paper.doi && (
          <button className="text-link" onClick={() => void copy(paper.doi!)}>
            Copy DOI
          </button>
        )}
      </div>
      {open && (
        <div className="abstract">
          <span className="eyebrow">
            {paper.abstract ? "RETRIEVED ABSTRACT" : "METADATA ONLY"}
          </span>
          <p>{paper.abstract ?? "Abstract unavailable."}</p>
          <small>
            Provider metadata retrieved{" "}
            {new Date(paper.retrievedAt).toLocaleString()}. Full text has not
            been processed.
          </small>
        </div>
      )}
    </article>
  );
}
function ArrowSource() {
  return <ExternalLink size={13} className="source-icon" />;
}
export function PaperList({
  papers,
  project,
}: {
  papers: Paper[];
  project?: Project;
}) {
  const [search, setSearch] = useState(""),
    [year, setYear] = useState(""),
    [venue, setVenue] = useState(""),
    [topic, setTopic] = useState(""),
    [provider, setProvider] = useState(""),
    [openAccess, setOpenAccess] = useState(false),
    [minCitations, setMinCitations] = useState(0),
    [sort, setSort] = useState("relevance");
  const [limit, setLimit] = useState(15);
  const filtered = useMemo(() => {
    const list = filterPapers(papers, {
      search,
      fromYear: year ? +year : undefined,
      venue,
      topic,
      provider,
      openAccess,
      minCitations,
    });
    return sort === "year"
      ? list.sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
      : sort === "citations"
        ? list.sort((a, b) => (b.citations ?? 0) - (a.citations ?? 0))
        : list.sort((a, b) => b.relevance - a.relevance);
  }, [
    papers,
    search,
    year,
    venue,
    topic,
    provider,
    openAccess,
    minCitations,
    sort,
  ]);
  return (
    <>
      <div className="paper-filters">
        <label className="search-control">
          <Search size={16} />
          <input
            placeholder="Search titles or authors"
            aria-label="Search papers"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Sort papers"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="relevance">Term-overlap relevance</option>
          <option value="year">Most recent</option>
          <option value="citations">Most cited</option>
        </select>
        <select
          aria-label="Minimum publication year"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        >
          <option value="">All years</option>
          {[
            ...new Set(
              papers.map((p) => p.year).filter((y): y is number => y !== null),
            ),
          ]
            .sort((a, b) => b - a)
            .map((y) => (
              <option key={y} value={y}>
                Since {y}
              </option>
            ))}
        </select>
        <select
          aria-label="Filter journal"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
        >
          <option value="">All venues</option>
          {[...new Set(papers.flatMap((p) => (p.venue ? [p.venue] : [])))].map(
            (v) => (
              <option key={v}>{v}</option>
            ),
          )}
        </select>
        <select
          aria-label="Filter topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        >
          <option value="">All topics</option>
          {[...new Set(papers.flatMap((p) => p.topics))].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select
          aria-label="Filter source provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        >
          <option value="">All providers</option>
          <option>OpenAlex</option>
          <option>Semantic Scholar</option>
        </select>
        <label className="inline-label">
          Min. citations
          <input
            type="number"
            aria-label="Minimum citation count"
            min={0}
            value={minCitations}
            onChange={(e) => setMinCitations(+e.target.value)}
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={openAccess}
            onChange={(e) => setOpenAccess(e.target.checked)}
          />
          Open access
        </label>
      </div>
      <p className="meta">
        {filtered.length} of {papers.length} papers · Relevance uses
        computational word overlap, not a scientific quality score.
      </p>
      <div className="papers-list">
        {filtered.slice(0, limit).map((p) => (
          <PaperCard key={p.id} paper={p} project={project} />
        ))}
      </div>
      {!filtered.length && (
        <div className="empty-state">
          <Search size={28} />
          <h3>No papers match.</h3>
          <p>Adjust the filters or run a broader literature search.</p>
        </div>
      )}
      {filtered.length > limit && (
        <button
          className="button load-more"
          onClick={() => setLimit(limit + 15)}
        >
          Show more papers <ChevronDown size={15} />
        </button>
      )}
    </>
  );
}
export function PersonalLibrary() {
  const { projects } = useWorkspace();
  const [onlySaved, setOnlySaved] = useState(false);
  const entries = [
    ...new Map(
      projects.flatMap((p) =>
        p.papers
          .filter((x) => !onlySaved || p.bookmarks.includes(x.id))
          .map((x) => [x.id, { paper: x, project: p }] as const),
      ),
    ).values(),
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">COLLECT. READ. CONNECT.</div>
          <h1>Paper Library</h1>
          <p>Your collected literature and personal reading queue.</p>
        </div>
        <button
          className={`button ${onlySaved ? "primary" : ""}`}
          onClick={() => setOnlySaved(!onlySaved)}
        >
          <Bookmark size={16} />
          {onlySaved ? "Show all papers" : "Reading queue"}
        </button>
      </div>
      {!entries.length ? (
        <div className="empty-state">
          <Library size={33} />
          <h3>
            {onlySaved
              ? "Your reading queue is empty."
              : "Your literature library starts with a search."}
          </h3>
          <p>
            Bookmark papers inside a project to add them to your reading queue.
          </p>
          <Link className="button" href="/research/new">
            Explore a question
          </Link>
        </div>
      ) : (
        entries.map(({ paper, project }) => (
          <PaperCard key={paper.id} paper={paper} project={project} />
        ))
      )}
    </>
  );
}
