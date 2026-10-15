import type { Vec2 } from "../game/types";
import type { GravityLevel, GravityWellMotion } from "./types";
function phaseAt(
  motion: GravityWellMotion,
  time: number,
): { angle: number; rate: number } {
  const rate =
    Number.isFinite(motion.period) && motion.period > 0
      ? (Math.PI * 2) / motion.period
      : 0;
  return { angle: (motion.phase ?? 0) + time * rate, rate };
}
export function wellVelocity(
  level: GravityLevel,
  bodyId: string,
  time: number,
): Vec2 {
  const motion = level.motions?.find((m) => m.bodyId === bodyId);
  if (!motion) return { x: 0, y: 0 };
  const { angle, rate } = phaseAt(motion, time);
  return motion.kind === "circle"
    ? {
        x: -Math.sin(angle) * (motion.radius ?? 0) * rate,
        y: Math.cos(angle) * (motion.radius ?? 0) * rate,
      }
    : {
        x: Math.cos(angle) * (motion.amplitude?.x ?? 0) * rate,
        y: Math.cos(angle) * (motion.amplitude?.y ?? 0) * rate,
      };
}
/** Positions are derived from immutable centers and absolute physical time. */
export function moveWells(level: GravityLevel, time: number): void {
  for (const motion of level.motions ?? []) {
    const body = level.bodies.find((b) => b.id === motion.bodyId);
    if (!body) continue;
    const { angle } = phaseAt(motion, time);
    body.position =
      motion.kind === "circle"
        ? {
            x: motion.center.x + Math.cos(angle) * (motion.radius ?? 0),
            y: motion.center.y + Math.sin(angle) * (motion.radius ?? 0),
          }
        : {
            x: motion.center.x + Math.sin(angle) * (motion.amplitude?.x ?? 0),
            y: motion.center.y + Math.sin(angle) * (motion.amplitude?.y ?? 0),
          };
  }
}
