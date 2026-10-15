import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { GRAVITY_LAYOUTS, buildGravityLayout } from "../../src/gravity/layouts";
import {
  createState,
  fireFrom,
  step,
  goalProgress,
} from "../../src/gravity/simulation";
import { gravityLaunchSpeed, gravityForceAt } from "../../src/gravity/physics";
import { wellVelocity } from "../../src/gravity/motion";
import type { WitnessShot, GravityLevel } from "../../src/gravity/types";
const TAU = 2 * Math.PI;
// Opt-in authoring work only. Ordinary test runs never rewrite fixture data.
it.skipIf(process.env.GRAVITY_AUTHOR_FIXTURES !== "1")(
  "author local launch fixtures",
  () => {
    const fixtures: Record<string, WitnessShot[]> = {};
    for (const layout of GRAVITY_LAYOUTS) {
      const level = buildGravityLayout(layout, {
        index: 0,
        seed: 1,
        title: "Author fixture",
        source: "campaign",
        count: 1,
      });
      if (layout.wide || layout.counter) {
        fixtures[layout.id] = level.witness;
        continue;
      }
      const targets = layout.centralOnly
        ? level.bodies.slice(0, 1)
        : level.bodies.filter((b) => b.kind === "attractor");
      const shots: WitnessShot[] = [];
      for (const target of targets) {
        let found: WitnessShot | undefined;
        outer: for (const radius of [35, 32, 38, 45, 55, 65, 80, 95])
          for (const factor of [1, 1.1, 0.9, 1.2, 0.8, 1.35])
            for (let phase = 0; phase < 32; phase++) {
              if (radius < target.radius + 7) continue;
              const angle = (phase * TAU) / 32;
              const position = {
                x: target.position.x + Math.cos(angle) * radius,
                y: target.position.y + Math.sin(angle) * radius,
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
                inward = -(
                  force.x * Math.cos(angle) +
                  force.y * Math.sin(angle)
                );
              if (inward <= 0) continue;
              const speed = Math.sqrt(inward * radius) * factor,
                moving = wellVelocity(level, target.id, 0);
              const velocity = {
                x: -Math.sin(angle) * speed + moving.x,
                y: Math.cos(angle) * speed + moving.y,
              };
              const test: GravityLevel = {
                ...level,
                requirements: [{ bodyId: target.id, count: 1, turns: 1 }],
                objective: { ...level.objective, hold: 0 },
                witness: [
                  {
                    time: 0,
                    position,
                    velocity,
                    angle: Math.atan2(velocity.y, velocity.x),
                    power:
                      Math.hypot(velocity.x, velocity.y) /
                      gravityLaunchSpeed(1),
                  },
                ],
              };
              const state = createState(test);
              fireFrom(state, position, velocity);
              for (let n = 0; n < 120 * 12; n++) {
                step(state, 1 / 120);
                if (!state.particles[0]?.alive) break;
                if (goalProgress(state).complete) {
                  found = { ...test.witness[0], time: state.elapsed };
                  break outer;
                }
              }
            }
        if (!found)
          throw new Error("No author witness " + layout.id + " " + target.id);
        shots.push(found);
      }
      const latest = Math.max(...shots.map((s) => s.time));
      shots.forEach((s) => (s.time = latest - s.time));
      fixtures[layout.id] = shots;
      console.log("authored", layout.id);
    }
    writeFileSync(
      "src/gravity/witness-fixtures.json",
      JSON.stringify(fixtures, null, 2) + "\n",
    );
  },
  120000,
);
