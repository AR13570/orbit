import { describe, expect, it, vi } from "vitest";
import { MAX_GRAVITY_PREDICTION_SECONDS as horizon } from "../../src/gravity/prediction-settings";
import { LiveGravityPreview } from "../../src/gravity/live-preview";
import { GravityEngine } from "../../src/gravity/engine";
import { newDraft, toGravityLevel } from "../../src/gravity/creator/model";

function fixture() {
  const draft = newDraft();
  draft.bodies = [];
  draft.physics = { bodyCollisions: false, planetGravity: true };
  const engine = new GravityEngine(42, toGravityLevel(draft));
  engine.setTimeScale(1);
  engine.launchFrom({ x: 400, y: 450 }, { x: -10, y: 5 });
  engine.setLaunch({ x: 200, y: 450 }, { angle: 0, power: 0.3 });
  return engine;
}
describe("continuous Gravity preview", () => {
  it("finishes the far path during continuous pointer changes while refreshing the moving-world prefix", () => {
    const engine = fixture(),
      preview = new LiveGravityPreview();
    const jobs: {
      seconds: number;
      job: ReturnType<GravityEngine["beginPrediction"]>;
    }[] = [];
    let expectedFirst: { x: number; y: number }[] = [];
    let clock = 0;
    const now = vi
      .spyOn(performance, "now")
      .mockImplementation(() => (clock += 0.1));
    try {
      let visible = 0;
      for (let frame = 0; frame < 720; frame++) {
        engine.update(1 / 60);
        engine.setAim(frame * 0.002, 0.3);
        const path = preview.update(
          (seconds) => {
            if (!jobs.length) expectedFirst = engine.predict(seconds);
            const job = engine.beginPrediction(seconds);
            jobs.push({ seconds, job });
            return job;
          },
          horizon,
          1 / 60,
        );
        if (frame > 2) expect(path.length).toBeGreaterThan(1);
        visible = Math.max(visible, path.length);
      }
      expect(
        jobs.filter(({ seconds, job }) => seconds === horizon && job?.done)
          .length,
      ).toBeGreaterThan(1);
      expect(jobs.filter(({ seconds }) => seconds < 1).length).toBeGreaterThan(
        10,
      );
      expect(visible).toBeGreaterThan(500);
      const firstFull = jobs.find(({ seconds }) => seconds === horizon)!.job!;
      expect(firstFull.path).toEqual(expectedFirst);
      expect(preview.path[8].y).toBeGreaterThan(firstFull.path[8].y);
      preview.cancel();
      expect(preview.path).toEqual([]);
      expect(jobs.every(({ job }) => job?.done)).toBe(true);
    } finally {
      now.mockRestore();
    }
  });
  it("streams samples before full completion and eases a changed captured path instead of swapping it", () => {
    const preview = new LiveGravityPreview();
    let offset = 0;
    const create = () => {
      let advances = 0;
      const captured = offset;
      const job = {
        path: [{ x: 0, y: 0 }],
        get done() {
          return advances >= 3;
        },
        advance() {
          advances++;
          job.path.push({ x: advances, y: captured });
        },
        cancel() {
          advances = 3;
        },
      };
      return job;
    };
    preview.update(create, horizon, 1 / 60);
    expect(preview.path.length).toBeGreaterThan(1);
    for (let i = 0; i < 3; i++) preview.update(create, horizon, 1 / 60);
    offset = 100;
    for (let i = 0; i < 4; i++) preview.update(create, horizon, 1 / 60);
    expect(preview.path[1].y).toBeGreaterThan(0);
    expect(preview.path[1].y).toBeLessThan(100);
  });
  it("hides an obsolete far heading on a sharp aim change without cancelling its work", () => {
    const preview = new LiveGravityPreview();
    let angle = 0;
    const fullJobs: { cancelled: boolean; done: boolean }[] = [];
    const create = (seconds: number) => {
      const captured = angle;
      let advances = 0;
      const job = {
        path: [{ x: 0, y: 0 }],
        cancelled: false,
        get done() {
          return advances >= (seconds === horizon ? 30 : 1);
        },
        advance() {
          advances++;
          for (let n = 0; n < (seconds === horizon ? 5 : 15); n++) {
            const t = job.path.length;
            job.path.push({
              x: Math.cos(captured) * t,
              y: Math.sin(captured) * t,
            });
          }
        },
        cancel() {
          job.cancelled = true;
          advances = 30;
        },
      };
      if (seconds === horizon) fullJobs.push(job);
      return job;
    };
    for (let frame = 0; frame < 10; frame++)
      preview.update(create, horizon, 1 / 60, { angle, power: 0.3 });
    expect(preview.path.length).toBeGreaterThan(30);
    angle = Math.PI / 2;
    preview.update(create, horizon, 1 / 60, { angle, power: 0.3 });
    expect(preview.path.length).toBeLessThanOrEqual(16);
    expect(preview.path.at(-1)!.y).toBeGreaterThan(10);
    expect(preview.path.at(-1)!.x).toBeCloseTo(0, 10);
    expect(fullJobs[0].cancelled).toBe(false);
    for (let frame = 0; frame < 40; frame++)
      preview.update(create, horizon, 1 / 60, { angle, power: 0.3 });
    expect(fullJobs[0].done).toBe(true);
    expect(fullJobs.length).toBeGreaterThan(1);
    expect(preview.path.length).toBeGreaterThan(30);
    // No backwards segment or join to the original horizontal heading.
    expect(
      preview.path.every(
        (point, i, path) => i === 0 || point.y >= path[i - 1].y,
      ),
    ).toBe(true);
    expect(
      Math.max(...preview.path.map((point) => Math.abs(point.x))),
    ).toBeLessThan(1e-8);
  });
  it("eases a fixed aim's changing far deflection as existing particles move, while keeping the prefix responsive", () => {
    const engine = fixture(),
      preview = new LiveGravityPreview();
    engine.launchFrom({ x: 250, y: 450 }, { x: -20, y: 25 });
    // Complete each real coherent prediction in one slice, exposing the largest
    // possible snapshot-to-snapshot visual swap on a fast device.
    const now = vi.spyOn(performance, "now").mockReturnValue(0);
    try {
      const create = (seconds: number) => engine.beginPrediction(seconds);
      preview.update(create, horizon, 1 / 60, engine.getRenderSnapshot().aim);
      for (let n = 0; n < 4; n++) engine.update(0.25);
      const fixedAim = { ...engine.getRenderSnapshot().aim };
      let changed = false;
      for (let frame = 0; frame < 10; frame++) {
        const before = structuredClone(preview.path);
        const exact = engine.predict(horizon);
        preview.update(create, horizon, 1 / 60, fixedAim);
        const rawFarChange = Math.hypot(
          exact[100].x - before[100].x,
          exact[100].y - before[100].y,
        );
        const drawnFarChange = Math.hypot(
          preview.path[100].x - before[100].x,
          preview.path[100].y - before[100].y,
        );
        changed ||= rawFarChange > 1;
        expect(drawnFarChange).toBeLessThan(rawFarChange * 0.22 + 1e-9);
        expect(drawnFarChange).toBeGreaterThan(rawFarChange * 0.15 - 1e-9);
        const rawNearChange = Math.hypot(
          exact[8].x - before[8].x,
          exact[8].y - before[8].y,
        );
        const drawnNearChange = Math.hypot(
          preview.path[8].x - before[8].x,
          preview.path[8].y - before[8].y,
        );
        expect(drawnNearChange).toBeGreaterThan(rawNearChange * 0.28 - 1e-9);
        expect(
          preview.path.every(
            (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
          ),
        ).toBe(true);
        expect(engine.getRenderSnapshot().aim).toEqual(fixedAim);
        engine.update(1 / 60);
      }
      expect(changed).toBe(true);
    } finally {
      now.mockRestore();
    }
  });
  it("retains a moving-obstacle terminal cutoff across fresh prefix captures until continuation is proven", () => {
    const preview = new LiveGravityPreview();
    let obstacleBlocks = false;
    let farAdvances = 0;
    const create = (seconds: number) => {
      const limit = seconds === horizon ? 60 : obstacleBlocks ? 5 : 16;
      const path = [{ x: 0, y: 0 }];
      let cancelled = false;
      return {
        path,
        get done() {
          return (
            cancelled ||
            (seconds === horizon ? farAdvances >= 200 : path.length >= limit)
          );
        },
        advance() {
          if (seconds === horizon) farAdvances++;
          const samples = seconds === horizon ? 60 : 2;
          for (let n = 0; n < samples && path.length < limit; n++)
            path.push({ x: path.length, y: 0 });
        },
        cancel() {
          cancelled = true;
        },
      };
    };
    // The far lane captured the world before an obstacle moved into the route.
    preview.update(create, horizon, 1 / 60, { angle: 0, power: 0.3 });
    expect(preview.path.length).toBe(60);
    obstacleBlocks = true;
    for (let frame = 0; frame < 9; frame++)
      preview.update(create, horizon, 1 / 60, { angle: 0, power: 0.3 });
    expect(preview.path.length).toBe(5);
    for (let frame = 0; frame < 8; frame++) {
      preview.update(create, horizon, 1 / 60, { angle: 0, power: 0.3 });
      expect(preview.path.length).toBeLessThanOrEqual(5);
    }
    obstacleBlocks = false;
    // A fresh, still-short prefix cannot yet refute the previous collision.
    preview.update(create, horizon, 1 / 60, { angle: 0, power: 0.3 });
    expect(preview.path.length).toBeLessThanOrEqual(5);
    for (let frame = 0; frame < 3; frame++)
      preview.update(create, horizon, 1 / 60, { angle: 0, power: 0.3 });
    // Once newer exact samples pass the cutoff, retain the valid far tail.
    expect(preview.path.length).toBe(60);
  });
  it("restores a safe full tail when a fresh complete prefix survives the old terminal horizon sample", () => {
    const preview = new LiveGravityPreview();
    let obstacleBlocks = false;
    const create = (seconds: number) => {
      const blocked = obstacleBlocks;
      let advanced = false;
      return {
        path: Array.from({ length: seconds === horizon ? 60 : 16 }, (_, x) => ({
          x,
          y: 0,
        })),
        get done() {
          return seconds < horizon && advanced;
        },
        get terminated() {
          return seconds < horizon && advanced && blocked;
        },
        advance() {
          advanced = true;
        },
        cancel() {},
      };
    };
    preview.update(create, horizon, 1 / 60);
    expect(preview.path.length).toBe(60);
    obstacleBlocks = true;
    preview.update(create, horizon, 1 / 60);
    expect(preview.path.length).toBe(16);
    obstacleBlocks = false;
    preview.update(create, horizon, 1 / 60);
    expect(preview.path.length).toBe(60);
  });
});
