import { describe, it, expect, vi } from "vitest";
import {
  PullGesture,
  TapSequence,
  runSeed,
  pullDistance,
} from "../../src/controls";
describe("pullback gestures", () => {
  it("lets an unlimited handle follow the pointer beyond its reference distance", () => {
    const gesture = new PullGesture(100, { unlimitedPull: true });
    gesture.begin(1, { x: 200, y: 200 });
    const aim = gesture.move(1, { x: -100, y: 600 })!;
    expect(aim.pull).toEqual({ x: -300, y: 400 });
    expect(aim.distance).toBe(500);
    expect(aim.power).toBe(5);
    expect(gesture.end(1, { x: -100, y: 600 })).toEqual(aim);
  });
  it.each([72, 160])(
    "caps the visible handle at the %ipx full-power extent during move and release",
    (limit) => {
      const gesture = new PullGesture(limit);
      gesture.begin(1, { x: 0, y: 0 });
      const atLimit = gesture.move(1, { x: limit * 0.6, y: limit * 0.8 })!;
      const beyond = gesture.move(1, { x: limit * 6, y: limit * 8 })!;
      expect(beyond.power).toBe(1);
      expect(beyond.distance).toBeCloseTo(limit * 10);
      expect(beyond.pull.x).toBeCloseTo(atLimit.pull.x);
      expect(beyond.pull.y).toBeCloseTo(atLimit.pull.y);
      const release = gesture.end(1, { x: limit * 60, y: limit * 80 })!;
      expect(release.power).toBe(1);
      expect(Math.hypot(release.pull.x, release.pull.y)).toBeCloseTo(limit);
    },
  );
  it("reaches actual full power with a comfortable 72px mobile pull in either orientation", () => {
    for (const [width, height] of [
      [390, 844],
      [844, 390],
      [320, 568],
    ]) {
      const distance = pullDistance("touch", width, height);
      expect(distance).toBe(72);
      const gesture = new PullGesture(distance);
      gesture.begin(1, { x: 90, y: 200 });
      expect(gesture.end(1, { x: 18, y: 200 })?.power).toBe(1);
    }
    expect(pullDistance("mouse", 1440, 900)).toBe(160);
  });
  it("does not jump on down and fires opposite the drag on release", () => {
    const g = new PullGesture(160);
    g.begin(1, { x: 200, y: 200 });
    expect(g.move(1, { x: 200, y: 200 })?.power).toBe(0);
    const shot = g.end(1, { x: 120, y: 200 });
    expect(shot?.angle).toBeCloseTo(0);
    expect(shot?.power).toBe(0.5);
    expect(g.end(1, { x: 120, y: 200 })).toBeNull();
  });
  it("clamps screen-pixel power and cancels taps", () => {
    const g = new PullGesture(120);
    g.begin(1, { x: 10, y: 10 });
    expect(g.end(1, { x: 15, y: 12 })).toBeNull();
    g.begin(2, { x: 200, y: 200 });
    expect(g.end(2, { x: 200, y: 500 })?.power).toBe(1);
  });
  it("ignores additional pointers and cancels without a shot", () => {
    const g = new PullGesture(160);
    g.begin(1, { x: 200, y: 200 });
    expect(g.begin(2, { x: 0, y: 0 })).toBe(false);
    expect(g.move(2, { x: 100, y: 100 })).toBeNull();
    expect(g.end(2, { x: 100, y: 100 })).toBeNull();
    g.cancel();
    expect(g.end(1, { x: 100, y: 100 })).toBeNull();
  });
  it("supports arbitrary inverted direction", () => {
    const g = new PullGesture(160);
    g.begin(7, { x: 100, y: 100 });
    expect(g.end(7, { x: 100, y: 180 })?.angle).toBeCloseTo(-Math.PI / 2);
  });
});
describe("shareable seed", () => {
  it("accepts finite shareable seeds", () => {
    expect(runSeed("?seed=42")).toBe(42);
    expect(runSeed("?seed=Infinity")).toBeUndefined();
    expect(runSeed("?seed=")).toBeUndefined();
  });
});

describe("double-tap mode sequence", () => {
  it("toggles once for two nearby taps within 300ms", () => {
    const taps = new TapSequence();
    expect(taps.tap({ x: 100, y: 100 }, 100)).toBe(false);
    expect(taps.tap({ x: 112, y: 112 }, 400)).toBe(true);
    expect(taps.tap({ x: 112, y: 112 }, 450)).toBe(false);
  });
  it("rejects distant or late taps and clears interrupted sequences", () => {
    const taps = new TapSequence();
    taps.tap({ x: 0, y: 0 }, 0);
    expect(taps.tap({ x: 25, y: 0 }, 100)).toBe(false);
    expect(taps.tap({ x: 25, y: 0 }, 401)).toBe(false);
    taps.reset();
    expect(taps.tap({ x: 25, y: 0 }, 450)).toBe(false);
  });
  it("rejects a long held pointer as a tap", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(0);
    try {
      const pull = new PullGesture(160);
      pull.begin(1, { x: 100, y: 100 });
      now.mockReturnValue(251);
      expect(pull.tapEligible).toBe(false);
      expect(pull.end(1, { x: 100, y: 100 })).toBeNull();
    } finally {
      now.mockRestore();
    }
  });
  it("does not treat an out-and-back drag as a tiny tap", () => {
    const pull = new PullGesture(160);
    pull.begin(1, { x: 100, y: 100 });
    pull.move(1, { x: 120, y: 100 });
    pull.move(1, { x: 100, y: 100 });
    expect(pull.tapEligible).toBe(false);
    expect(pull.end(1, { x: 100, y: 100 })).toBeNull();
  });
});

it("allows an explicit no-power tap but never turns an out-and-back drag into one", () => {
  const gesture = new PullGesture(160);
  gesture.begin(1, { x: 100, y: 100 });
  expect(gesture.end(1, { x: 102, y: 101 }, { allowTap: true })?.power).toBe(0);
  gesture.begin(2, { x: 100, y: 100 });
  gesture.move(2, { x: 150, y: 100 });
  expect(gesture.end(2, { x: 100, y: 100 }, { allowTap: true })).toBeNull();
});
