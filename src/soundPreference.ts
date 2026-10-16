import { useSyncExternalStore } from "react";

export const SOUND_MUTED_KEY = "orbit.sound-muted.v1";
const listeners = new Set<() => void>();
let sessionMuted = false;
let unwritten = false;

export function readSoundMuted(): boolean {
  if (unwritten) return sessionMuted;
  try {
    sessionMuted = localStorage.getItem(SOUND_MUTED_KEY) === "true";
  } catch {
    // Keep the latest choice when browser storage is unavailable.
  }
  return sessionMuted;
}

export function setSoundMuted(
  value: boolean | ((muted: boolean) => boolean),
): void {
  sessionMuted = typeof value === "function" ? value(readSoundMuted()) : value;
  try {
    localStorage.setItem(SOUND_MUTED_KEY, String(sessionMuted));
    unwritten = false;
  } catch {
    unwritten = true;
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const storage = (event: StorageEvent) => {
    if (event.key === SOUND_MUTED_KEY || event.key === null) {
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

/** Read during render so a saved mute applies before the soundtrack mounts. */
export function useSoundPreference() {
  const muted = useSyncExternalStore(subscribe, readSoundMuted, () => false);
  return [muted, setSoundMuted] as const;
}
