import { MAX_GRAVITY_PREDICTION_SECONDS } from "./prediction-settings";
import type { Vec2 } from "../game/types";
import type { PathAssist } from "../pathAssist";

/** Predict farther in physical time when the same flight occupies fewer CSS pixels. */
export function gravityAimPredictionSeconds(
  pathAssist: PathAssist,
  renderScale: number,
  launchSpeed: number,
  particleCount = 0,
): number {
  if (pathAssist === "full") return MAX_GRAVITY_PREDICTION_SECONDS;
  const baseline = particleCount > 64 ? 1.8 : particleCount > 24 ? 2.7 : 4.2;
  const limit = particleCount > 64 ? 4.2 : particleCount > 24 ? 7.2 : 12;
  const screenSpeed = Math.max(0, renderScale) * Math.max(0, launchSpeed);
  return Math.min(limit, Math.max(baseline, 480 / screenSpeed));
}

/** Resample the predicted polyline, keeping dots on the simulated route at CSS-pixel intervals. */
export function sampleGravityAimPreview(
  points: readonly Vec2[],
  renderScale: number,
  pathAssist: PathAssist = "partial",
): { dots: (Vec2 & { distance: number })[]; length: number } {
  const dots: (Vec2 & { distance: number })[] = [];
  if (points.length < 2 || !(renderScale > 0)) return { dots, length: 0 };
  const limit = pathAssist === "full" ? Infinity : 600;
  const segmentLengths: number[] = [];
  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    const segment =
      Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y) *
      renderScale;
    segmentLengths.push(segment);
    if (Number.isFinite(segment)) totalLength += segment;
    if (totalLength >= limit) {
      totalLength = limit;
      break;
    }
  }
  // Full assist can cover a very long flight at close zoom, so retain a bounded draw budget.
  const spacing = Math.max(12, totalLength / 180);
  let length = 0;
  let nextDot = spacing;
  for (let i = 1; i < points.length && length < limit; i++) {
    const from = points[i - 1],
      to = points[i];
    const segment = segmentLengths[i - 1];
    if (!Number.isFinite(segment) || segment <= 0) continue;
    const end = Math.min(limit, length + segment);
    while (nextDot <= end && dots.length < 180) {
      const fraction = (nextDot - length) / segment;
      dots.push({
        x: from.x + (to.x - from.x) * fraction,
        y: from.y + (to.y - from.y) * fraction,
        distance: nextDot,
      });
      nextDot += spacing;
    }
    length = end;
  }
  return { dots, length };
}
