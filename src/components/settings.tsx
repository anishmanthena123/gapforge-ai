"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  Check,
  ExternalLink,
  LoaderCircle,
  LogOut,
  ShieldCheck,
  KeyRound,
} from "lucide-react";
import { browserSupabase } from "@/lib/supabase/client";
import { useWorkspace } from "./workspace-provider";
import { ThemeToggle } from "./shell";
export function Settings() {
  const { email, refreshAuth, notice, importGuestProjects } = useWorkspace();
  const [config, setConfig] = useState<Record<string, boolean> | null>(null),
    [address, setAddress] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [signup, setSignup] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setError("Could not inspect integration configuration."));
  }, []);
  async function auth(e: FormEvent) {
    e.preventDefault();
    const db = browserSupabase();
    if (!db) {
      setError(
        "Supabase is not configured. Follow the repository setup guide.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data, error } = signup
        ? await db.auth.signUp({ email: address, password })
        : await db.auth.signInWithPassword({ email: address, password });
      if (error) throw error;
      if (signup && !data.session)
        notice(
          "Account created. Check your email for the confirmation link before signing in.",
        );
      else notice("Signed in. Cloud project loading requested.");
      await refreshAuth();
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A WORKSPACE THAT’S YOURS</div>
          <h1>Settings</h1>
          <p>Account, integrations, and research preferences.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <div className="row">
            <KeyRound size={20} />
            <h2>Your account</h2>
          </div>
          {email ? (
            <>
              <p>
                Signed in as <strong>{email}</strong>.
              </p>
              <p>
                Choose “Save to cloud” inside each project to upload it. Local
                projects are not automatically uploaded.
              </p>
              <button className="button" onClick={importGuestProjects}>
                Import guest projects into this account workspace
              </button>
              <button
                className="button"
                onClick={async () => {
                  const { error } = await browserSupabase()!.auth.signOut();
                  if (error) {
                    setError(error.message);
                    return;
                  }
                  await refreshAuth();
                  notice("Signed out. Guest workspace restored.");
                }}
              >
                <LogOut size={15} />
                Sign out
              </button>
            </>
          ) : (
            <form className="auth-form" onSubmit={auth}>
              <p>
                Guest research stays in this browser. Sign in to save project
                copies to your own Supabase account.
              </p>
              <label>
                Email address
                <input
                  type="email"
                  autoComplete="email"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete={signup ? "new-password" : "current-password"}
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <button
                className="button primary"
                disabled={busy || config?.supabase === false}
              >
                {busy ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <ShieldCheck size={16} />
                )}{" "}
                {signup ? "Create account" : "Sign in"}
              </button>
              <button
                type="button"
                className="text-link"
                onClick={() => setSignup(!signup)}
              >
                {signup
                  ? "Already have an account? Sign in"
                  : "Create a research account"}
              </button>
              {config?.supabase === false && (
                <p className="notice">
                  Set the public Supabase URL and publishable key, apply the
                  migration, and configure email authentication to enable
                  sign-in.
                </p>
              )}
            </form>
          )}
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
        </section>
        <div>
          <section className="panel">
            <h2>Appearance</h2>
            <div className="row between">
              <div>
                <strong>Light / dark mode</strong>
                <p className="meta">Saved in this browser.</p>
              </div>
              <ThemeToggle />
            </div>
          </section>
          <section className="panel">
            <h2>Keyboard shortcuts</h2>
            <div className="row between">
              <span>New research</span>
              <kbd>⌘ / Ctrl + K</kbd>
            </div>
          </section>
        </div>
      </div>
      <section className="panel">
        <div className="row between wrap">
          <div>
            <h2>Research integrations</h2>
            <p>
              Provider credentials stay on the server. Configuration does not
              verify connectivity or database setup.
            </p>
          </div>
          <span className="tag">No credentials shown</span>
        </div>
        {[
          [
            "openalex",
            "OpenAlex",
            "Primary academic literature provider. An API key may be required by current provider policy.",
          ],
          [
            "semanticScholar",
            "Semantic Scholar",
            "Additional literature and reference metadata. Unauthenticated access is rate-limited; a key improves availability.",
          ],
          [
            "openai",
            "OpenAI",
            "Structured, evidence-grounded interpretation, experiments, and chat. Requires sign-in by default.",
          ],
          [
            "supabase",
            "Supabase",
            "Email authentication and private cloud storage. Apply the supplied migration before saving.",
          ],
        ].map(([key, title, text]) => (
          <div className="integration-row" key={key}>
            <div>
              <strong>{title}</strong>
              <p className="meta">{text}</p>
            </div>
            <span className={`tag ${config?.[key] ? "configured" : ""}`}>
              {config ? (
                config[key] ? (
                  <>
                    <Check size={12} />
                    Key configured
                  </>
                ) : (
                  "No key configured"
                )
              ) : (
                "Checking…"
              )}
            </span>
          </div>
        ))}
        <a
          className="text-link"
          href="https://github.com/anishmanthena123/gapforge-ai#local-setup"
          target="_blank"
          rel="noreferrer"
        >
          Setup guide and required environment variables
          <ExternalLink size={14} />
        </a>
      </section>
      <div className="honesty-banner">
        <ShieldCheck size={22} />
        <div>
          <strong>Your research deserves clear boundaries.</strong>
          <p>
            Search questions are shared with academic providers. AI features
            send the question and selected retrieved abstracts to OpenAI. Full
            proposals should be shared only when appropriate for your research.
          </p>
        </div>
      </div>
    </>
  );
}
