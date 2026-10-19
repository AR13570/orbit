import { GRAVITY_FIXED_STEP } from "./physics";
import { createState, fire, fireFrom, goalProgress, step } from "./simulation";
import {
  buildCampaignEndlessLevel,
  campaignEndlessLayoutId,
  campaignEndlessTransforms,
} from "./campaign-endless";
import { fitGravityFrame } from "./renderer";
import type { GravityLevel, GravityState } from "./types";

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
  options?: { radius?: number; flightBounds?: GravityState["flightBounds"] },
): number | null {
  const state = createState(level);
  if (options?.radius !== undefined)
    state.physics.planetRadius = options.radius;
  if (options?.flightBounds) state.flightBounds = options.flightBounds;
  let shot = 0;
  const interval =
    Number.isFinite(dt) && dt > 0
      ? Math.min(dt, GRAVITY_FIXED_STEP)
      : GRAVITY_FIXED_STEP;
  for (
    let n = 0;
    n < Math.max(90, (level.witness.at(-1)?.time ?? 0) + 60) / interval;
    n++
  ) {
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
/** Quick reachability smoke check. Sustained survival is proved offline by stable-authoring.test.ts. */
export function verifyGeneratedLevel(level: GravityLevel): boolean {
  for (const radius of [4, 16])
    if (witnessCompletionTime(level, GRAVITY_FIXED_STEP, { radius }) === null)
      return false;
  for (const [width, height] of [
    [1200, 800],
    [390, 844],
    [320, 568],
    [844, 390],
  ]) {
    const { camera, area } = fitGravityFrame(level, width, height);
    const scale = camera.scale * 0.5;
    const flightBounds = {
      x: camera.center.x - (area.x + area.width / 2) / scale,
      y: camera.center.y - (area.y + area.height / 2) / scale,
      width: width / scale,
      height: height / scale,
    };
    const radius = Math.max(4, Math.min(16, 6 / camera.scale));
    if (
      witnessCompletionTime(level, GRAVITY_FIXED_STEP, {
        radius,
        flightBounds,
      }) === null
    )
      return false;
  }
  return witnessCompletionTime(level, GRAVITY_FIXED_STEP / 2) !== null;
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
  const layoutId = campaignEndlessLayoutId(mixGravitySeed(seed, 0), index);
  // Only offline-proved geometry and populations enter play. Startup never runs
  // a numerical search or silently substitutes an easier objective.
  const random = gravityRandom(mixGravitySeed(seed, index));
  const variants = campaignEndlessTransforms(layoutId, index);
  const variant = variants[Math.floor(random() * variants.length)];
  const chosen = buildCampaignEndlessLevel(
    seed,
    index,
    layoutId,
    (variant.quarter * Math.PI) / 2,
    variant.reflected,
  );
  if (cache.size >= 96) cache.delete(cache.keys().next().value!);
  cache.set(key, structuredClone(chosen));
  return chosen;
}
