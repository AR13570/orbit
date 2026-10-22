import {
  DEFAULT_PROJECTILE_SIZE,
  MAX_PROJECTILE_SIZE,
  MIN_PROJECTILE_SIZE,
  PROJECTILE_SIZE_STEP,
  normalizeProjectileSize,
} from "./projectile-size";

export const PARTICLE_INTERACTION_KEY = "orbit.gravity.particle-interaction.v1";
let session: boolean | null = null;
let unwritten = false;

/** Null leaves custom authoring rules intact until the player makes a choice. */
export function readParticleInteraction(): boolean | null {
  if (unwritten) return session;
  try {
    const value = localStorage.getItem(PARTICLE_INTERACTION_KEY);
    return value === "true" ? true : value === "false" ? false : null;
  } catch {
    return session;
  }
}
export function saveParticleInteraction(enabled: boolean): void {
  session = enabled;
  try {
    localStorage.setItem(PARTICLE_INTERACTION_KEY, String(enabled));
    unwritten = false;
  } catch {
    unwritten = true;
  }
}

export const PROJECTILE_SIZE_KEY = "orbit.gravity.projectile-size.v1";
let sessionSize = DEFAULT_PROJECTILE_SIZE;
let sizeUnwritten = false;

function sliderSize(value: number): number {
  return Number(
    (
      Math.round(normalizeProjectileSize(value) / PROJECTILE_SIZE_STEP) *
      PROJECTILE_SIZE_STEP
    ).toFixed(6),
  );
}

export function readProjectileSize(): number {
  if (sizeUnwritten) return sessionSize;
  try {
    const stored = localStorage.getItem(PROJECTILE_SIZE_KEY);
    const value = stored?.trim() ? Number(stored) : NaN;
    return Number.isFinite(value) &&
      value >= MIN_PROJECTILE_SIZE &&
      value <= MAX_PROJECTILE_SIZE
      ? sliderSize(value)
      : DEFAULT_PROJECTILE_SIZE;
  } catch {
    return sessionSize;
  }
}
export function saveProjectileSize(value: number): void {
  sessionSize = sliderSize(value);
  try {
    localStorage.setItem(PROJECTILE_SIZE_KEY, String(sessionSize));
    sizeUnwritten = false;
  } catch {
    sizeUnwritten = true;
  }
}

export const PARTICLE_GROUPING_KEY = "orbit.gravity.particle-grouping.v1";
let sessionGrouping: boolean | null = null;
let groupingUnwritten = false;
/** Null preserves custom contact rules until the player makes a choice. */
export function readParticleGrouping(): boolean | null {
  if (groupingUnwritten) return sessionGrouping;
  try {
    const value = localStorage.getItem(PARTICLE_GROUPING_KEY);
    return value === "true" ? true : value === "false" ? false : null;
  } catch {
    return sessionGrouping;
  }
}
export function saveParticleGrouping(enabled: boolean): void {
  sessionGrouping = enabled;
  try {
    localStorage.setItem(PARTICLE_GROUPING_KEY, String(enabled));
    groupingUnwritten = false;
  } catch {
    groupingUnwritten = true;
  }
}
