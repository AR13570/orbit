import { expect, it } from "vitest";
import {
  buildEndlessGravityLevel,
  ENDLESS_LAYOUT_IDS,
} from "../../src/gravity/endless";
import {
  buildCampaignEndlessLevel,
  CAMPAIGN_ENDLESS_IDS,
  campaignEndlessTransforms,
} from "../../src/gravity/campaign-endless";
import { buildGravityLayout, GRAVITY_LAYOUTS } from "../../src/gravity/layouts";
import { createState, goalProgress } from "../../src/gravity/simulation";
import {
  gravityLaunchSpeed,
  PARTICLE_GRAVITY_STRENGTH,
} from "../../src/gravity/physics";

it("preserves legacy builder clearance without changing authored forces or geometry", () => {
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

// Sustained sequential solvability belongs to stable-authoring.test.ts, which
// also checks thinking pauses, perturbations, responsive sizes and survival.
it("keeps current endless profile launches clear at maximum size with human sequential gaps", () => {
  for (const profile of CAMPAIGN_ENDLESS_IDS) {
    for (const index of [45, 85, 125]) {
      const level = buildCampaignEndlessLevel(42, index, profile);
      const state = createState(level);
      expect(state.physics.planetGravity, profile).toBe(true);
      expect(state.physics.planetCollisions, profile).toBe("none");
      expect(state.physics.planetGravityStrength, profile).toBe(
        PARTICLE_GRAVITY_STRENGTH,
      );
      expect(level.objective.turns, profile).toBeGreaterThanOrEqual(2);
      expect(level.witness, profile).toHaveLength(goalProgress(state).target);
      for (const shot of level.witness) {
        expect(
          Math.hypot(shot.velocity!.x, shot.velocity!.y),
          `${profile} speed`,
        ).toBeLessThanOrEqual(gravityLaunchSpeed(1) + 1e-9);
        for (const body of level.bodies) {
          const clearance =
            Math.hypot(
              shot.position!.x - body.position.x,
              shot.position!.y - body.position.y,
            ) -
            body.radius -
            32;
          expect(
            clearance,
            `${profile}/${index}/${body.id} maximum launch clearance`,
          ).toBeGreaterThan(0);
        }
      }
      for (let shot = 1; shot < level.witness.length; shot++) {
        const physicalSeconds =
          level.witness[shot].time - level.witness[shot - 1].time;
        expect(
          physicalSeconds,
          `${profile}/${index} reference launch gap`,
        ).toBeGreaterThanOrEqual(6 - 1e-9);
      }
    }
  }
});

it("preserves physical size, force and launch speed across approved endless transforms", () => {
  for (const profile of CAMPAIGN_ENDLESS_IDS) {
    for (const index of [45, 85, 125]) {
      const base = buildCampaignEndlessLevel(42, index, profile);
      const approved = campaignEndlessTransforms(profile, index);
      expect(approved.length, profile).toBeGreaterThan(0);
      for (const transform of approved) {
        const level = buildCampaignEndlessLevel(
          42,
          index,
          profile,
          (transform.quarter * Math.PI) / 2,
          transform.reflected,
        );
        expect(level.objective).toEqual(base.objective);
        expect(level.requirements).toEqual(base.requirements);
        expect(level.physics).toEqual(base.physics);
        for (let i = 0; i < level.bodies.length; i++) {
          const body = level.bodies[i],
            original = base.bodies[i];
          expect({ ...body, position: original.position }).toEqual(original);
          expect(
            Math.hypot(body.position.x - 600, body.position.y - 600),
          ).toBeCloseTo(
            Math.hypot(original.position.x - 600, original.position.y - 600),
            8,
          );
        }
        for (let i = 0; i < level.witness.length; i++) {
          expect(level.witness[i].time).toBe(base.witness[i].time);
          expect(
            Math.hypot(
              level.witness[i].velocity!.x,
              level.witness[i].velocity!.y,
            ),
          ).toBeCloseTo(
            Math.hypot(
              base.witness[i].velocity!.x,
              base.witness[i].velocity!.y,
            ),
            10,
          );
        }
      }
    }
  }
});
