import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main-content" className="empty-state">
      <h1>That page isn’t in the network.</h1>
      <Link className="button" href="/dashboard">
        Return to the workspace
      </Link>
    </main>
  );
}
