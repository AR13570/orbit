import { it, expect } from "vitest";
import { FeedbackClock } from "../../src/transitions";
it("advances once after active dock feedback and waits while paused", () => {
  const clock = new FeedbackClock();
  expect(clock.step("docked", 0.3, true)).toBeNull();
  expect(clock.step("docked", 10, false)).toBeNull();
  expect(clock.step("docked", 0.36, true)).toBe("advance");
  expect(clock.step("docked", 1, true)).toBeNull();
  expect(clock.step("aiming", 0.1, true)).toBeNull();
  expect(clock.step("failed", 0.66, true)).toBe("retry");
});
