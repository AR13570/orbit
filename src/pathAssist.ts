import { useSyncExternalStore } from "react";
export type PathAssist = "partial" | "full";
export const PATH_ASSIST_KEY = "orbit.path-assist.v1";
const listeners = new Set<() => void>();
let session: PathAssist = "partial",
  unwritten = false;
export function readPathAssist(): PathAssist {
  if (unwritten) return session;
  try {
    return localStorage.getItem(PATH_ASSIST_KEY) === "full"
      ? "full"
      : "partial";
  } catch {
    return session;
  }
}
export function setPathAssist(value: PathAssist): void {
  session = value === "full" ? "full" : "partial";
  try {
    localStorage.setItem(PATH_ASSIST_KEY, session);
    unwritten = false;
  } catch {
    unwritten = true;
  }
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const storage = (event: StorageEvent) => {
    if (event.key === PATH_ASSIST_KEY || event.key === null) {
      unwritten = false;
      listener();
    }
  };
  window.addEventListener("storage", storage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", storage);
  };
}
export function usePathAssist() {
  return useSyncExternalStore(
    subscribe,
    readPathAssist,
    () => "partial" as PathAssist,
  );
}
