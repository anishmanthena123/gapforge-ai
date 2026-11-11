"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main id="main-content" className="empty-state">
      <h1>The workspace could not load this view.</h1>
      <p>
        Your browser-saved projects may still be available. Try reloading this
        page.
      </p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
