import Link from "next/link";
import { Plus } from "lucide-react";
import { ProjectCards } from "@/components/dashboard";
export default function Page() {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR RESEARCH HISTORY</div>
          <h1>My Projects</h1>
          <p>Reopen a question and continue from the evidence.</p>
        </div>
        <Link className="button primary" href="/research/new">
          <Plus size={17} />
          New research
        </Link>
      </div>
      <ProjectCards all />
    </>
  );
}
