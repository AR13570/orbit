import { launchSpeed } from "../game/physics";
import type { Body, Vec2 } from "../game/types";

// Scale velocity and acceleration together to preserve the familiar orbit shapes.
export const GRAVITY_SPEED_SCALE = 1.8;
export const GRAVITY_FORCE_SCALE = GRAVITY_SPEED_SCALE ** 2;

export function gravityLaunchSpeed(power: number): number {
  return launchSpeed(power) * GRAVITY_SPEED_SCALE;
}

export function gravityForceAt(position: Vec2, bodies: readonly Body[]): Vec2 {
  let x = 0,
    y = 0;
  for (const body of bodies) {
    const dx = body.position.x - position.x,
      dy = body.position.y - position.y;
    const square = dx * dx + dy * dy;
    if (square < 0.000001) continue;
    // Fixed softening keeps collision size independent of gravitational strength.
    const scale =
      ((body.kind === "attractor" ? 1 : -1) * body.strength) /
      ((square + 40 * 40) * Math.sqrt(square));
    x += dx * scale;
    y += dy * scale;
  }
  const magnitude = Math.hypot(x, y);
  const scale = (magnitude > 840 ? 840 / magnitude : 1) * GRAVITY_FORCE_SCALE;
  return { x: x * scale, y: y * scale };
}
