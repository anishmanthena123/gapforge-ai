"use client";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
export default function Page() {
  const { projects } = useWorkspace();
  const saved = projects.flatMap((p) =>
    [...(p.assessment?.gaps ?? []), ...(p.challenge?.gaps ?? [])]
      .filter((g) => p.savedGaps.includes(g.id))
      .map((g) => ({ p, g })),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">QUESTIONS FOR WHAT COMES NEXT</div>
          <h1>Saved Gaps</h1>
          <p>
            Provisional research directions you want to investigate further.
          </p>
        </div>
      </div>
      {saved.length ? (
        <div className="gap-grid">
          {saved.map(({ p, g }, i) => (
            <article className="panel gap-card" key={`${p.id}-${g.id}-${i}`}>
              <span className="tag">Provisional hypothesis</span>
              <h3>{g.title}</h3>
              <p>{g.explanation}</p>
              <p className="meta">{g.limitation}</p>
              <Link className="text-link" href={`/research/${p.id}`}>
                Review supporting and challenging evidence →
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Bookmark size={30} />
          <h3>A promising gap is a question, not a conclusion.</h3>
          <p>
            Save gap hypotheses from an evidence overview or novelty challenge.
          </p>
          <Link className="button" href="/projects">
            Browse research projects
          </Link>
        </div>
      )}
    </>
  );
}
