import { afterEach, describe, expect, it, vi } from "vitest";
import { AimHaptics } from "../../src/haptics";
afterEach(() => vi.restoreAllMocks());
describe("touch aim feedback", () => {
  it("acknowledges deliberate valid aim once, then a confirmed shot", () => {
    const vibrate = vi.fn(() => true);
    const feedback = new AimHaptics({ vibrate });
    feedback.begin("touch");
    feedback.aim(7, true);
    feedback.aim(12, false);
    expect(vibrate).not.toHaveBeenCalled();
    feedback.aim(12, true);
    feedback.aim(30, true);
    feedback.release(true);
    expect(vibrate.mock.calls).toEqual([[6], [10]]);
  });
  it("suppresses feedback for mouse, cancelled taps and blocked releases", () => {
    const vibrate = vi.fn(() => true);
    const feedback = new AimHaptics({ vibrate });
    feedback.begin("mouse");
    feedback.aim(20, true);
    feedback.release(true);
    feedback.begin("touch");
    feedback.cancel();
    feedback.aim(20, true);
    feedback.release(true);
    feedback.begin("touch");
    feedback.release(false);
    expect(vibrate).not.toHaveBeenCalled();
  });
  it("safely tolerates missing, rejected and throwing vibration APIs", () => {
    for (const device of [
      {},
      { vibrate: () => false },
      {
        vibrate: () => {
          throw new Error("unavailable");
        },
      },
    ]) {
      const feedback = new AimHaptics(device);
      expect(() => {
        feedback.begin("touch");
        feedback.aim(20, true);
        feedback.release(true);
      }).not.toThrow();
    }
  });
});
