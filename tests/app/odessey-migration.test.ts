import { afterEach, expect, it, vi } from "vitest";
import { tutorialSeen, tutorialKeys } from "../../src/tutorial/state";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

it.each(["complete", "skipped"])(
  "preserves a previously %s Zen walkthrough",
  (result) => {
    localStorage.setItem("orbit.walkthrough.zen.v1", result);
    expect(tutorialSeen("odessey")).toBe(true);
    expect(localStorage.getItem(tutorialKeys.odessey)).toBe(result);
  },
);

it("keeps the existing tutorial result even if writing its new key fails", () => {
  localStorage.setItem("orbit.walkthrough.zen.v1", "complete");
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("full");
  });
  expect(tutorialSeen("odessey")).toBe(true);
});
