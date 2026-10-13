import { bodyStrength, distance, FIXED_STEP } from "../game/physics";
import {
  gravityForceAt,
  gravityLaunchSpeed,
  GRAVITY_SPEED_SCALE,
} from "./physics";
import type { Aim, Body, Vec2 } from "../game/types";
import { createState, fire, goalProgress, step } from "./simulation";
import type { GravityLevel, PuzzleFamily, WitnessShot } from "./types";
const TAU = Math.PI * 2;
const families: PuzzleFamily[] = ["loop", "crowd", "counter", "paired", "tour"];
function random(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function mix(seed: number, index: number) {
  let n = (seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x21f0aaad);
  return (n ^ (n >>> 15)) >>> 0;
}
function point(center: Vec2, angle: number, radius: number): Vec2 {
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  };
}
function body(
  id: string,
  position: Vec2,
  radius: number,
  kind: "attractor" | "repellent" = "attractor",
): Body {
  return { id, position, radius, kind, strength: bodyStrength(radius) };
}
function circularAim(level: GravityLevel, center: Vec2): Aim {
  const dx = center.x - level.launch.x,
    dy = center.y - level.launch.y,
    d = Math.hypot(dx, dy),
    force = gravityForceAt(level.launch, level.bodies);
  const inward = Math.max(1, (force.x * dx + force.y * dy) / d);
  return {
    angle: Math.atan2(dy, dx) + Math.PI / 2,
    power: Math.sqrt(inward * d) / gravityLaunchSpeed(1),
  };
}
/** Uses the actual physics and objective, never a geometric promise. */
export function witnessCompletionTime(level: GravityLevel): number | null {
  const state = createState(level);
  let shot = 0;
  for (let n = 0; n < 85 / FIXED_STEP; n++) {
    while (
      shot < level.witness.length &&
      level.witness[shot].time <= state.elapsed + 1e-8
    ) {
      fire(state, level.witness[shot]);
      shot++;
    }
    step(state, FIXED_STEP);
    if (goalProgress(state).complete) return state.elapsed;
    if (shot === level.witness.length && state.particles.every((p) => !p.alive))
      return null;
  }
  return null;
}
export function verifyLevel(level: GravityLevel): boolean {
  return witnessCompletionTime(level) !== null;
}

