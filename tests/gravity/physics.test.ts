import { describe, expect, it } from "vitest";
import {
  gravityForceAt,
  gravityLaunchPower,
  gravityLaunchSpeed,
} from "../../src/gravity/physics";
import { launchSpeed } from "../../src/game/physics";
import { getGravityLevel } from "../../src/gravity/campaign";
import { buildEndlessGravityLevel } from "../../src/gravity/endless";
import endlessFixtures from "../../src/gravity/endless-fixtures.json";

describe("Gravity physical units", () => {
  it("adds a modest full-pull boost without changing gentle shots or Zen", () => {
    expect(launchSpeed(1)).toBe(420);
    expect(gravityLaunchSpeed(0.5)).toBeCloseTo(210);
    expect(gravityLaunchSpeed(0.8)).toBeCloseTo(336);
    expect(gravityLaunchSpeed(0.9)).toBeCloseTo(398);
    expect(gravityLaunchSpeed(1)).toBeCloseTo(460);
    expect(gravityLaunchSpeed(0)).toBe(0);
    expect(gravityLaunchSpeed(2)).toBeCloseTo(460);
    expect(gravityLaunchSpeed(-1)).toBe(0);
  });
  it("keeps physical launch speed continuous and increasing through the boost", () => {
    let previous = gravityLaunchSpeed(0);
    for (let n = 1; n <= 1000; n++) {
      const speed = gravityLaunchSpeed(n / 1000);
      expect(speed).toBeGreaterThan(previous);
      expect(speed - previous).toBeLessThan(0.73);
      if (n <= 800) expect(speed).toBe(launchSpeed(n / 1000));
      previous = speed;
    }
  });
  it("converts authored speeds back to power across the entire launch range", () => {
    for (const power of [0, 0.25, 0.5, 0.8, 0.85, 0.9, 0.95, 1]) {
      expect(gravityLaunchPower(gravityLaunchSpeed(power))).toBeCloseTo(
        power,
        12,
      );
    }
    expect(gravityLaunchPower(-10)).toBe(0);
    expect(gravityLaunchPower(1000)).toBe(1);
    expect(gravityLaunchPower(NaN)).toBe(0);
  });
  it("preserves every campaign and endless fixture velocity when launched by its power", () => {
    const levels = [
      ...Array.from({ length: 45 }, (_, index) => getGravityLevel(42, index)),
      ...Object.keys(endlessFixtures).map((id) =>
        buildEndlessGravityLevel(42, 45, id, 0),
      ),
    ];
    for (const level of levels) {
      for (const shot of level.witness) {
        const speed = Math.hypot(shot.velocity!.x, shot.velocity!.y);
        expect(shot.power).toBeLessThan(0.8);
        expect(shot.power).toBe(speed / 420);
        expect(gravityLaunchSpeed(shot.power)).toBeCloseTo(speed, 10);
      }
    }
  });
  it("uses softened physical acceleration with opposite signs for attractors and repellents", () => {
    const body = {
      id: "well",
      kind: "attractor" as const,
      position: { x: 100, y: 0 },
      radius: 20,
      strength: 1000000,
    };
    expect(gravityForceAt({ x: 0, y: 0 }, [body]).x).toBeCloseTo(
      86.20689655172413,
      10,
    );
    expect(
      gravityForceAt({ x: 0, y: 0 }, [{ ...body, kind: "repellent" }]).x,
    ).toBeCloseTo(-86.20689655172413, 10);
  });
});
