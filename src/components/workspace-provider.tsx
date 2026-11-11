"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { type Project, ProjectSchema } from "@/lib/model";
import { readProjects, writeProjects, mergeProjects } from "@/lib/storage";
import { browserSupabase } from "@/lib/supabase/client";
type Context = {
  projects: Project[];
  ready: boolean;
  email: string | null;
  save: (p: Project) => void;
  remove: (id: string) => void;
  sync: (p: Project) => Promise<void>;
  notice: (message: string) => void;
  refreshAuth: () => Promise<void>;
  lastId: string | null;
  importGuestProjects: () => void;
};
const Workspace = createContext<Context | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [lastId, setLastId] = useState<string | null>(null);
  const owner = useRef("guest");
  const authRevision = useRef(0);
  const notice = useCallback((message: string) => setToast(message), []);
  const refreshAuth = useCallback(async () => {
    const revision = ++authRevision.current;
    const db = browserSupabase();
    if (!db) {
      setEmail(null);
      return;
    }
    const { data } = await db.auth.getUser();
    if (revision !== authRevision.current) return;
    const nextOwner = data.user?.id ?? "guest";
    const changed = nextOwner !== owner.current;
    owner.current = nextOwner;
    if (changed) {
      setProjects(readProjects(localStorage, nextOwner));
      setLastId(localStorage.getItem(`gapforge.lastId.${nextOwner}`));
    }
    setEmail(data.user?.email ?? null);
    if (data.user) {
      try {
        const res = await fetch("/api/projects");
        const body = await res.json();
        if (!res.ok) throw new Error(body.error);
        const cloud = (body.projects as unknown[]).map((p) =>
          ProjectSchema.parse(p),
        );
        if (revision !== authRevision.current || owner.current !== nextOwner)
          return;
        setProjects((old) => {
          const merged = mergeProjects(
            changed ? readProjects(localStorage, nextOwner) : old,
            cloud,
          );
          try {
            writeProjects(localStorage, merged, nextOwner);
          } catch {
            notice("Cloud loaded, but local storage is full.");
          }
          return merged;
        });
      } catch (error) {
        if (revision !== authRevision.current) return;
        notice(
          `Cloud load failed: ${error instanceof Error ? error.message : "Unknown error"}. Local projects remain available.`,
        );
      }
    }
  }, [notice]);
  useEffect(() => {
    setProjects(readProjects(localStorage));
    setLastId(localStorage.getItem("gapforge.lastId.guest"));
    setReady(true);
    void refreshAuth();
    const db = browserSupabase();
    const { data } = db?.auth.onAuthStateChange(() => {
      setTimeout(() => void refreshAuth(), 0);
    }) ?? { data: null };
    return () => data?.subscription.unsubscribe();
  }, [refreshAuth]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 7000);
    return () => clearTimeout(timer);
  }, [toast]);
  const save = useCallback(
    (p: Project) => {
      const updated = { ...p, updatedAt: new Date().toISOString() };
      setProjects((old) => {
        const next = [updated, ...old.filter((x) => x.id !== p.id)];
        try {
          writeProjects(localStorage, next, owner.current);
          localStorage.setItem(`gapforge.lastId.${owner.current}`, p.id);
        } catch {
          notice(
            "Local storage could not save this project. Export a report to preserve your work.",
          );
        }
        return next;
      });
      setLastId(p.id);
    },
    [notice],
  );
  const sync = useCallback(
    async (p: Project) => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Cloud save failed.");
      notice("Project saved to your Supabase account.");
    },
    [notice],
  );
  const remove = useCallback(
    (id: string) => {
      setProjects((old) => {
        const next = old.filter((p) => p.id !== id);
        try {
          writeProjects(localStorage, next, owner.current);
        } catch {
          notice("Could not update local storage.");
        }
        return next;
      });
      notice(
        "Removed from this browser. Cloud copies, if any, remain in Supabase.",
      );
    },
    [notice],
  );
  const importGuestProjects = useCallback(() => {
    if (owner.current === "guest") return;
    const guest = readProjects(localStorage);
    setProjects((old) => {
      const next = mergeProjects(old, guest);
      writeProjects(localStorage, next, owner.current);
      return next;
    });
    notice(
      `Copied ${guest.length} guest projects into this local account workspace. Choose Save to cloud in a project to upload it.`,
    );
  }, [notice]);
  return (
    <Workspace.Provider
      value={{
        projects,
        ready,
        email,
        save,
        remove,
        sync,
        notice,
        refreshAuth,
        lastId,
        importGuestProjects,
      }}
    >
      {children}
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            ×
          </button>
        </div>
      )}
    </Workspace.Provider>
  );
}
export function useWorkspace() {
  const context = useContext(Workspace);
  if (!context) throw new Error("Workspace provider missing.");
  return context;
}