function findLocalAim(level: GravityLevel, target: Body): WitnessShot | null {
  const base = circularAim({ ...level, bodies: [target] }, target.position);
  // Search elliptical entries as well as tangents when a neighboring well perturbs capture.
  for (const factor of [1.1, 1, 0.85, 1.25, 0.72])
    for (const offset of [-0.7, 0.7, 0, -0.4, 0.4, -0.2, 0.2]) {
      const aim = { angle: base.angle + offset, power: base.power * factor },
        state = createState(level);
      fire(state, aim);
      let qualified = 0,
        firstLoop = 0;
      for (let n = 0; n < 55 / FIXED_STEP; n++) {
        step(state, FIXED_STEP);
        const p = state.particles[0];
        if (!p?.alive) break;
        if (Math.abs(p.orbits[target.id]?.localWinding ?? 0) >= TAU) {
          if (!qualified) firstLoop = state.elapsed;
          qualified += FIXED_STEP;
          if (qualified >= 3) return { ...aim, time: firstLoop };
        } else qualified = 0;
      }
    }
  return null;
}
function candidate(
  seed: number,
  index: number,
  family: PuzzleFamily,
  attempt: number,
): GravityLevel {
  const rand = random(mix(seed, index) + attempt * 977),
    rotation = rand() * TAU;
  const center = { x: 250 + rand() * 400, y: 250 + rand() * 400 },
    radius = 36 + rand() * 12,
    d = 155 + rand() * 45;
  const level: GravityLevel = {
    index,
    seed: mix(seed, index),
    family,
    bounds: { x: 0, y: 0, width: 900, height: 900 },
    launch: point(center, rotation, d),
    bodies: [body("a", center, radius)],
    objective: { kind: family, count: 1, turns: 1, hold: 0 },
    witness: [],
  };
  if (family === "paired") {
    // A common launch below two separated wells leaves room for local elliptical captures.
    const separation = 125 + rand() * 10;
    const drop = 45 + rand() * 10;
    const localRadius = 26 + rand() * 4;
    level.launch = point(center, rotation + Math.PI / 2, drop);
    level.bodies = [
      body("a", point(center, rotation + Math.PI, separation), localRadius),
      body("b", point(center, rotation, separation), localRadius),
    ];
    level.objective = { kind: family, count: 2, turns: 1, hold: 1 };
    const a = findLocalAim(level, level.bodies[0]);
    if (a)
      level.witness = [
        { ...a, time: 0 },
        {
          ...a,
          angle: Math.PI + 2 * rotation - a.angle,
          time: 2.4 / GRAVITY_SPEED_SCALE,
        },
      ];
    return level;
  }
  if (family === "tour") {
    const separation = 75 + rand() * 25,
      r = 28 + rand() * 5;
    level.bodies = [
      body("a", point(center, rotation + Math.PI / 2, separation / 2), r),
      body("b", point(center, rotation - Math.PI / 2, separation / 2), r),
    ];
    level.launch = point(center, rotation, 225 + rand() * 20);
  }
  const aim = circularAim(level, center);
  if (family === "crowd") {
    const count = index < 8 ? 2 : 3 + Number(index > 45);
    level.objective = {
      kind: family,
      count,
      turns: 1,
      hold: 1 + Number(index > 35),
    };
    level.witness = Array.from({ length: count }, (_, n) => ({
      ...aim,
      time: (n * 2.4) / GRAVITY_SPEED_SCALE,
    }));
  } else if (family === "counter") {
    level.objective = { kind: family, count: 2, turns: 1, hold: 1 };
    level.witness = [
      { ...aim, time: 0 },
      { ...aim, angle: aim.angle + Math.PI, time: 2.5 / GRAVITY_SPEED_SCALE },
    ];
  } else {
    level.objective.turns = family === "loop" && index > 20 ? 2 : 1;
    level.witness = [{ ...aim, time: 0 }];
  }
  return level;
}
const cache = new Map<string, GravityLevel>();
export function generateGravityLevel(
  seed: number,
  index: number,
): GravityLevel {
  seed = seed >>> 0;
  index = Math.max(0, Math.floor(Number.isFinite(index) ? index : 0));
  const key = `${seed}:${index}`;
  const cached = cache.get(key);
  if (cached) return structuredClone(cached);
  const shuffled = (block: number): PuzzleFamily[] => {
    const order = [...families],
      rand = random(mix(seed ^ 0xa17f, block));
    for (let n = order.length - 1; n > 0; n--) {
      const other = Math.floor(rand() * (n + 1));
      [order[n], order[other]] = [order[other], order[n]];
    }
    return order;
  };
  const block = Math.floor(index / families.length),
    order = shuffled(block);
  const previousLast = block > 0 ? shuffled(block - 1).at(-1) : undefined;
  if (order[0] === previousLast) [order[0], order[1]] = [order[1], order[0]];
  const family = order[index % families.length];
  let chosen: GravityLevel | null = null;
  for (let attempt = 0; attempt < 24; attempt++) {
    const level = candidate(seed, index, family, attempt);
    if (level.witness.length && verifyLevel(level)) {
      chosen = level;
      break;
    }
  }
  if (!chosen)
    throw new Error(`Could not validate Gravity family ${family} at ${index}`);
  // Add an obstacle only when it measurably delays this puzzle's verified solution.
  let solutionTime = witnessCompletionTime(chosen)!;
  const decoration = random(mix(seed, index) ^ 0xa53a);
  const obstacleCount = Math.floor(decoration() * 3);
  for (let n = 0; n < obstacleCount; n++) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const attractors = chosen.bodies.filter((b) => b.kind === "attractor"),
        anchor = attractors[Math.floor(decoration() * attractors.length)],
        angle = decoration() * TAU,
        radialDistance = 100 + decoration() * 190,
        radius = 18 + decoration() * 7,
        position = {
          x: anchor.position.x + Math.cos(angle) * radialDistance,
          y: anchor.position.y + Math.sin(angle) * radialDistance,
        };
      if (
        position.x < 30 ||
        position.y < 30 ||
        position.x > 870 ||
        position.y > 870 ||
        distance(position, chosen.launch) <= radius + 35 ||
        chosen.bodies.some(
          (b) => distance(position, b.position) < radius + b.radius + 18,
        )
      )
        continue;
      const decorated: GravityLevel = {
        ...chosen,
        bodies: [
          ...chosen.bodies,
          body(`repeller-${n}`, position, radius, "repellent"),
        ],
      };
      const delayedTime = witnessCompletionTime(decorated);
      if (delayedTime !== null && delayedTime >= solutionTime + 0.5) {
        chosen = decorated;
        solutionTime = delayedTime;
        break;
      }
    }
  }
  if (cache.size >= 96) cache.delete(cache.keys().next().value!);
  cache.set(key, structuredClone(chosen));
  return chosen;
}
