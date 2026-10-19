import { usesTouchLayout } from "../controls";
import type { GravityState, Vec2 } from "./types";

/** Use live well positions and the next planet's physical radius. */
export function gravityLaunchIsClear(
  position: Vec2,
  state: Pick<GravityState, "level" | "physics">,
): boolean {
  return (
    !state.physics.bodyCollisions ||
    state.level.bodies.every(
      (body) =>
        Math.hypot(position.x - body.position.x, position.y - body.position.y) >
        body.radius + state.physics.planetRadius + 1e-9,
    )
  );
}

/** Screen-space reference reach for the launch response, not a drag limit. */
export function gravityPullDistance(
  pointerType: string,
  width: number,
  height: number,
  gameplayZoom = 1,
): number {
  const base =
    pointerType === "touch" || usesTouchLayout(width, height) ? 81.6 : 153;
  // Screen-space reach follows zoom gently without shrinking to a tiny target.
  const zoom =
    Number.isFinite(gameplayZoom) && gameplayZoom > 0 ? gameplayZoom : 1;
  return base * Math.max(0.65, Math.min(1.3, Math.sqrt(zoom)));
}

/** The same response drives the power arc, prediction, and released velocity. */
export function gravityAim<T extends { power: number }>(aim: T): T {
  const fraction = Math.max(0, aim.power);
  // Keep precise low-power shots unchanged. Match the slope at the knee,
  // then add progressively less power without limiting the visible tether.
  const knee = 0.8;
  const remaining = 1 - knee * knee;
  const power =
    fraction <= knee
      ? fraction * fraction
      : 1 - remaining * Math.exp((-2 * knee * (fraction - knee)) / remaining);
  return { ...aim, power };
}

/** Recover a drag fraction for authored shots and browser playthroughs. */
export function gravityPullFraction(power: number): number {
  const bounded = Math.max(0, Math.min(1 - Number.EPSILON, power));
  const knee = 0.8;
  const remaining = 1 - knee * knee;
  return bounded <= knee * knee
    ? Math.sqrt(bounded)
    : knee - (remaining / (2 * knee)) * Math.log((1 - bounded) / remaining);
}
