export interface GravityProgress {
  version: 1;
  seed: number;
  currentIndex: number;
  unlockedIndex: number;
  completedIndices: number[];
}
const integer = (value: number) =>
  Number.isFinite(value)
    ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER - 1, Math.floor(value)))
    : 0;
const seedValue = (seed: number) => (Number.isFinite(seed) ? seed >>> 0 : 0);
const storageKey = (seed: number) =>
  `orbit.gravity.progress.v1:${seedValue(seed)}`;
function normalize(progress: GravityProgress): GravityProgress {
  const completedIndices = [
    ...new Set(
      (Array.isArray(progress.completedIndices)
        ? progress.completedIndices
        : []
      ).filter(
        (n) =>
          Number.isSafeInteger(n) && n >= 0 && n < Number.MAX_SAFE_INTEGER - 1,
      ),
    ),
  ].sort((a, b) => a - b);
  const currentIndex = integer(progress.currentIndex);
  return {
    version: 1,
    seed: seedValue(progress.seed),
    currentIndex,
    unlockedIndex: Math.max(
      currentIndex,
      integer(progress.unlockedIndex),
      ...completedIndices.map((n) => n + 1),
    ),
    completedIndices,
  };
}
export function loadGravityProgress(seed: number): GravityProgress {
  const empty: GravityProgress = {
    version: 1,
    seed: seedValue(seed),
    currentIndex: 0,
    unlockedIndex: 0,
    completedIndices: [],
  };
  try {
    const raw = localStorage.getItem(storageKey(seed));
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || parsed.seed !== empty.seed)
      return empty;
    return normalize(parsed);
  } catch {
    return empty;
  }
}
export function saveGravityProgress(progress: GravityProgress): void {
  try {
    const clean = normalize(progress);
    localStorage.setItem(storageKey(clean.seed), JSON.stringify(clean));
  } catch {
    /* Storage can be unavailable in private or embedded sessions. */
  }
}
export function recordGravityCompletion(
  progress: GravityProgress,
  index: number,
): GravityProgress {
  const clean = normalize(progress),
    completed = integer(index);
  return normalize({
    ...clean,
    currentIndex: completed + 1,
    completedIndices: [...clean.completedIndices, completed],
  });
}
/** Skips and free play advance the reachable index without inventing completion. */
export function setGravityCurrentIndex(
  progress: GravityProgress,
  index: number,
): GravityProgress {
  return normalize({ ...normalize(progress), currentIndex: integer(index) });
}
