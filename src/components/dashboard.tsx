"use client";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Search,
  FolderOpen,
  Library,
  Network,
  ShieldCheck,
  Plus,
  Clock,
  Trash2,
  Bookmark,
} from "lucide-react";
import { useWorkspace } from "./workspace-provider";
export function ProjectCards({ all = false }: { all?: boolean }) {
  const { projects, ready, remove } = useWorkspace();
  if (!ready) return <div className="skeleton" aria-label="Loading projects" />;
  if (!projects.length)
    return (
      <div className="empty-state">
        <FolderOpen size={33} />
        <h3>Your next question starts here.</h3>
        <p>
          Create an analysis to collect literature, challenge novelty, and build
          your first evidence map.
        </p>
        <Link className="button" href="/research/new">
          <Plus size={16} />
          New research
        </Link>
      </div>
    );
  return (
    <div className="project-grid">
      {(all ? projects : projects.slice(0, 4)).map((p) => (
        <article className="project-card" key={p.id}>
          <div className="row between">
            <span className="tag">{p.concepts.field}</span>
            <button
              className="icon-button"
              aria-label={`Remove local project ${p.question}`}
              onClick={() => {
                if (confirm("Remove this project from this browser?"))
                  remove(p.id);
              }}
            >
              <Trash2 size={15} />
            </button>
          </div>
          <Link href={`/research/${p.id}`}>
            <h3>{p.question}</h3>
          </Link>
          <p>
            {p.assessment?.verdict ?? "Literature collected · no AI verdict"}
          </p>
          <div className="row between meta">
            <span>
              {p.papers.length} papers · {p.bookmarks.length} saved
            </span>
            <span>
              <Clock size={12} />
              {new Date(p.updatedAt).toLocaleDateString()}
            </span>
          </div>
          <div className="project-links">
            <Link href={`/research/${p.id}/map`}>
              <Network size={14} />
              Map
            </Link>
            <Link href={`/research/${p.id}/challenge`}>
              <ShieldCheck size={14} />
              Challenge
            </Link>
            <Link
              href={`/research/${p.id}`}
              aria-label={`Open project ${p.question}`}
            >
              <ArrowUpRight size={17} />
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
export function Dashboard() {
  const { projects, email } = useWorkspace();
  const papers = new Set(projects.flatMap((p) => p.papers.map((x) => x.id)))
    .size;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR RESEARCH, CONNECTED</div>
          <h1>Make room for the next idea.</h1>
          <p>Explore what’s known. Question what seems new.</p>
        </div>
        <Link href="/research/new" className="button primary">
          <Plus size={17} />
          New research
        </Link>
      </div>
      <div className="dashboard-hero">
        <div>
          <span className="eyebrow">THE RESEARCH WORKSPACE</span>
          <h2>
            What are you
            <br />
            curious about?
          </h2>
          <p>Start with an idea. Build a case with evidence.</p>
          <Link className="question-launch" href="/research/new">
            <Search size={20} />
            <span>Enter a research question or paste your proposal…</span>
            <span className="launch-arrow">
              <ArrowRight size={19} />
            </span>
          </Link>
          <div className="meta">
            <ShieldCheck size={14} />
            Real academic sources · Evidence-backed interpretation
          </div>
        </div>
        <div className="orbital" aria-hidden="true">
          <div className="orbit one" />
          <div className="orbit two" />
          <div className="orbit three" />
          <div className="orbit-center">
            <Network size={35} />
          </div>
          <i className="orbit-point p1" />
          <i className="orbit-point p2" />
          <i className="orbit-point p3" />
          <i className="orbit-point p4" />
          <span>
            QUESTION EVERYTHING.
            <br />
            CONNECT WHAT MATTERS.
          </span>
        </div>
      </div>
      <div className="stats-grid">
        {[
          [FolderOpen, "Research projects", projects.length],
          [Library, "Papers collected", papers],
          [
            Network,
            "Evidence maps",
            projects.filter((p) => p.papers.length).length,
          ],
          [
            Bookmark,
            "Saved gaps",
            projects.reduce((n, p) => n + p.savedGaps.length, 0),
          ],
        ].map(([Icon, label, value]) => {
          const I = Icon as typeof FolderOpen;
          return (
            <div className="stat" key={String(label)}>
              <I size={18} />
              <strong>{String(value)}</strong>
              <span>{String(label)}</span>
            </div>
          );
        })}
      </div>
      <div className="section-heading compact">
        <div>
          <h2>Recent research</h2>
          <p>Your questions, and where the evidence led.</p>
        </div>
        <Link className="text-link" href="/projects">
          All projects <ArrowRight size={15} />
        </Link>
      </div>
      <ProjectCards />
      <div className="honesty-banner">
        <ShieldCheck size={22} />
        <div>
          <strong>Confidence starts with knowing the limits.</strong>
          <p>
            {email
              ? "Cloud saves happen when you choose “Save to cloud” inside a project."
              : "You’re in guest mode. Research is saved in this browser; sign in to save a cloud copy."}
          </p>
        </div>
        <Link href="/settings">
          {email ? "Manage account" : "Set up your workspace"}
          <ArrowUpRight size={16} />
        </Link>
      </div>
    </>
  );
}
