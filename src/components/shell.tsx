"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Plus,
  LayoutDashboard,
  FolderOpen,
  Library,
  Network,
  Bookmark,
  Settings,
  Sun,
  Moon,
  Menu,
  ArrowUpRight,
  Command,
} from "lucide-react";
import { Logo } from "./logo";
import { useWorkspace } from "./workspace-provider";
export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    const value = localStorage.getItem("gapforge.theme") === "light";
    setLight(value);
    document.documentElement.dataset.theme = value ? "light" : "dark";
  }, []);
  return (
    <button
      className="icon-button"
      aria-label={light ? "Use dark theme" : "Use light theme"}
      onClick={() => {
        const next = !light;
        setLight(next);
        document.documentElement.dataset.theme = next ? "light" : "dark";
        localStorage.setItem("gapforge.theme", next ? "light" : "dark");
      }}
    >
      {light ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  );
}
export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { email, lastId } = useWorkspace();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function shortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        router.push("/research/new");
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [router]);
  const links = [
    ["Dashboard", "/dashboard", LayoutDashboard],
    ["My Projects", "/projects", FolderOpen],
    ["Paper Library", "/papers", Library],
    ["Research Map", lastId ? `/research/${lastId}/map` : "/map", Network],
    ["Saved Gaps", "/gaps", Bookmark],
  ] as const;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <Logo />
        <Link
          href="/research/new"
          className="button primary sidebar-new"
          onClick={() => setOpen(false)}
        >
          <Plus size={18} />
          New Research<span className="shortcut">⌘ K</span>
        </Link>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {links.map(([label, url, Icon]) => (
            <Link
              className={`nav-link ${path === url ? "active" : ""}`}
              key={label}
              href={url}
              onClick={() => setOpen(false)}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="evidence-note">
            <div className="tiny-node" />
            <strong>Evidence before confidence.</strong>
            <p>A good question deserves a skeptical second look.</p>
            <Link href="/research/new">
              Start exploring <ArrowUpRight size={14} />
            </Link>
          </div>
          <Link
            className={`nav-link ${path === "/settings" ? "active" : ""}`}
            href="/settings"
          >
            <Settings size={18} />
            Settings
          </Link>
          <div className="profile">
            <div className="avatar">{email ? email[0].toUpperCase() : "G"}</div>
            <div>
              <strong>{email ?? "Guest researcher"}</strong>
              <small>
                {email
                  ? "Local cache · explicit cloud save"
                  : "Local browser storage"}
              </small>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </aside>
      {open && (
        <button
          aria-label="Close navigation"
          className="scrim"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <span>/</span>
            <strong>
              {path.includes("/research/")
                ? "Research"
                : path === "/settings"
                  ? "Settings"
                  : path === "/papers"
                    ? "Paper library"
                    : "Overview"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="status-dot" />
            Evidence-grounded research
            <Link
              href="/research/new"
              className="icon-button"
              aria-label="New research keyboard shortcut"
            >
              <Command size={16} />
            </Link>
          </div>
        </header>
        <main id="main-content" className="workspace-content">
          {children}
        </main>
        <footer className="workspace-footer">
          GAPFORGE AI{" "}
          <span>
            Explore the literature. Challenge the idea. Discover what comes
            next.
          </span>
          <span>Abstract-level evidence · provisional conclusions</span>
        </footer>
      </div>
    </div>
  );
}
