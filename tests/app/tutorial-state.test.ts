import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  finishTutorial,
  tutorialSeen,
  tutorialKeys,
} from "../../src/tutorial/state";
beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
describe("walkthrough storage", () => {
  it("remembers dismissal in this page when reads work but writes fail", async () => {
    vi.resetModules();
    const state = await import("../../src/tutorial/state");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    state.finishTutorial("zen", "skipped");
    expect(localStorage.getItem(tutorialKeys.zen)).toBeNull();
    expect(state.tutorialSeen("zen")).toBe(true);
  });
  it("stores completion and skip independently for each versioned mode", () => {
    expect(tutorialSeen("zen")).toBe(false);
    finishTutorial("zen", "complete");
    expect(localStorage.getItem(tutorialKeys.zen)).toBe("complete");
    expect(tutorialSeen("zen")).toBe(true);
    expect(tutorialSeen("gravity")).toBe(false);
    finishTutorial("gravity", "skipped");
    expect(tutorialSeen("gravity")).toBe(true);
  });
  it("ignores malformed stored values", () => {
    localStorage.setItem(tutorialKeys.zen, "false");
    expect(tutorialSeen("zen")).toBe(false);
  });
  it("keeps the guide usable when browser storage is denied", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => finishTutorial("gravity", "skipped")).not.toThrow();
    expect(tutorialSeen("gravity")).toBe(true);
  });
});
