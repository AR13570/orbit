import { GRAVITY_FIXED_STEP } from "./physics";
import { createState, fire, fireFrom, goalProgress, step } from "./simulation";
import { buildEndlessGravityLevel, endlessLayoutId } from "./endless";
import type { GravityLevel } from "./types";

export const normalizeGravitySeed = (seed: number) =>
  Number.isFinite(seed) ? seed >>> 0 : 0;
export const normalizeGravityIndex = (index: number) =>
  Number.isFinite(index)
    ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER - 1, Math.floor(index)))
    : 0;
export function gravityRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function mixGravitySeed(seed: number, index: number): number {
  let n = (seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x21f0aaad);
  return (n ^ (n >>> 15)) >>> 0;
}
/** Replays hidden authoring evidence in physical seconds using the actual simulation. */
export function witnessCompletionTime(
  level: GravityLevel,
  dt = GRAVITY_FIXED_STEP,
): number | null {
  const state = createState(level);
  let shot = 0;
  const interval =
    Number.isFinite(dt) && dt > 0
      ? Math.min(dt, GRAVITY_FIXED_STEP)
      : GRAVITY_FIXED_STEP;
  for (let n = 0; n < 30 / interval; n++) {
    while (
      shot < level.witness.length &&
      level.witness[shot].time <= state.elapsed + 1e-8
    ) {
      const witness = level.witness[shot++];
      if (witness.position && witness.velocity)
        fireFrom(state, witness.position, witness.velocity);
      else fire(state, witness);
    }
    step(state, interval);
    if (goalProgress(state).complete) return state.elapsed;
    if (shot === level.witness.length && state.particles.every((p) => !p.alive))
      return null;
  }
  return null;
}
export function verifyLevel(level: GravityLevel): boolean {
  return witnessCompletionTime(level) !== null;
}
const cache = new Map<string, GravityLevel>();
/** Seeded formations vary while the objective effort grows with global progress. */
export function generateGravityLevel(
  seed: number,
  index: number,
): GravityLevel {
  seed = normalizeGravitySeed(seed);
  index = normalizeGravityIndex(index);
  const key = `${seed}:${index}`,
    cached = cache.get(key);
  if (cached) return structuredClone(cached);
  const random = gravityRandom(mixGravitySeed(seed, index));
  const layoutId = endlessLayoutId(mixGravitySeed(seed, 0), index);
  let chosen = buildEndlessGravityLevel(
    seed,
    index,
    layoutId,
    random() * Math.PI * 2,
  );
  // A failed orientation retries the same formation and exact difficulty at its verified orientation.
  if (!verifyLevel(chosen)) {
    chosen = buildEndlessGravityLevel(seed, index, layoutId, 0);
    if (!verifyLevel(chosen))
      throw new Error(
        `Authored endless Gravity fixture no longer validates: ${layoutId}`,
      );
  }
  if (cache.size >= 96) cache.delete(cache.keys().next().value!);
  cache.set(key, structuredClone(chosen));
  return chosen;
}
