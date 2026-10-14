import { describe, expect, it } from "vitest";
import type { Body } from "../../src/game/types";
import {
  getTutorialCameraTarget,
  TutorialCameraRig,
  type TutorialCameraTargetOptions,
} from "../../src/tutorial/camera";

const bodies: Body[] = [
  {
    id: "pull",
    kind: "attractor",
    position: { x: 500, y: 200 },
    radius: 45,
    strength: 1,
  },
  {
    id: "push",
    kind: "repellent",
    position: { x: 900, y: 350 },
    radius: 38,
    strength: 1,
  },
];
const options: TutorialCameraTargetOptions = {
  overview: { center: { x: 600, y: 300 }, scale: 0.5 },
  area: { width: 900, height: 500 },
  step: "intro",
  mode: "zen",
  launcher: { x: 120, y: 300 },
  bodies,
  checkpoint: { position: { x: 1100, y: 220 }, radius: 50 },
  shotMode: 1,
};

describe("tutorial focus framing", () => {
  it("magnifies the launcher without changing supplied world data", () => {
    const before = structuredClone(options);
    const camera = getTutorialCameraTarget(options);
    expect(camera.center).toEqual({ x: 120, y: 300 });
    expect(camera.scale).toBeGreaterThanOrEqual(0.8);
    expect(camera.scale).toBeLessThanOrEqual(1.15);
    expect(options).toEqual(before);
  });
  it("focuses each force independently when a phase is supplied", () => {
    expect(
      getTutorialCameraTarget({
        ...options,
        step: "forces",
        forcePhase: "pull",
      }).center,
    ).toEqual({ x: 500, y: 200 });
    expect(
      getTutorialCameraTarget({
        ...options,
        step: "forces",
        forcePhase: "push",
      }).center,
    ).toEqual({ x: 900, y: 350 });
  });
  it("frames both forces with room for their surrounding waves", () => {
    const camera = getTutorialCameraTarget({ ...options, step: "forces" });
    for (const body of bodies) {
      expect(
        (Math.abs(body.position.x - camera.center.x) + body.radius * 2.6) *
          camera.scale,
      ).toBeLessThanOrEqual(450 - 24);
      expect(
        (Math.abs(body.position.y - camera.center.y) + body.radius * 2.6) *
          camera.scale,
      ).toBeLessThanOrEqual(250 - 24);
    }
  });
  it.each([
    { width: 180, height: 550 },
    { width: 1400, height: 220 },
  ])("keeps a focused force and waves in a %j viewport", (area) => {
    const camera = getTutorialCameraTarget({
      ...options,
      step: "forces",
      forcePhase: "pull",
      area,
    });
    expect(camera.scale).toBeGreaterThan(0);
    expect(45 * 2.6 * camera.scale).toBeLessThanOrEqual(
      Math.min(area.width, area.height) / 2 - 24,
    );
  });
  it("focuses the checkpoint and Gravity orbit objective", () => {
    expect(
      getTutorialCameraTarget({ ...options, step: "checkpoint" }).center,
    ).toEqual({ x: 1100, y: 220 });
    expect(
      getTutorialCameraTarget({ ...options, step: "orbit", mode: "gravity" })
        .center,
    ).toEqual({ x: 500, y: 200 });
  });
  it("keeps split selection close before switching to the flight overview", () => {
    expect(
      getTutorialCameraTarget({ ...options, step: "practice-split" }).center,
    ).toEqual({ x: 120, y: 300 });
    expect(
      getTutorialCameraTarget({
        ...options,
        step: "practice-split",
        shotMode: 3,
      }),
    ).toEqual(options.overview);
    expect(getTutorialCameraTarget({ ...options, step: "launch" })).toEqual(
      options.overview,
    );
  });
  it("falls back to overview for missing forces and stays finite for tiny areas", () => {
    expect(
      getTutorialCameraTarget({ ...options, step: "forces", bodies: [] }),
    ).toEqual(options.overview);
    const camera = getTutorialCameraTarget({
      ...options,
      area: { width: 0, height: 0 },
    });
    expect(Number.isFinite(camera.scale)).toBe(true);
    expect(camera.scale).toBeGreaterThan(0);
  });
});

describe("tutorial camera transitions", () => {
  const start = { center: { x: 0, y: 0 }, scale: 1 };
  const target = { center: { x: 100, y: -80 }, scale: 2 };
  it("eases without overshoot and completes at the exact target", () => {
    const rig = new TutorialCameraRig(start);
    rig.setTarget(target);
    expect(rig.transitioning).toBe(true);
    for (let i = 0; i < 44; i++) {
      const camera = rig.update(1 / 60);
      expect(camera.center.x).toBeGreaterThanOrEqual(0);
      expect(camera.center.x).toBeLessThanOrEqual(100);
      expect(camera.scale).toBeGreaterThanOrEqual(1);
      expect(camera.scale).toBeLessThanOrEqual(2);
    }
    expect(rig.camera).toEqual(target);
    expect(rig.transitioning).toBe(false);
  });
  it("retargets continuously from the displayed camera", () => {
    const rig = new TutorialCameraRig(start);
    rig.setTarget(target);
    for (let i = 0; i < 10; i++) rig.update(1 / 60);
    const before = rig.camera;
    rig.setTarget({ center: { x: -50, y: 70 }, scale: 0.5 });
    expect(rig.camera).toEqual(before);
    const after = rig.update(1 / 60);
    expect(after.center.x).toBeLessThan(before.center.x);
    expect(Math.abs(after.center.x - before.center.x)).toBeLessThan(1);
  });
  it("does not restart an unchanged target on each render", () => {
    const rig = new TutorialCameraRig(start);
    for (let i = 0; i < 44; i++) {
      rig.setTarget(target);
      rig.update(1 / 60);
    }
    expect(rig.camera).toEqual(target);
    expect(rig.transitioning).toBe(false);
  });
  it("ignores invalid time and caps suspended-frame jumps", () => {
    const rig = new TutorialCameraRig(start);
    rig.setTarget(target);
    for (const dt of [NaN, Infinity, -1, 0])
      expect(rig.update(dt)).toEqual(start);
    expect(rig.update(100).center.x).toBeLessThan(5);
    expect(rig.transitioning).toBe(true);
  });
  it("snaps immediately for reduced motion or a viewport reset", () => {
    const rig = new TutorialCameraRig(start);
    rig.setTarget(target, true);
    expect(rig.camera).toEqual(target);
    expect(rig.transitioning).toBe(false);
    rig.setTarget(start);
    rig.snap(target);
    expect(rig.update(1 / 60)).toEqual(target);
    expect(rig.transitioning).toBe(false);
  });
  it("returns owned snapshots so callers cannot mutate its transition", () => {
    const rig = new TutorialCameraRig(start);
    rig.camera.center.x = 900;
    const supplied = structuredClone(target);
    rig.setTarget(supplied);
    supplied.center.x = 900;
    expect(rig.update(0)).toEqual(start);
    for (let i = 0; i < 44; i++) rig.update(1 / 60);
    expect(rig.camera).toEqual(target);
  });
});
