import { fitGravityFrame } from "../../src/gravity/renderer";
import {
  gravityForceAt,
  gravityLaunchPower,
  gravityLaunchSpeed,
} from "../../src/gravity/physics";
import {
  createState,
  fireFrom,
  step,
  goalProgress,
} from "../../src/gravity/simulation";
import { wellVelocity } from "../../src/gravity/motion";
import {
  gravityRandom,
  witnessCompletionTime,
} from "../../src/gravity/generator";
import type { GravityLevel, WitnessShot, Vec2 } from "../../src/gravity/types";
const TAU = 2 * Math.PI;
const shotAt = (position: Vec2, velocity: Vec2, time = 0): WitnessShot => ({
  position,
  velocity,
  time,
  angle: Math.atan2(velocity.y, velocity.x),
  power: gravityLaunchPower(Math.hypot(velocity.x, velocity.y)),
});
function replay(
  level: GravityLevel,
  shots: WitnessShot[],
  horizon = 24,
  radius = 6,
): number | null {
  const state = createState(level);
  state.physics.planetRadius = radius;
  let next = 0,
    lastLeg = 0,
    advanced = 0;
  for (let n = 0; n < horizon * 120; n++) {
    while (next < shots.length && shots[next].time <= state.elapsed + 1e-8) {
      const shot = shots[next++];
      fireFrom(state, shot.position!, shot.velocity!);
    }
    step(state, 1 / 120);
    if (goalProgress(state).complete) return state.elapsed;
    const live = state.particles.filter((p) => p.alive);
    if (
      next === shots.length &&
      (!live.length ||
        live.every(
          (p) =>
            p.position.x < -40 ||
            p.position.x > 940 ||
            p.position.y < -40 ||
            p.position.y > 940,
        ))
    )
      return null;
    if (level.journey) {
      const leg = Math.max(0, ...live.map((p) => p.journey?.leg ?? 0));
      if (leg > lastLeg) {
        lastLeg = leg;
        advanced = state.elapsed;
      }
      if (state.elapsed - advanced > 8) return null;
    }
  }
  return null;
}
export function validCampaignSolution(
  level: GravityLevel,
  shots: WitnessShot[],
): boolean {
  const authored = { ...level, witness: shots, launch: shots[0].position! };
  const radii = [
    6,
    4,
    8,
    12,
    16,
    ...[
      [1200, 800],
      [390, 844],
      [320, 568],
      [844, 390],
    ].map(([w, h]) =>
      Math.max(
        4,
        Math.min(16, 6 / fitGravityFrame(authored, w, h).camera.scale),
      ),
    ),
  ];
  return (
    radii.every((radius) => replay(level, shots, 28, radius) !== null) &&
    witnessCompletionTime(authored, 1 / 240) !== null
  );
}
function local(level: GravityLevel): WitnessShot[] {
  const targets = level.requirements ?? [
    { bodyId: level.bodies[0].id, count: 2, turns: 1 },
  ];
  const groups: WitnessShot[][] = [];
  for (const requirement of targets) {
    const body = level.bodies.find((b) => b.id === requirement.bodyId)!;
    for (let member = 0; member < requirement.count; member++) {
      const candidates: WitnessShot[] = [];
      for (const radius of [
        55 + member * 18,
        65 + member * 20,
        75 + member * 20,
        95 + member * 18,
        60 + member * 22,
        120 + member * 15,
      ]) {
        for (const factor of [1, 0.9, 1.1, 0.8, 1.2])
          for (let phase = 0; phase < 16; phase++) {
            const angle = (TAU * phase) / 16,
              radial = { x: Math.cos(angle), y: Math.sin(angle) };
            const position = {
              x: body.position.x + radius * radial.x,
              y: body.position.y + radius * radial.y,
            };
            if (
              level.bodies.some(
                (b) =>
                  Math.hypot(
                    position.x - b.position.x,
                    position.y - b.position.y,
                  ) <
                  b.radius + 16,
              )
            )
              continue;
            const force = gravityForceAt(position, level.bodies),
              inward = -force.x * radial.x - force.y * radial.y;
            if (inward <= 0) continue;
            const speed = Math.sqrt(inward * radius) * factor;
            if (speed < 25 || speed > gravityLaunchSpeed(1)) continue;
            const direction =
              requirement.direction === "counterclockwise" ||
              (level.objective.kind === "counter" && member === 1)
                ? -1
                : 1;
            const moving = wellVelocity(level, body.id, 0);
            const shot = shotAt(position, {
              x: -radial.y * speed * direction + moving.x,
              y: radial.x * speed * direction + moving.y,
            });
            const test = {
              ...level,
              requirements: [{ ...requirement, count: 1 }],
              objective: {
                ...level.objective,
                kind: "loop" as const,
                count: 1,
              },
            };
            const duration = replay(test, [shot], 12);
            if (
              duration !== null &&
              [4, 8, 12, 16].every(
                (radius) => replay(test, [shot], 12, radius) !== null,
              )
            )
              candidates.push({ ...shot, time: duration });
            if (candidates.length >= 24) break;
          }
        if (candidates.length >= 24) break;
      }
      if (!candidates.length) {
        const random = gravityRandom(level.index * 100 + groups.length + 431);
        for (
          let attempt = 0;
          attempt < 5000 && candidates.length < 12;
          attempt++
        ) {
          const radius = body.radius + 18 + random() * 80,
            phase = random() * TAU;
          const position = {
            x: body.position.x + Math.cos(phase) * radius,
            y: body.position.y + Math.sin(phase) * radius,
          };
          if (
            level.bodies.some(
              (b) =>
                Math.hypot(
                  position.x - b.position.x,
                  position.y - b.position.y,
                ) <
                b.radius + 18,
            )
          )
            continue;
          const force = gravityForceAt(position, level.bodies),
            inward = -force.x * Math.cos(phase) - force.y * Math.sin(phase);
          if (inward <= 0) continue;
          const direction =
            requirement.direction === "counterclockwise" ||
            (level.objective.kind === "counter" && member === 1)
              ? -1
              : 1;
          const angle =
            phase + (direction * Math.PI) / 2 + (random() - 0.5) * 1.2;
          const speed = Math.sqrt(inward * radius) * (0.8 + random() * 0.5);
          if (speed > gravityLaunchSpeed(1)) continue;
          const shot = shotAt(position, {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed,
          });
          const test = {
            ...level,
            requirements: [{ ...requirement, count: 1 }],
            objective: { ...level.objective, kind: "loop" as const, count: 1 },
          };
          const duration = replay(test, [shot], 12);
          if (
            duration !== null &&
            [4, 8, 12, 16].every(
              (radius) => replay(test, [shot], 12, radius) !== null,
            )
          )
            candidates.push({ ...shot, time: duration });
        }
      }
      if (!candidates.length)
        throw new Error(
          `No local capture ${level.index + 1}/${requirement.bodyId}`,
        );
      groups.push(candidates);
    }
  }
  const random = gravityRandom(level.index + 89);
  for (let attempt = 0; attempt < 700; attempt++) {
    const selected = groups.map(
      (group) => group[attempt === 0 ? 0 : Math.floor(random() * group.length)],
    );
    const latest = Math.max(...selected.map((shot) => shot.time));
    const shots = selected
      .map((shot, i) => ({
        ...shot,
        time: attempt % 2 === 0 ? i * 0.35 : latest - shot.time + i * 0.35,
      }))
      .sort((a, b) => a.time - b.time);
    for (let i = 1; i < shots.length; i++)
      shots[i].time = Math.max(shots[i].time, shots[i - 1].time + 0.35);
    if (validCampaignSolution(level, shots)) return shots;
  }
  throw new Error(`No combined local capture ${level.index + 1}`);
}
function shared(level: GravityLevel): WitnessShot[] {
  const cores = level.bodies.filter((b) => b.kind === "attractor");
  const center = {
    x: cores.reduce((s, b) => s + b.position.x, 0) / cores.length,
    y: cores.reduce((s, b) => s + b.position.y, 0) / cores.length,
  };
  const extent = Math.max(
    ...cores.map(
      (b) =>
        Math.hypot(b.position.x - center.x, b.position.y - center.y) + b.radius,
    ),
  );
  for (const extra of [85, 120, 60, 150, 190])
    for (const factor of [1, 0.9, 1.1, 0.8, 1.2])
      for (let phase = 0; phase < 24; phase++) {
        const radius = extent + extra,
          angle = (phase * TAU) / 24;
        const position = {
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius,
        };
        const force = gravityForceAt(position, level.bodies),
          inward = -force.x * Math.cos(angle) - force.y * Math.sin(angle);
        if (inward <= 0) continue;
        const speed = Math.sqrt(inward * radius) * factor;
        if (speed > gravityLaunchSpeed(1)) continue;
        const shots = Array.from({ length: level.objective.count }, (_, i) => {
          const a = angle + (i * TAU) / level.objective.count;
          const orbitRadius = radius + (level.sharedCounter ? i * 35 : 0);
          const direction = level.sharedCounter && i === 1 ? -1 : 1;
          const p = {
            x: center.x + Math.cos(a) * orbitRadius,
            y: center.y + Math.sin(a) * orbitRadius,
          };
          return shotAt(
            p,
            {
              x: -Math.sin(a) * speed * direction,
              y: Math.cos(a) * speed * direction,
            },
            i * 0.35,
          );
        });
        if (validCampaignSolution(level, shots)) return shots;
      }
  throw new Error(`No shared capture ${level.index + 1}`);
}
function relay(level: GravityLevel): WitnessShot[] {
  const random = gravityRandom(72913 + level.index),
    first = level.bodies.find((b) => b.id === level.journey!.legs[0].bodyId)!,
    second = level.bodies.find((b) => b.id === level.journey!.legs[1].bodyId)!;
  for (let attempt = 0; attempt < 18000; attempt++) {
    const radius = 50 + random() * 85,
      phase = random() * TAU;
    const position = {
      x: first.position.x + Math.cos(phase) * radius,
      y: first.position.y + Math.sin(phase) * radius,
    };
    if (
      level.bodies.some(
        (b) =>
          Math.hypot(position.x - b.position.x, position.y - b.position.y) <
          b.radius + 18,
      )
    )
      continue;
    const toward = Math.atan2(
      second.position.y - position.y,
      second.position.x - position.x,
    );
    const angle =
      attempt % 3 === 0
        ? phase + (random() < 0.5 ? 1 : -1) * (Math.PI / 2 + (random() - 0.5))
        : toward + (random() - 0.5) * 2.4;
    const speed = 100 + random() * 240;
    const shot = shotAt(position, {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed,
    });
    if (validCampaignSolution(level, [shot])) return [shot];
  }
  throw new Error(`No relay ${level.index + 1}`);
}

export const authorCampaignSolution = (level: GravityLevel): WitnessShot[] =>
  level.journey
    ? relay(level)
    : level.sharedOrbit
      ? shared(level)
      : local(level);
