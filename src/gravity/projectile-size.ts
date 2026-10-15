export const MIN_PROJECTILE_SIZE = 1;
export const MAX_PROJECTILE_SIZE = 2;
export const PROJECTILE_SIZE_STEP = 0.01;
export const DEFAULT_PROJECTILE_SIZE = 1;

export function normalizeProjectileSize(factor: number): number {
  return Number.isFinite(factor)
    ? Math.max(MIN_PROJECTILE_SIZE, Math.min(MAX_PROJECTILE_SIZE, factor))
    : DEFAULT_PROJECTILE_SIZE;
}

/** Constant area density: doubling radius gives a planet four times the mass. */
export function projectileProfile(
  baseRadius: number,
  baseMass: number,
  factor: number,
): { radius: number; mass: number } {
  const size = normalizeProjectileSize(factor);
  return { radius: baseRadius * size, mass: baseMass * size * size };
}
