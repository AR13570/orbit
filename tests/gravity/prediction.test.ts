import { describe, expect, it, vi } from "vitest";
import { GravityEngine } from "../../src/gravity/engine";
import { newDraft, toGravityLevel } from "../../src/gravity/creator/model";
function fixture() {
  const draft = newDraft();
  draft.bodies = [];
  draft.physics = {
    planetGravity: true,
    planetCollisions: "elastic",
    bodyCollisions: false,
    trailSeconds: 30,
  };
  return new GravityEngine(42, toGravityLevel(draft));
}
describe("incremental Gravity aim prediction", () => {
  it.each([1, 2])(
    "matches live collision radius for selected size %f and captures its world",
    (size) => {
      const draft = newDraft();
      draft.bodies = [
        {
          id: "wall",
          kind: "attractor",
          position: { x: 200, y: 450 },
          radius: 20,
          strength: 0,
        },
      ];
      draft.physics = {
        planetRadius: 4,
        planetGravity: false,
        bodyCollisions: true,
      };
      const engine = new GravityEngine(42, toGravityLevel(draft));
      engine.setTimeScale(1);
      engine.setProjectileSize(size);
      engine.setLaunch({ x: 100, y: 477 }, { angle: 0, power: 0.25 });
      const expected = engine.predict(1);
      const job = engine.beginPrediction(1)!;
      engine.launch();
      engine.setProjectileSize(size === 2 ? 1 : 2);
      while (!job.done) job.advance(2);
      for (let frame = 0; frame < 120; frame++) engine.update(1 / 120);
      const planet = engine.getSnapshot().particles[0];
      expect(job.path).toEqual(expected);
      expect(planet.radius).toBe(size === 2 ? 8 : 4);
      expect(planet.projectileSize).toBe(size);
      expect(planet.alive).toBe(size === 1);
      expect(planet.position.x).toBeCloseTo(expected.at(-1)!.x, 12);
      expect(planet.position.y).toBeCloseTo(expected.at(-1)!.y, 12);
    },
  );
  it("shows a genuinely longer full path using the same physics without changing the live sky", () => {
    const engine = fixture();
    engine.launchFrom({ x: 420, y: 430 }, { x: 12, y: 8 });
    engine.setLaunch({ x: 200, y: 450 }, { angle: 0.1, power: 0.25 });
    const before = engine.getSnapshot(),
      expected = engine.predict(10),
      partial = engine.predict(1.4),
      job = engine.beginPrediction(10)!;
    while (!job.done) job.advance(2);
    expect(job.path).toEqual(expected);
    expect(job.path.length).toBeGreaterThan(partial.length * 5);
    expect(engine.getSnapshot()).toEqual(before);
  });
  it("yields within the supplied work budget and stops permanently on cancellation", () => {
    const engine = fixture();
    engine.setLaunch({ x: 200, y: 450 }, { angle: 0, power: 0.25 });
    const job = engine.beginPrediction(10)!;
    let clock = 0;
    const now = vi
      .spyOn(performance, "now")
      .mockImplementation(() => (clock += 2));
    try {
      job.advance(5);
      expect(job.done).toBe(false);
      // A strict per-step budget may yield before the next four-step sample.
      job.advance(5);
      job.advance(5);
      expect(job.path.length).toBeGreaterThan(1);
      expect(job.path.length).toBeLessThan(20);
      job.cancel();
      const last = structuredClone(job.path);
      job.advance(5);
      expect(job.done).toBe(true);
      expect(job.path).toEqual(last);
    } finally {
      now.mockRestore();
    }
  });
  it("uses collisions and mutual attraction from the captured world", () => {
    const engine = fixture();
    engine.launchFrom({ x: 240, y: 450 }, { x: -20, y: 0 });
    engine.setLaunch({ x: 200, y: 450 }, { angle: 0, power: 0.25 });
    const expected = engine.predict(2),
      job = engine.beginPrediction(2)!;
    while (!job.done) job.advance(1);
    expect(job.path).toEqual(expected);
    // The elastic encounter reverses motion. Its turning point changes with
    // mutual attraction, so it need not pass back across the launch position.
    expect(
      job.path.some(
        (point, index) => index > 0 && point.x < job.path[index - 1].x,
      ),
    ).toBe(true);
  });
  it("simulates the actual sixty-second Full horizon and caps longer requests consistently", () => {
    const draft = newDraft();
    draft.bodies = [];
    draft.physics = {
      bodyCollisions: false,
      planetGravity: false,
      escapeDistance: 100000,
    };
    const engine = new GravityEngine(42, toGravityLevel(draft));
    engine.setTimeScale(1);
    engine.setLaunch({ x: 100, y: 400 }, { angle: 0, power: 0.25 });
    const expected = engine.predict(60),
      job = engine.beginPrediction()!;
    while (!job.done) job.advance(2);
    expect(job.path).toHaveLength(1801);
    expect(job.path).toEqual(expected);
    expect(engine.predict(100)).toEqual(expected);
    const direct = engine.predictFrom({ x: 100, y: 400 }, { x: 10, y: 0 }, 60);
    expect(direct).toHaveLength(1801);
    expect(direct.at(-1)!.x).toBeCloseTo(700, 8);
    engine.launch();
    for (let i = 0; i < 7200; i++) engine.update(1 / 120);
    expect(engine.getSnapshot().particles[0].position.x).toBeCloseTo(
      job.path.at(-1)!.x,
      10,
    );
  });
  it("reports a terminal collision even when it lands on the prefix horizon's final sample", () => {
    const draft = newDraft();
    draft.bodies = [
      {
        id: "wall",
        kind: "attractor",
        position: { x: 128.99, y: 450 },
        radius: 20,
        strength: 0,
      },
    ];
    draft.physics = {
      planetRadius: 4,
      planetGravity: false,
      bodyCollisions: true,
    };
    const engine = new GravityEngine(42, toGravityLevel(draft));
    engine.setLaunch({ x: 100, y: 450 }, { angle: 0, power: 10 / 420 });
    const job = engine.beginPrediction(0.5)!;
    while (!job.done) job.advance(2);
    expect(job.path).toHaveLength(16);
    expect(job.terminated).toBe(true);
  });
});
