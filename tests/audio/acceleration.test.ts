import { describe, expect, it } from "vitest";
import { AccelerationSoundTracker } from "../../src/audio/acceleration";

const particle = (speed: number, id = 1, x = 0) => ({
  id,
  alive: true,
  position: { x, y: 0 },
  velocity: { x: speed, y: 0 },
});
function observe(speeds: number[]) {
  const tracker = new AccelerationSoundTracker();
  return speeds.map((speed, i) => tracker.sample([particle(speed)], i * 0.06));
}

describe("selective gravity sound", () => {
  it("stays quiet for initial velocity, constant speed, turning and deceleration", () => {
    expect(
      observe([300, 300, 300, 300, 300, 300, 300]).filter(Boolean),
    ).toEqual([]);
    expect(
      observe([300, 290, 275, 260, 245, 230, 210]).filter(Boolean),
    ).toEqual([]);
    const tracker = new AccelerationSoundTracker();
    for (let i = 0; i < 10; i++)
      expect(
        tracker.sample(
          [
            {
              ...particle(100),
              velocity: { x: Math.cos(i) * 100, y: Math.sin(i) * 100 },
            },
          ],
          i * 0.06,
        ),
      ).toBeNull();
  });
  it("ignores gentle drift but emits a bounded swell for a notable speed gain", () => {
    expect(
      observe([100, 101, 102, 103, 104, 105, 106]).filter(Boolean),
    ).toEqual([]);
    const cues = observe([100, 100, 100, 110, 125, 145, 165, 180]).filter(
      Boolean,
    );
    expect(cues).toHaveLength(1);
    expect(cues[0]!.intensity).toBeGreaterThan(0);
    expect(cues[0]!.intensity).toBeLessThanOrEqual(1);
  });
  it("selects the strongest crowded-sky gain once and does not repeat a sustained acceleration", () => {
    const tracker = new AccelerationSoundTracker();
    const cues = [];
    for (let i = 0; i < 40; i++) {
      const cue = tracker.sample(
        Array.from({ length: 128 }, (_, id) =>
          particle(100 + i * (id === 80 ? 30 : 15), id),
        ),
        i * 0.06,
      );
      if (cue) cues.push(cue);
    }
    expect(cues).toHaveLength(1);
    expect(cues[0].particleId).toBe(80);
  });
  it("warms new split IDs and forgets reset, teleport and pause gaps", () => {
    const tracker = new AccelerationSoundTracker();
    tracker.sample([particle(100)], 0);
    tracker.sample([particle(100)], 0.06);
    expect(tracker.sample([particle(100), particle(900, 2)], 0.12)).toBeNull();
    expect(tracker.sample([particle(500, 1, 5000)], 0.18)).toBeNull();
    expect(tracker.sample([particle(900)], 2)).toBeNull();
    expect(tracker.sample([particle(1200)], 0)).toBeNull();
    tracker.reset();
    expect(tracker.sample([particle(1800)], 0.06)).toBeNull();
  });
  it("ignores isolated collision impulses and speed assignment discontinuities", () => {
    expect(observe([100, 105, 110, 115, 140, 145]).filter(Boolean)).toEqual([]);
    expect(
      observe([100, 100, 100, 600, 600, 600, 600, 600]).filter(Boolean),
    ).toEqual([]);
    expect(
      observe([100, 100, 100, 100, 600, 602, 604, 606]).filter(Boolean),
    ).toEqual([]);
  });
  it("uses physical snapshot time independently of the wall-clock playback speed", () => {
    const sampleRun = (playback: number) => {
      const tracker = new AccelerationSoundTracker();
      const cues = [];
      for (let frame = 0; frame < 100; frame++) {
        const physical = (frame / 60) * playback;
        const cue = tracker.sample([particle(100 + physical * 300)], physical);
        if (cue) cues.push(cue);
      }
      return cues;
    };
    expect(sampleRun(1)).toHaveLength(1);
    expect(sampleRun(1.65)).toHaveLength(1);
  });
  it("rearms only after calm motion and a cooldown", () => {
    const tracker = new AccelerationSoundTracker();
    const cues = [];
    for (let i = 0; i < 70; i++) {
      const speed = i < 8 ? 100 + i * 20 : i < 48 ? 240 : 240 + (i - 48) * 30;
      const cue = tracker.sample([particle(speed)], i * 0.06);
      if (cue) cues.push(cue);
    }
    expect(cues).toHaveLength(2);
  });
});
