import { runSeed } from "../controls";
const KEY = "orbit.gravity.default-seed.v1";
let sessionSeed: number | undefined;
/** Explicit seeds stay independent; a normal visit keeps one random universe for resume. */
export function resolveGravitySeed(search: string): number {
  const explicit = runSeed(search);
  if (explicit !== undefined) return explicit;
  try {
    const stored = localStorage.getItem(KEY),
      value = stored === null ? NaN : Number(stored);
    if (Number.isInteger(value) && value >= 0 && value <= 0xffffffff)
      return value;
  } catch {
    /* Use the page seed when storage is unavailable. */
  }
  sessionSeed ??= crypto.getRandomValues(new Uint32Array(1))[0];
  try {
    localStorage.setItem(KEY, String(sessionSeed));
  } catch {
    /* Resume still works during this page visit. */
  }
  return sessionSeed;
}
