import { describe, expect, it, vi } from "vitest";
const horizon = 4.2;
import { LiveGravityPreview } from "../../src/gravity/live-preview";
import { GravityEngine } from "../../src/gravity/engine";
import { newDraft, toGravityLevel } from "../../src/gravity/creator/model";
import { GRAVITY_FIXED_STEP } from "../../src/gravity/physics";

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
  it("reuses each easing weight per frame while preserving every coordinate and path ownership", () => {
    const preview = new LiveGravityPreview();
    const source = Array.from({ length: 601 }, (_, index) => ({
      x: index * 1.37,
      y: index * -0.73,
    }));
    const create = () => ({
      path: source,
      done: false,
      advance() {},
      cancel() {},
    });
    const first = preview.update(create, 4.2, 1 / 60);
    expect(first).toEqual(source);
    expect(first).not.toBe(source);
    expect(first[0]).not.toBe(source[0]);
    for (const dt of [1 / 60, 0.04, 1, 0, -1, Infinity, -Infinity, NaN]) {
      const previous = preview.path;
      const previousCopy = structuredClone(previous);
      for (let index = 0; index < source.length; index++) {
        source[index].x += index * 0.11;
        source[index].y -= index * 0.29;
      }
      // Characterize the original per-point easing independently of caching.
      const expected = source.map((point, index) => {
        if (index === 0) return { ...point };
        const weight = Math.max(
          0,
          Math.min(1, (index - 0.5 / GRAVITY_FIXED_STEP / 4) / 5),
        );
        const blend =
          1 -
          Math.exp(-Math.max(0, Math.min(dt, 0.05)) / (0.045 + 0.035 * weight));
        return {
          x: previous[index].x + (point.x - previous[index].x) * blend,
          y: previous[index].y + (point.y - previous[index].y) * blend,
        };
      });
      const exp = vi.spyOn(Math, "exp");
      try {
        const actual = preview.update(create, 4.2, dt);
        expect(actual).toEqual(expected);
        expect(previous).toEqual(previousCopy);
        expect(actual).not.toBe(previous);
        for (let index = 0; index < actual.length; index++) {
          expect(actual[index]).not.toBe(previous[index]);
          expect(actual[index]).not.toBe(source[index]);
        }
        expect(exp).toHaveBeenCalledTimes(6);
      } finally {
        exp.mockRestore();
      }
    }
  });
  it("finishes short captures during continuous pointer changes without a second prediction lane", () => {
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
      expect(jobs.every(({ seconds }) => seconds === horizon)).toBe(true);
      expect(visible).toBeGreaterThan(100);
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
  it("cancels an obsolete short capture and immediately streams the new heading", () => {
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
    expect(preview.path.at(-1)!.y).toBeGreaterThan(0);
    expect(preview.path.at(-1)!.x).toBeCloseTo(0, 10);
    expect(fullJobs[0].cancelled).toBe(true);
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
  it("replaces a slow capture when small aim changes accumulate, without blank frames", () => {
    const preview = new LiveGravityPreview();
    const jobs: { cancelled: boolean }[] = [];
    let angle = 0;
    const create = () => {
      const captured = angle;
      const job = {
        path: [{ x: 0, y: 0 }],
        done: false,
        cancelled: false,
        advance() {
          const distance = job.path.length;
          job.path.push({
            x: Math.cos(captured) * distance,
            y: Math.sin(captured) * distance,
          });
        },
        cancel() {
          job.cancelled = true;
          job.done = true;
        },
      };
      jobs.push(job);
      return job;
    };
    for (let frame = 0; frame < 40; frame++) {
      angle = frame * 0.02;
      const path = preview.update(create, horizon, 1 / 60, {
        angle,
        power: 0.3,
      });
      expect(path.length, `blank preview at frame ${frame}`).toBeGreaterThan(1);
    }
    expect(jobs[0].cancelled).toBe(true);
    expect(jobs.length).toBeGreaterThan(2);
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
  it("truncates a newly captured short path at its terminal point", () => {
    const preview = new LiveGravityPreview();
    let length = 40;
    const create = () => ({
      path: Array.from({ length }, (_, x) => ({ x, y: 0 })),
      done: true,
      advance() {},
      cancel() {},
    });
    preview.update(create, horizon, 1 / 60);
    expect(preview.path).toHaveLength(40);
    length = 5;
    preview.update(create, horizon, 1 / 60);
    expect(preview.path).toHaveLength(5);
    expect(preview.path.at(-1)!.x).toBe(4);
    length = 20;
    preview.update(create, horizon, 1 / 60);
    expect(preview.path).toHaveLength(20);
  });
});
