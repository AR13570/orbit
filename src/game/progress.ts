import { runSeed } from "../controls";
import { RECENT_LAYOUT_LIMIT, type CompositionDescriptor } from "./composition";
import { STRUCTURES } from "./structures";
import type { Sector, Vec2 } from "./types";

/** Static course state only. A dock resumes at the following launcher once. */
export interface ZenCheckpoint {
  version: 1;
  seed: number;
  checkpointCount: number;
  pendingAdvance: boolean;
  sector: Sector;
  recentLayouts: CompositionDescriptor[];
}
const DEFAULT_SEED_KEY = "orbit.zen.default-seed.v1";
const MAX_RECORD_LENGTH = 1_000_000;
const storageKey = (seed: number) => `orbit.zen.progress.v1:${seed >>> 0}`;
let sessionSeed: number | undefined;
const finite = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 1e12;
const positive = (n: unknown) => finite(n) && n > 0;
const point = (p: Vec2) => p && finite(p.x) && finite(p.y);
const family = (value: unknown) =>
  STRUCTURES.some((entry) => entry.id === value);
const kind = (value: unknown) => value === "attractor" || value === "repellent";
const scale = (value: unknown) => value === undefined || positive(value);

/** Storage is untrusted; validate bounded geometry before handing it to physics. */
export function validZenCheckpoint(
  value: unknown,
  seed: number,
): value is ZenCheckpoint {
  try {
    const p = value as ZenCheckpoint,
      s = p.sector;
    return (
      p.version === 1 &&
      p.seed === seed >>> 0 &&
      s.seed === p.seed &&
      Number.isSafeInteger(s.index) &&
      s.index >= 0 &&
      s.index < Number.MAX_SAFE_INTEGER - 2 &&
      typeof p.pendingAdvance === "boolean" &&
      p.checkpointCount === s.index + Number(p.pendingAdvance) &&
      positive(s.width) &&
      positive(s.height) &&
      point(s.bounds) &&
      positive(s.bounds.width) &&
      positive(s.bounds.height) &&
      point(s.launch) &&
      point(s.checkpoint.position) &&
      positive(s.checkpoint.radius) &&
      scale(s.checkpoint.gravityScale) &&
      family(s.generation.family) &&
      typeof s.generation.fallback === "boolean" &&
      (s.generation.validation === undefined ||
        ["sampled", "geometric"].includes(s.generation.validation)) &&
      (s.generation.difficulty === undefined ||
        finite(s.generation.difficulty)) &&
      Array.isArray(s.bodies) &&
      s.bodies.length > 0 &&
      s.bodies.length <= 64 &&
      s.bodies.every(
        (b) =>
          typeof b.id === "string" &&
          b.id.length <= 200 &&
          kind(b.kind) &&
          point(b.position) &&
          positive(b.radius) &&
          finite(b.strength) &&
          scale(b.gravityScale),
      ) &&
      finite(s.solution.angle) &&
      finite(s.solution.power) &&
      s.solution.power >= 0 &&
      s.solution.power <= 1 &&
      positive(s.solution.speed) &&
      positive(s.solution.flightSeconds) &&
      Array.isArray(s.solution.path) &&
      s.solution.path.length > 0 &&
      s.solution.path.length <= 4096 &&
      s.solution.path.every(point) &&
      Array.isArray(p.recentLayouts) &&
      p.recentLayouts.length > 0 &&
      p.recentLayouts.length <= RECENT_LAYOUT_LIMIT &&
      p.recentLayouts.every(
        (d) =>
          (d.family === undefined || family(d.family)) &&
          Array.isArray(d.goal) &&
          d.goal.length === 2 &&
          d.goal.every(finite) &&
          Array.isArray(d.bodies) &&
          d.bodies.length > 0 &&
          d.bodies.length <= 64 &&
          d.bodies.every(
            (b) =>
              finite(b.x) && finite(b.y) && positive(b.size) && kind(b.kind),
          ),
      )
    );
  } catch {
    return false;
  }
}
export function loadZenCheckpoint(seed: number): ZenCheckpoint | null {
  try {
    const raw = localStorage.getItem(storageKey(seed));
    if (!raw || raw.length > MAX_RECORD_LENGTH) return null;
    const parsed: unknown = JSON.parse(raw);
    return validZenCheckpoint(parsed, seed) ? parsed : null;
  } catch {
    return null;
  }
}
export function saveZenCheckpoint(checkpoint: ZenCheckpoint): void {
  try {
    if (!validZenCheckpoint(checkpoint, checkpoint.seed)) return;
    const raw = JSON.stringify(checkpoint);
    if (raw.length <= MAX_RECORD_LENGTH)
      localStorage.setItem(storageKey(checkpoint.seed), raw);
  } catch {
    /* Browser storage can be disabled or full. */
  }
}
export function resolveZenSeed(search: string): number {
  const explicit = runSeed(search);
  if (explicit !== undefined) return explicit >>> 0;
  try {
    const stored = localStorage.getItem(DEFAULT_SEED_KEY),
      value = stored === null ? NaN : Number(stored);
    if (Number.isInteger(value) && value >= 0 && value <= 0xffffffff)
      return value;
  } catch {
    /* Keep the same seed during this page visit. */
  }
  sessionSeed ??= crypto.getRandomValues(new Uint32Array(1))[0];
  try {
    localStorage.setItem(DEFAULT_SEED_KEY, String(sessionSeed));
  } catch {
    /* Storage unavailable. */
  }
  return sessionSeed;
}

/** Only ordinary unseeded journeys update this pointer; explicit links stay independent. */
export function rememberZenSeed(seed: number): void {
  sessionSeed = seed >>> 0;
  try {
    localStorage.setItem(DEFAULT_SEED_KEY, String(sessionSeed));
  } catch {
    /* Storage unavailable. */
  }
}
