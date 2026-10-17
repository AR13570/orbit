import { runSeed } from "../controls";
import { loadOdesseyCheckpoint } from "../game/progress";
import { loadGravityProgress } from "../gravity/progress";

export function readHomeProgress(search: string) {
  const result: { odessey: string | null; gravity: string | null } = {
    odessey: null,
    gravity: null,
  };
  try {
    const explicit = runSeed(search);
    const seedFor = (mode: "odessey" | "gravity") => {
      if (explicit !== undefined) return explicit >>> 0;
      const raw =
        localStorage.getItem(`orbit.${mode}.default-seed.v1`) ??
        (mode === "odessey"
          ? localStorage.getItem("orbit.zen.default-seed.v1")
          : null);
      const seed = raw === null ? NaN : Number(raw);
      return Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff
        ? seed
        : null;
    };
    const journeySeed = seedFor("odessey"),
      orbitalSeed = seedFor("gravity");
    if (journeySeed !== null) {
      const saved = loadOdesseyCheckpoint(journeySeed);
      if (saved) result.odessey = `Checkpoint ${saved.checkpointCount}`;
    }
    if (orbitalSeed !== null) {
      const raw = localStorage.getItem(
        `orbit.gravity.progress.v1:${orbitalSeed}`,
      );
      const saved = raw ? JSON.parse(raw) : null;
      if (
        saved?.version === 1 &&
        saved.seed === orbitalSeed &&
        Number.isSafeInteger(saved.currentIndex) &&
        saved.currentIndex >= 0
      )
        result.gravity = `Level ${loadGravityProgress(orbitalSeed).currentIndex + 1}`;
    }
  } catch {
    /* The menu remains playable when browser storage is unavailable. */
  }
  return result;
}
