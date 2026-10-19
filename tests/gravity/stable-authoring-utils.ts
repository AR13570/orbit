import {
  createState,
  fireFrom,
  step,
  goalProgress,
} from "../../src/gravity/simulation";
import { gravityForceAt, gravityLaunchPower } from "../../src/gravity/physics";
import { fitGravityFrame } from "../../src/gravity/renderer";
import type {
  GravityLevel,
  WitnessShot,
  WorldBounds,
} from "../../src/gravity/types";
export interface ProofScenario {
  name: string;
  radius: number;
  mass: number;
  delay?: number;
  angle?: number;
  power?: number;
  position?: number;
  flightBounds?: WorldBounds;
  dt?: number;
  postCompletionSeconds?: number;
  postCompletionLaps?: number;
}
export interface StableProof {
  ok: boolean;
  reason?: string;
  completion: number | null;
  duration: number;
  minimumLaps: number;
  maximumDistance: number;
  minimumClearance: number;
}
export function stableProof(
  level: GravityLevel,
  shots: WitnessShot[],
  scenario: ProofScenario,
): StableProof {
  const s = createState(level);
  s.physics.planetMass = scenario.mass;
  s.physics.planetRadius = scenario.radius;
  s.flightBounds = scenario.flightBounds;
  let next = 0,
    completion: number | null = null,
    maximumDistance = 0,
    minimumClearance = Infinity,
    minimumLaps = 0;
  const dt = scenario.dt ?? 1 / 120;
  let baseline: Record<string, number> = {};
  const result = (ok: boolean, reason?: string): StableProof => ({
    ok,
    reason,
    completion,
    duration: s.elapsed,
    minimumLaps,
    maximumDistance,
    minimumClearance,
  });
  const centers = level.bodies.filter((b) => b.kind === "attractor");
  for (let n = 0; n < 360 / dt; n++) {
    while (
      next < shots.length &&
      shots[next].time + next * (scenario.delay ?? 0) <= s.elapsed + 1e-8
    ) {
      const w = shots[next++],
        a = (scenario.angle ?? 0) * (next % 2 ? 1 : -1),
        v = w.velocity!,
        power = 1 + (scenario.power ?? 0) * (next % 2 ? 1 : -1);
      fireFrom(
        s,
        {
          x: w.position!.x + (scenario.position ?? 0),
          y: w.position!.y - (scenario.position ?? 0),
        },
        {
          x: (v.x * Math.cos(a) - v.y * Math.sin(a)) * power,
          y: (v.x * Math.sin(a) + v.y * Math.cos(a)) * power,
        },
      );
    }
    step(s, dt);
    if (n % 12 !== 0) continue;
    if (goalProgress(s).complete && completion === null) {
      completion = s.elapsed;
      baseline = Object.fromEntries(
        s.particles.flatMap((p) =>
          Object.entries(p.orbits).map(([id, o]) => [
            `${p.id}:${id}`,
            level.sharedOrbit ? o.winding : o.localWinding,
          ]),
        ),
      );
    }
    if (s.particles.some((p) => !p.alive)) return result(false, "planet lost");
    for (const p of s.particles) {
      const d = Math.min(
        ...centers.map((b) =>
          Math.hypot(p.position.x - b.position.x, p.position.y - b.position.y),
        ),
      );
      maximumDistance = Math.max(maximumDistance, d);
      for (const b of level.bodies)
        minimumClearance = Math.min(
          minimumClearance,
          Math.hypot(p.position.x - b.position.x, p.position.y - b.position.y) -
            b.radius -
            p.radius,
        );
      if (d > level.orbitPadding! * 3)
        return result(false, "left authored orbital region");
    }
    if (
      next === shots.length &&
      completion === null &&
      s.elapsed >
        (shots.at(-1)?.time ?? 0) +
          (shots.length - 1) * (scenario.delay ?? 0) +
          60
    )
      return result(false, "no complete two-orbit objective");
    if (next !== shots.length || completion === null) continue;
    minimumLaps = Math.min(
      ...s.particles.map((p) =>
        level.sharedOrbit
          ? Math.min(
              ...level.sharedOrbit.map(
                (id) =>
                  Math.abs(
                    p.orbits[id].winding - (baseline[`${p.id}:${id}`] ?? 0),
                  ) /
                  (2 * Math.PI),
              ),
            )
          : Math.max(
              ...centers.map(
                (b) =>
                  Math.abs(
                    p.orbits[b.id].localWinding -
                      (baseline[`${p.id}:${b.id}`] ?? 0),
                  ) /
                  (2 * Math.PI),
              ),
            ),
      ),
    );
    if (
      s.elapsed - completion >= (scenario.postCompletionSeconds ?? 120) &&
      minimumLaps >= (scenario.postCompletionLaps ?? 10)
    )
      return result(
        goalProgress(s).complete,
        goalProgress(s).complete ? undefined : "objective no longer satisfied",
      );
  }
  return result(false, "proof horizon exhausted");
}
export function proofScenarios(level: GravityLevel): ProofScenario[] {
  const scenarios: ProofScenario[] = [
    { name: "default", radius: 6, mass: 1 },
    { name: "small", radius: 4, mass: 1 },
    { name: "small-maximum", radius: 8, mass: 4 },
    { name: "maximum", radius: 32, mass: 4 },
    { name: "thinking", radius: 32, mass: 4, delay: 3 },
    {
      name: "aim-plus",
      radius: 32,
      mass: 4,
      angle: 0.01,
      power: 0.01,
      position: 1,
    },
    {
      name: "aim-minus-paused",
      radius: 32,
      mass: 4,
      angle: -0.01,
      power: -0.01,
      position: -1,
      delay: 5,
    },
  ];
  // Keep timing tolerance independent from aim tolerance. Combining them can
  // accidentally move a dangerous encounter out of the tested release phase.
  for (const [radius, mass] of [
    [4, 1],
    [6, 1],
    [8, 4],
    [32, 4],
  ])
    for (const delay of [3, 5]) {
      if (radius === 32 && delay === 3) continue;
      scenarios.push({
        name: `thinking-${delay}-radius-${radius}`,
        radius,
        mass,
        delay,
        postCompletionSeconds: 3,
        postCompletionLaps: 0,
      });
    }
  for (const [width, height] of [
    [1200, 800],
    [390, 844],
    [320, 568],
    [844, 390],
  ]) {
    const { camera, area } = fitGravityFrame(level, width, height);
    const scale = camera.scale * 0.5;
    const flightBounds = {
      x: camera.center.x - (area.x + area.width / 2) / scale,
      y: camera.center.y - (area.y + area.height / 2) / scale,
      width: width / scale,
      height: height / scale,
    };
    const base = Math.max(4, Math.min(16, 6 / camera.scale));
    for (const factor of [1, 2])
      scenarios.push({
        name: `viewport-${width}x${height}-size-${factor}`,
        radius: base * factor,
        mass: factor * factor,
        flightBounds,
      });
  }
  return scenarios;
}
export function candidateShots(
  level: GravityLevel,
  radius: number,
  phase: number,
  spacing = 6,
  speedFactor = 1,
  outerRadius?: number,
): WitnessShot[] {
  const groups = level.sharedOrbit
    ? [{ bodyId: "shared", count: level.objective.count }]
    : level.requirements!;
  const shots: WitnessShot[] = [];
  for (const g of groups) {
    const cores =
      g.bodyId === "shared"
        ? level.bodies.filter((b) => b.kind === "attractor")
        : level.bodies.filter((b) => b.id === g.bodyId);
    const center = {
      x: cores.reduce((s, b) => s + b.position.x, 0) / cores.length,
      y: cores.reduce((s, b) => s + b.position.y, 0) / cores.length,
    };
    for (let i = 0; i < g.count; i++) {
      const baseRadius = radius;
      if (outerRadius && i >= Math.ceil(g.count / 2)) radius = outerRadius;
      const time = shots.length * spacing;
      const environment = gravityForceAt(center, level.bodies);
      const orientation =
        g.bodyId === "shared" ? 0 : Math.atan2(environment.y, environment.x);
      const ringCount = outerRadius
        ? i < Math.ceil(g.count / 2)
          ? Math.ceil(g.count / 2)
          : Math.floor(g.count / 2)
        : g.count;
      const ringIndex =
        outerRadius && i >= Math.ceil(g.count / 2)
          ? i - Math.ceil(g.count / 2)
          : i;
      const baseAngle =
        phase + orientation + (ringIndex * Math.PI * 2) / ringCount;
      const f = gravityForceAt(
        { x: center.x + radius, y: center.y },
        level.bodies,
      );
      const speed = Math.sqrt(Math.max(0, -f.x) * radius) * speedFactor;
      const a = baseAngle + (i * spacing * speed) / radius;
      const position = {
        x: center.x + Math.cos(a) * radius,
        y: center.y + Math.sin(a) * radius,
      };
      const force = gravityForceAt(position, level.bodies),
        inward = -force.x * Math.cos(a) - force.y * Math.sin(a);
      const v = Math.sqrt(Math.max(0, inward) * radius) * speedFactor;
      if (v > 360) return [];
      const velocity = { x: -Math.sin(a) * v, y: Math.cos(a) * v };
      shots.push({
        time,
        position,
        velocity,
        angle: Math.atan2(velocity.y, velocity.x),
        power: gravityLaunchPower(v),
      });
      radius = baseRadius;
    }
  }
  return shots;
}
