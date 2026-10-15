import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadGravityProgress,
  recordGravityCompletion,
  saveGravityProgress,
  setGravityCurrentIndex,
} from "../../src/gravity/progress";
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});
describe("Gravity-only progress", () => {
  it("tolerates disabled browser storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("disabled");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("disabled");
    });
    expect(loadGravityProgress(7).currentIndex).toBe(0);
    expect(() => saveGravityProgress(loadGravityProgress(7))).not.toThrow();
  });
  it("persists completion and resumes the next level without changing the input", () => {
    const initial = loadGravityProgress(42),
      next = recordGravityCompletion(initial, 0);
    expect(initial.completedIndices).toEqual([]);
    expect(next.currentIndex).toBe(1);
    saveGravityProgress(next);
    expect(loadGravityProgress(42)).toEqual(next);
    expect(loadGravityProgress(7).completedIndices).toEqual([]);
  });
  it("supports penalty-free skips without claiming completion", () => {
    const progress = setGravityCurrentIndex(loadGravityProgress(1), 45);
    expect(progress.unlockedIndex).toBe(45);
    expect(progress.completedIndices).toEqual([]);
  });
  it("recovers corrupt and invalid state safely", () => {
    localStorage.setItem("orbit.gravity.progress.v1:42", "broken");
    expect(loadGravityProgress(42).currentIndex).toBe(0);
    saveGravityProgress({
      version: 1,
      seed: 42,
      currentIndex: -9,
      unlockedIndex: NaN,
      completedIndices: [1, 1, -3, Infinity],
    });
    expect(loadGravityProgress(42)).toMatchObject({
      currentIndex: 0,
      completedIndices: [1],
    });
  });
});
