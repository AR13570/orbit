import { usesTouchLayout } from "../controls";

/** Deliberate full-power pulls remain reachable with one thumb or a mouse. */
export function gravityPullDistance(
  pointerType: string,
  width: number,
  height: number,
  gameplayZoom = 1,
): number {
  const base =
    pointerType === "touch" || usesTouchLayout(width, height) ? 96 : 180;
  // Screen-space reach follows zoom gently without shrinking to a tiny target.
  const zoom =
    Number.isFinite(gameplayZoom) && gameplayZoom > 0 ? gameplayZoom : 1;
  return base * Math.max(0.65, Math.min(1.3, Math.sqrt(zoom)));
}

/** The same response drives the power arc, prediction, and released velocity. */
export function gravityAim<T extends { power: number }>(aim: T): T {
  const fraction = Math.max(0, Math.min(1, aim.power));
  return { ...aim, power: fraction * fraction };
}
