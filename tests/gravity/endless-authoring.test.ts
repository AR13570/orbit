import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { GRAVITY_LAYOUTS, buildGravityLayout } from "../../src/gravity/layouts";
import {
  createState,
  fireFrom,
  step,
  goalProgress,
} from "../../src/gravity/simulation";
import { gravityForceAt, gravityLaunchSpeed } from "../../src/gravity/physics";
import { wellVelocity } from "../../src/gravity/motion";
import { verifyLevel } from "../../src/gravity/generator";
import type {
  GravityLevel,
  WitnessShot,
  GravityOrbitRequirement,
} from "../../src/gravity/types";
const TAU = Math.PI * 2;
it.skipIf(process.env.GRAVITY_AUTHOR_ENDLESS !== "1")(
  "authors long-lived endless fixtures",
  () => {
    const fixtures: Record<
      string,
      { requirements?: GravityOrbitRequirement[]; witness: WitnessShot[] }
    > = {};
    for (const layout of GRAVITY_LAYOUTS) {
      const level = buildGravityLayout(layout, {
        seed: 0,
        index: 0,
        title: layout.id,
        source: "procedural",
        count: 8,
        turns: 3,
      });
      if (layout.wide) {
        if (verifyLevel(level))
          fixtures[layout.id] = { witness: level.witness };
        console.log(layout.id, !!fixtures[layout.id]);
        continue;
      }
      if (layout.counter) {
        const cw = level.witness[0],
          ccw = level.witness[1];
        level.requirements = [
          { bodyId: "well-1", count: 4, turns: 3, direction: "clockwise" },
          {
            bodyId: "well-1",
            count: 4,
            turns: 3,
            direction: "counterclockwise",
          },
        ];
        level.witness = Array.from({ length: 4 }, (_, i) => [
          { ...cw, time: i * 0.08 },
          { ...ccw, time: i * 0.08 },
        ])
          .flat()
          .sort((a, b) => a.time - b.time);
        if (verifyLevel(level))
          fixtures[layout.id] = {
            requirements: level.requirements,
            witness: level.witness,
          };
        console.log(layout.id, !!fixtures[layout.id]);
        continue;
      }
      const targets = layout.centralOnly
        ? level.bodies.slice(0, 1)
        : level.bodies.filter((b) => b.kind === "attractor");
      const found: { bodyId: string; shot: WitnessShot; completion: number }[] =
        [];
      for (const target of targets) {
        let shot: WitnessShot | undefined,
          completion = 0;
        outer: for (const radius of [35, 38, 45, 55, 65, 32, 80, 95])
          for (const factor of [1, 1.1, 0.9, 1.2, 0.8, 1.35])
            for (let phase = 0; phase < 24; phase++) {
              if (radius < target.radius + 7) continue;
              const angle = (phase * TAU) / 24,
                radial = { x: Math.cos(angle), y: Math.sin(angle) },
                position = {
                  x: target.position.x + radial.x * radius,
                  y: target.position.y + radial.y * radius,
                };
              if (
                level.bodies.some(
                  (b) =>
                    Math.hypot(
                      position.x - b.position.x,
                      position.y - b.position.y,
                    ) <
                    b.radius + 6,
                )
              )
                continue;
              const force = gravityForceAt(position, level.bodies),
                inward = -(force.x * radial.x + force.y * radial.y);
              if (inward <= 0) continue;
              const speed = Math.sqrt(inward * radius) * factor,
                motion = wellVelocity(level, target.id, 0),
                velocity = {
                  x: -radial.y * speed + motion.x,
                  y: radial.x * speed + motion.y,
                };
              const state = createState({
                ...level,
                requirements: [{ bodyId: target.id, count: 1, turns: 3 }],
                objective: { ...level.objective, hold: 0 },
              });
              fireFrom(state, position, velocity);
              for (let n = 0; n < 120 * 24; n++) {
                step(state, 1 / 120);
                if (!state.particles[0]?.alive) break;
                if (goalProgress(state).complete) {
                  shot = {
                    time: 0,
                    position,
                    velocity,
                    angle: Math.atan2(velocity.y, velocity.x),
                    power:
                      Math.hypot(velocity.x, velocity.y) /
                      gravityLaunchSpeed(1),
                  };
                  completion = state.elapsed;
                  break outer;
                }
              }
            }
        if (shot) found.push({ bodyId: target.id, shot, completion });
      }
      if (found.length) {
        const latest = Math.max(...found.map((s) => s.completion));
        level.witness = [];
        level.requirements = [];
        found.forEach((item, i) => {
          const count =
            Math.floor(8 / found.length) + Number(i < 8 % found.length);
          if (!count) return;
          level.requirements!.push({ bodyId: item.bodyId, count, turns: 3 });
          for (let j = 0; j < count; j++)
            level.witness.push({
              ...item.shot,
              time: latest - item.completion + j * 0.08,
            });
        });
        level.witness.sort((a, b) => a.time - b.time);
        if (verifyLevel(level))
          fixtures[layout.id] = {
            requirements: level.requirements,
            witness: level.witness,
          };
      }
      if (!fixtures[layout.id] && layout.physics?.planetGravity) {
        const target = targets[0],
          radius = 70;
        level.requirements = [{ bodyId: target.id, count: 8, turns: 3 }];
        const positions = Array.from({ length: 8 }, (_, i) => ({
          x: target.position.x + Math.cos((i * TAU) / 8) * radius,
          y: target.position.y + Math.sin((i * TAU) / 8) * radius,
        }));
        level.witness = positions.map((position, i) => {
          const radial = {
              x: (position.x - target.position.x) / radius,
              y: (position.y - target.position.y) / radius,
            },
            force = gravityForceAt(position, level.bodies);
          for (let j = 0; j < 8; j++)
            if (j !== i) {
              const dx = positions[j].x - position.x,
                dy = positions[j].y - position.y,
                f =
                  (1200 * (layout.physics!.planetMass ?? 1)) /
                  (dx * dx + dy * dy + 9) ** 1.5;
              force.x += dx * f;
              force.y += dy * f;
            }
          const speed = Math.sqrt(
              Math.max(1, -force.x * radial.x - force.y * radial.y) * radius,
            ),
            velocity = { x: -radial.y * speed, y: radial.x * speed };
          return {
            time: 0,
            position,
            velocity,
            angle: Math.atan2(velocity.y, velocity.x),
            power: speed / gravityLaunchSpeed(1),
          };
        });
        if (verifyLevel(level))
          fixtures[layout.id] = {
            requirements: level.requirements,
            witness: level.witness,
          };
      }
      console.log(layout.id, found.length, !!fixtures[layout.id]);
    }
    writeFileSync(
      "src/gravity/endless-fixtures.json",
      JSON.stringify(fixtures, null, 2) + "\n",
    );
    console.log("verified eligible", Object.keys(fixtures).length);
  },
  120000,
);
