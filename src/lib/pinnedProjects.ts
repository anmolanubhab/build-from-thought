// path: src/lib/pinnedProjects.ts
//
// Lightweight, per-browser "pin" state for project cards. There's no
// `is_pinned` column on `projects` — pinning here is a personal, device-local
// affordance rather than shared workspace state — so this is intentionally
// just a localStorage-backed set of project ids instead of a schema change.
const STORAGE_KEY = "webdevsai:pinned-projects";

function readPinnedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writePinnedIds(ids: Set<string>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Storage unavailable (private browsing, quota) — pinning just won't persist.
  }
}

export function isProjectPinned(projectId: string): boolean {
  return readPinnedIds().has(projectId);
}

/** Toggles pin state for a project and returns the new state. */
export function toggleProjectPinned(projectId: string): boolean {
  const ids = readPinnedIds();
  const next = !ids.has(projectId);
  if (next) ids.add(projectId); else ids.delete(projectId);
  writePinnedIds(ids);
  return next;
}
