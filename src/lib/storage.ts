import { ProjectSchema, type Project } from "./model";
export const storageKey = (owner = "guest") => `gapforge.projects.v1.${owner}`;
export function readProjects(
  storage: Pick<Storage, "getItem">,
  owner = "guest",
): Project[] {
  try {
    const raw = JSON.parse(storage.getItem(storageKey(owner)) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((value) => {
      const p = ProjectSchema.safeParse(value);
      return p.success ? [p.data] : [];
    });
  } catch {
    return [];
  }
}
export function writeProjects(
  storage: Pick<Storage, "setItem">,
  projects: Project[],
  owner = "guest",
) {
  storage.setItem(storageKey(owner), JSON.stringify(projects));
}
export function mergeProjects(local: Project[], cloud: Project[]) {
  const byId = new Map(local.map((p) => [p.id, p]));
  for (const p of cloud) {
    const old = byId.get(p.id);
    if (!old || p.updatedAt > old.updatedAt) byId.set(p.id, p);
  }
  return [...byId.values()].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}
