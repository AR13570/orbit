import { bodyStrength, distance } from "../../game/physics";
import type { Vec2 } from "../../game/types";
import { MAX_CREATOR_STRENGTH, type CreatorLevel } from "./model";

export function gravityRing(strength: number): number {
  return 90 + Math.sqrt(strength / bodyStrength(1)) * 1.25;
}
export function ringStrength(radius: number): number {
  return Math.min(
    MAX_CREATOR_STRENGTH,
    bodyStrength(Math.max(0, (radius - 90) / 1.25)),
  );
}
export function clampPosition(point: Vec2, margin: number): Vec2 {
  return {
    x: Math.round(Math.max(margin, Math.min(900 - margin, point.x))),
    y: Math.round(Math.max(margin, Math.min(900 - margin, point.y))),
  };
}
export function snapPosition(
  level: CreatorLevel,
  id: string,
  point: Vec2,
  tolerance: number,
): { position: Vec2; axes: Partial<Vec2> } {
  const margin =
    id === "launcher"
      ? 10
      : (level.bodies.find((b) => b.id === id)?.radius ?? 10);
  const position = clampPosition(point, margin),
    axes: Partial<Vec2> = {};
  const references = level.bodies
    .filter((b) => b.id !== id)
    .map((b) => b.position);
  if (id !== "launcher") references.push(level.launch);
  for (const axis of ["x", "y"] as const) {
    let nearest = tolerance;
    for (const target of references) {
      const delta = Math.abs(target[axis] - point[axis]);
      if (
        delta > nearest ||
        target[axis] < margin ||
        target[axis] > 900 - margin
      )
        continue;
      if (axes[axis] !== undefined && delta === nearest) continue;
      nearest = delta;
      position[axis] = target[axis];
      axes[axis] = target[axis];
    }
  }
  return { position, axes };
}
export function clearPosition(
  level: CreatorLevel,
  point: Vec2,
  radius: number,
): boolean {
  return (
    point.x >= radius &&
    point.y >= radius &&
    point.x <= 900 - radius &&
    point.y <= 900 - radius &&
    distance(point, level.launch) >= radius + 18 &&
    level.bodies.every(
      (b) => distance(point, b.position) >= radius + b.radius + 8,
    )
  );
}
export function nearbyPosition(
  level: CreatorLevel,
  radius: number,
  origin?: Vec2,
): Vec2 | undefined {
  if (origin)
    for (let ring = 1; ring <= 4; ring++)
      for (let n = 0; n < 8; n++) {
        const angle = (n * Math.PI) / 4,
          offset = ring * (radius * 2 + 24);
        const point = clampPosition(
          {
            x: origin.x + Math.cos(angle) * offset,
            y: origin.y + Math.sin(angle) * offset,
          },
          radius,
        );
        if (clearPosition(level, point, radius)) return point;
      }
  for (let y = 100; y <= 800; y += 100)
    for (let x = 100; x <= 800; x += 100) {
      if (clearPosition(level, { x, y }, radius)) return { x, y };
    }
}
