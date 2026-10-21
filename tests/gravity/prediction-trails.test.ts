import { expect, it } from "vitest";
import {
  createState,
  fireFrom,
  goalProgress,
  step,
} from "../../src/gravity/simulation";
import { getGravityLevel } from "../../src/gravity/campaign";
import { createGravityPrediction } from "../../src/gravity/prediction";
import { GRAVITY_FIXED_STEP } from "../../src/gravity/physics";
import type {
  GravityState,
  PlanetCollisionPolicy,
} from "../../src/gravity/types";
function physical(state: GravityState) {
  return {
    elapsed: state.elapsed,
    bodies: state.level.bodies,
    particles: state.particles
      .filter((p) => p.alive)
      .map(({ trail, ...p }) => p),
    contacts: state.passingContacts,
    spin: state.groupSpin,
    progress: goalProgress(state),
  };
}
it.each(["none", "soft", "elastic", "merge"] as PlanetCollisionPolicy[])(
  "omits prediction trails while preserving exact %s physics and moving wells",
  (policy) => {
    const level = getGravityLevel(42, 0);
    level.physics = {
      ...level.physics,
      planetCollisions: policy,
      planetGravity: true,
      bodyCollisions: false,
      planetRadius: 8,
    };
    level.motions = [
      {
        bodyId: level.bodies[0].id,
        kind: "circle",
        center: { ...level.bodies[0].position },
        radius: 20,
        period: 5,
      },
    ];
    const recorded = createState(level);
    recorded.groupSpin = { groups: {} };
    fireFrom(recorded, { x: 800, y: 600 }, { x: 8, y: 80 });
    fireFrom(recorded, { x: 826, y: 600 }, { x: -8, y: 80 });
    recorded.particles.reverse();
    const predicted = structuredClone(recorded);
    for (let n = 0; n < 240; n++) {
      step(recorded, GRAVITY_FIXED_STEP);
      step(predicted, GRAVITY_FIXED_STEP, false);
      expect(physical(predicted)).toEqual(physical(recorded));
    }
    expect(recorded.particles.some((p) => p.trail.length > 1)).toBe(true);
    expect(predicted.particles.every((p) => p.trail.length <= 1)).toBe(true);
  },
);
it("keeps the same final terminal sample when a predicted shot leaves its flight bounds", () => {
  const level = getGravityLevel(42, 0);
  level.bodies = [];
  const state = createState(level);
  state.flightBounds = { x: 0, y: 0, width: 100, height: 100 };
  const before = structuredClone(state),
    reference = structuredClone(state);
  fireFrom(reference, { x: 80, y: 50 }, { x: 200, y: 0 });
  const expected = [{ x: 80, y: 50 }];
  for (let n = 0; n < 120; n++) {
    step(reference, GRAVITY_FIXED_STEP);
    const p = reference.particles.find((p) => p.id === 0)!;
    if ((n + 1) % 4 === 0 || !p.alive) expected.push({ ...p.position });
    if (!p.alive) break;
  }
  const job = createGravityPrediction(
    state,
    { x: 80, y: 50 },
    { x: 200, y: 0 },
    1,
  );
  while (!job.done) job.advance(4);
  expect(job.terminated).toBe(true);
  expect(job.path).toEqual(expected);
  expect(state).toEqual(before);
});
