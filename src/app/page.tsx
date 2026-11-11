import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Search,
  ShieldCheck,
  Network,
  FlaskConical,
  FileCheck2,
  GitBranch,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/shell";
export default function Home() {
  return (
    <div className="landing">
      <header className="landing-header">
        <Logo />
        <nav aria-label="Landing navigation">
          <a href="#approach">The approach</a>
          <a href="#workspace">Your workspace</a>
          <a
            href="https://github.com/anishmanthena123/gapforge-ai"
            target="_blank"
            rel="noreferrer"
          >
            GitHub <ArrowUpRight size={14} />
          </a>
        </nav>
        <div className="row">
          <ThemeToggle />
          <Link className="button small" href="/dashboard">
            Open workspace <ArrowRight size={15} />
          </Link>
        </div>
      </header>
      <main id="main-content">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="status-dot" />A MORE RIGOROUS STARTING POINT
            </div>
            <h1>
              Every great idea
              <br />
              deserves a<br />
              <em>good challenge.</em>
            </h1>
            <p>
              Go beyond a literature summary. Discover real papers, connect the
              evidence, and put your research question to the test.
            </p>
            <div className="row wrap">
              <Link className="button primary large" href="/research/new">
                Explore your research idea <ArrowRight size={19} />
              </Link>
              <Link className="text-link" href="/dashboard">
                Enter the workspace <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="hero-proof">
              <ShieldCheck size={16} /> Real sources. Visible uncertainty. No
              novelty scores.
            </div>
          </div>
          <div
            className="hero-visual"
            aria-label="Illustration of the evidence workflow, not an academic paper network"
          >
            <div className="visual-top">
              <span className="eyebrow">THE EVIDENCE NETWORK</span>
              <span className="live-label">WORKFLOW</span>
            </div>
            <svg
              viewBox="0 0 550 470"
              className="workflow-svg"
              aria-hidden="true"
            >
              <defs>
                <pattern
                  id="grid"
                  width="27"
                  height="27"
                  patternUnits="userSpaceOnUse"
                >
                  <circle
                    cx="1"
                    cy="1"
                    r="0.8"
                    fill="currentColor"
                    opacity=".25"
                  />
                </pattern>
              </defs>
              <rect width="550" height="470" fill="url(#grid)" />
              <g
                fill="none"
                stroke="currentColor"
                strokeOpacity=".25"
                strokeWidth="1.5"
              >
                <path d="M270 230L130 120L76 267L270 230L430 126L455 302L270 230L300 393L76 267M130 120L430 126M130 120L300 393M455 302L300 393" />
                <path
                  d="M270 230L165 330M270 230L336 70M430 126L336 70"
                  strokeDasharray="5 6"
                />
              </g>
              <g fill="#a391ff">
                <circle cx="130" cy="120" r="10" />
                <circle cx="76" cy="267" r="6" />
                <circle cx="336" cy="70" r="6" />
              </g>
              <g fill="#70c9a9">
                <circle cx="300" cy="393" r="8" />
                <circle cx="165" cy="330" r="5" />
              </g>
              <g fill="#e9ab6a">
                <circle cx="430" cy="126" r="11" />
                <circle cx="455" cy="302" r="6" />
              </g>
              <circle cx="270" cy="230" r="39" fill="#6284ff" opacity=".1" />
              <circle cx="270" cy="230" r="27" fill="#6284ff" opacity=".22" />
              <circle cx="270" cy="230" r="12" fill="#7b9aff" />
              <g fill="currentColor" fontSize="12" fontFamily="sans-serif">
                <text x="211" y="284">
                  Your research idea
                </text>
                <text x="69" y="92">
                  Related literature
                </text>
                <text x="372" y="99">
                  Novelty challenges
                </text>
                <text x="241" y="429">
                  Foundational context
                </text>
              </g>
            </svg>
            <div className="visual-bottom">
              <span>
                <i className="dot purple" />
                Retrieved evidence
              </span>
              <span>
                <i className="dot orange" />
                Prior-art search
              </span>
              <span>Conceptual workflow</span>
            </div>
            <div className="visual-callout">
              <ShieldCheck size={20} />
              <div>
                <strong>Challenge the claim.</strong>
                <span>Actively search for what could prove it wrong.</span>
              </div>
              <ArrowUpRight size={18} />
            </div>
          </div>
        </section>
        <section className="principle-band">
          <span>THE GAPFORGE PRINCIPLE</span>
          <h2>
            Don’t just find research gaps.
            <br />
            <span>Prove they might actually exist.</span>
          </h2>
          <p>
            A short search can’t prove an idea is original. Your workspace keeps
            the evidence, the interpretation, and the unknowns in view.
          </p>
        </section>
        <section className="landing-features" id="approach">
          <div className="section-heading">
            <div>
              <div className="eyebrow">FROM QUESTION TO EVIDENCE</div>
              <h2>
                A thinking partner.
                <br />
                With a skeptical streak.
              </h2>
            </div>
            <p>
              One connected workflow for exploring what is known—and asking
              better questions about what comes next.
            </p>
          </div>
          <div className="feature-grid">
            {[
              [
                Search,
                "01",
                "Find the real literature",
                "Search OpenAlex and Semantic Scholar with multiple academic queries. Follow original sources and inspect available abstracts.",
              ],
              [
                ShieldCheck,
                "02",
                "Challenge your originality",
                "Run a separate prior-art search. Examine overlap and limitations before refining your contribution.",
              ],
              [
                Network,
                "03",
                "See how ideas connect",
                "Explore verified citation links alongside explicitly labeled computational similarities.",
              ],
              [
                FlaskConical,
                "04",
                "Turn a gap into a test",
                "Develop provisional experiments with controls, baselines, resource needs, and a six-month plan.",
              ],
            ].map(([Icon, n, title, text]) => {
              const I = Icon as typeof Search;
              return (
                <article className="feature" key={String(n)}>
                  <div className="row between">
                    <I size={24} />
                    <span className="mono muted">{String(n)}</span>
                  </div>
                  <h3>{String(title)}</h3>
                  <p>{String(text)}</p>
                </article>
              );
            })}
          </div>
        </section>
        <section className="landing-cta" id="workspace">
          <GitBranch size={32} />
          <h2>
            Start with a question.
            <br />
            Leave with a clearer direction.
          </h2>
          <p>
            Your projects, paper library, evidence maps, and sourced reports—all
            in one research workspace.
          </p>
          <Link className="button primary large" href="/research/new">
            Create your first analysis <ArrowRight size={18} />
          </Link>
          <span>
            <FileCheck2 size={15} /> Guest mode available · stored in your
            browser
          </span>
        </section>
      </main>
      <footer className="landing-footer">
        <Logo />
        <span>Built for curiosity. Designed for intellectual honesty.</span>
        <Link href="/settings">
          Integrations & settings <ArrowUpRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
