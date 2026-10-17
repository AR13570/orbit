import { afterEach, expect, it } from "vitest";
import { OrbitEngine } from "../../src/game/engine";
import { saveOdesseyCheckpoint } from "../../src/game/progress";
import { saveGravityProgress } from "../../src/gravity/progress";
import { readHomeProgress } from "../../src/home/progress";

afterEach(() => localStorage.clear());
it("does not create a universe or save when opening a fresh menu", () => {
  expect(readHomeProgress("")).toEqual({ odessey: null, gravity: null });
  expect(localStorage.length).toBe(0);
});
it("shows each mode's own saved position", () => {
  localStorage.setItem("orbit.odessey.default-seed.v1", "42");
  localStorage.setItem("orbit.gravity.default-seed.v1", "7");
  saveOdesseyCheckpoint(new OrbitEngine(42, 5).getCheckpoint());
  saveGravityProgress({
    version: 1,
    seed: 7,
    currentIndex: 8,
    unlockedIndex: 8,
    completedIndices: [0],
  });
  expect(readHomeProgress("")).toEqual({
    odessey: "Checkpoint 4",
    gravity: "Level 9",
  });
});
it("uses an explicit seed instead of another universe's progress", () => {
  localStorage.setItem("orbit.odessey.default-seed.v1", "42");
  saveOdesseyCheckpoint(new OrbitEngine(42, 5).getCheckpoint());
  expect(readHomeProgress("?seed=7").odessey).toBeNull();
});
it("ignores malformed saved progress", () => {
  localStorage.setItem("orbit.gravity.default-seed.v1", "42");
  localStorage.setItem("orbit.gravity.progress.v1:42", "{}");
  expect(readHomeProgress("").gravity).toBeNull();
});
