import { expect, it } from "vitest";
import {
  buildEndlessGravityLevel,
  ENDLESS_LAYOUT_IDS,
} from "../../src/gravity/endless";
import { witnessCompletionTime } from "../../src/gravity/generator";
import { buildGravityLayout, GRAVITY_LAYOUTS } from "../../src/gravity/layouts";
import { createState, goalProgress } from "../../src/gravity/simulation";
import { PARTICLE_GRAVITY_STRENGTH } from "../../src/gravity/physics";

const repairedLayouts = new Set([
  "single-well",
  "binary-wide",
  "unequal-binary",
  "triple-line",
  "unequal-triangle",
  "cross",
  "staggered-ladder",
  "open-v",
  "zigzag",
  "five-star",
  "pentagon",
  "hexagon",
  "eight-well-enclosure",
  "broken-ring",
  "offset-crescent",
  "repeller-gate",
  "repeller-triangle",
  "unequal-chain",
  "moving-pendulum",
  "self-gravitating-constellation",
  "elastic-pair",
  "merging-swarm",
]);

it("preserves ENDLESS core clearance without changing forces or formation geometry", () => {
  for (const id of ENDLESS_LAYOUT_IDS) {
    const layout = GRAVITY_LAYOUTS.find((item) => item.id === id)!;
    const original = buildGravityLayout(layout, {
      seed: 42,
      index: 90,
      title: id,
      source: "procedural",
      count: 1,
      turns: 3,
    });
    const endless = buildEndlessGravityLevel(42, 90, id, 0);
    for (const body of endless.bodies) {
      const authored = original.bodies.find((item) => item.id === body.id)!;
      expect({ ...body, radius: authored.radius }, `${id}/${body.id}`).toEqual(
        authored,
      );
      if (body.kind === "attractor") {
        expect(body.radius, `${id}/${body.id}`).toBe(authored.radius - 3);
        expect(body.radius + 6, `${id}/${body.id} surface clearance`).toBe(
          authored.radius + 3,
        );
      } else expect(body.radius, `${id}/${body.id}`).toBe(authored.radius);
    }
  }
});

it("keeps enlarged planets clear of cores at every ENDLESS demand", () => {
  for (const id of ENDLESS_LAYOUT_IDS) {
    for (const index of [45, 60, 75, 90]) {
      const level = buildEndlessGravityLevel(42, index, id, 0);
      const state = createState(level);
      expect(state.physics.planetGravity, id).toBe(true);
      expect(state.physics.planetCollisions, id).toBe("soft");
      expect(state.physics.planetRadius, id).toBe(6);
      expect(state.physics.planetGravityStrength, id).toBe(
        PARTICLE_GRAVITY_STRENGTH,
      );
      expect(goalProgress(state).target, id).toBe(
        index < 60 ? 6 : index < 75 ? 7 : 8,
      );
      expect(level.objective.turns, id).toBe(index < 90 ? 2 : 3);
      expect(level.witness, id).toHaveLength(8);
      for (const shot of level.witness)
        expect(
          Math.hypot(shot.velocity!.x, shot.velocity!.y),
          `${id} launch speed`,
        ).toBeLessThanOrEqual(460);
      for (let shot = 1; shot < level.witness.length; shot++)
        expect(
          level.witness[shot].time - level.witness[shot - 1].time,
          `${id} release ${shot}`,
        ).toBeGreaterThanOrEqual(0.3 - 1e-9);
      expect(witnessCompletionTime(level), `${id}/${index}`).not.toBeNull();
      if (index === 90)
        expect(
          witnessCompletionTime(level, 1 / 240),
          `${id}/${index}/240`,
        ).not.toBeNull();
    }
    const finalDemand = buildEndlessGravityLevel(42, 90, id, 0);
    const cappedDemand = buildEndlessGravityLevel(4294967295, 65535, id, 0);
    expect(cappedDemand.objective, id).toEqual(finalDemand.objective);
    expect(cappedDemand.requirements, id).toEqual(finalDemand.requirements);
    expect(cappedDemand.bodies, id).toEqual(finalDemand.bodies);
    expect(cappedDemand.physics, id).toEqual(finalDemand.physics);
    expect(cappedDemand.witness, id).toEqual(finalDemand.witness);
  }
}, 30000);

it("preserves repaired ENDLESS routes after rotating their real bodies and launches", () => {
  for (const id of ENDLESS_LAYOUT_IDS.filter((item) =>
    repairedLayouts.has(item),
  ))
    for (const [seed, rotation] of [
      [7, 0.371],
      [137, 1.413],
    ]) {
      const level = buildEndlessGravityLevel(seed, 90, id, rotation);
      for (const dt of [1 / 120, 1 / 240])
        expect(
          witnessCompletionTime(level, dt),
          `${id}/${seed}/${rotation}/${dt}`,
        ).not.toBeNull();
    }
}, 30000);
