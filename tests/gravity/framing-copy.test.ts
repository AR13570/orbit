import { describe, expect, it } from "vitest";
import { getGravityLevel } from "../../src/gravity/campaign";
import { fitGravityFrame } from "../../src/gravity/renderer";
import { worldToClient } from "../../src/render/coordinates";
import { objectiveText } from "../../src/gravity/simulation";

describe("Gravity content framing", () => {
  it.each([0, 1])(
    "makes early level %i cores readable on a desktop without changing world geometry",
    (index) => {
      const level = getGravityLevel(42, index),
        before = structuredClone(level);
      const frame = fitGravityFrame(level, 1280, 720, false);
      for (const body of level.bodies)
        expect(body.radius * frame.camera.scale * 2).toBeGreaterThanOrEqual(48);
      for (const body of level.bodies)
        expect(body.radius * frame.camera.scale * 2).toBeLessThanOrEqual(100);
      expect(level).toEqual(before);
    },
  );
  for (const [width, height, touch] of [
    [1280, 720, false],
    [390, 844, true],
    [844, 390, true],
  ] as const) {
    it(`fits core markers and goal counts outside the HUD at ${width}x${height}`, () => {
      for (const index of [0, 6, 17, 28, 39, 44]) {
        const level = getGravityLevel(42, index),
          { camera, area } = fitGravityFrame(level, width, height, touch);
        for (const body of level.bodies) {
          const positions = [body.position],
            motion = level.motions?.find((path) => path.bodyId === body.id);
          if (motion)
            for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
              positions.push(
                motion.kind === "circle"
                  ? {
                      x:
                        motion.center.x +
                        Math.cos(angle) * (motion.radius ?? 0),
                      y:
                        motion.center.y +
                        Math.sin(angle) * (motion.radius ?? 0),
                    }
                  : {
                      x:
                        motion.center.x +
                        Math.sin(angle) * (motion.amplitude?.x ?? 0),
                      y:
                        motion.center.y +
                        Math.sin(angle) * (motion.amplitude?.y ?? 0),
                    },
              );
          for (const position of positions) {
            const center = worldToClient(
                position,
                {
                  left: area.x,
                  top: area.y,
                  width: area.width,
                  height: area.height,
                },
                camera,
              ),
              radius = body.radius * camera.scale;
            expect(center.x - radius - 12).toBeGreaterThanOrEqual(area.x);
            expect(center.x + radius + 12).toBeLessThanOrEqual(
              area.x + area.width,
            );
            expect(center.y - radius - 24).toBeGreaterThanOrEqual(area.y);
            expect(center.y + radius + 26).toBeLessThanOrEqual(
              area.y + area.height,
            );
          }
        }
      }
    });
  }
  it("uses the field height for a square formation rather than shrinking it to a fixed world square", () => {
    const level = getGravityLevel(42, 17),
      { camera, area } = fitGravityFrame(level, 1280, 720, false);
    const top = Math.min(
      ...level.bodies.map((body) => body.position.y - body.radius),
    );
    const bottom = Math.max(
      ...level.bodies.map((body) => body.position.y + body.radius),
    );
    expect((bottom - top) * camera.scale).toBeGreaterThan(area.height * 0.6);
  });
});
describe("Gravity objective copy", () => {
  it("summarizes identical goals without repeating every core", () => {
    const text = objectiveText(getGravityLevel(42, 17));
    expect(text.startsWith("Keep 1 planet orbiting each core.")).toBe(true);
    expect(text.length).toBeLessThan(80);
    expect(text).not.toContain(" · ");
  });
  it("describes the final ordered return and full capture without a timed wait", () => {
    const text = objectiveText(getGravityLevel(42, 44));
    expect(text).toContain("A → B → C → A");
    expect(text).toContain("full orbit at A");
    expect(text).not.toMatch(/hold|seconds/i);
  });
  it("identifies the intended central core instead of implying every surrounding core is a target", () => {
    const text = objectiveText(getGravityLevel(42, 21));
    expect(text).toContain("around core A");
    expect(text).not.toContain("each core");
  });
  it("keeps distinct per-core populations, directions and turn counts explicit", () => {
    const level = getGravityLevel(42, 6);
    level.requirements = [
      {
        bodyId: level.bodies[0].id,
        count: 2,
        turns: 2,
        direction: "clockwise",
      },
      { bodyId: level.bodies[1].id, count: 3 },
    ];
    const text = objectiveText(level);
    expect(text).toContain(
      "2 planets around core A clockwise for 2 revolutions",
    );
    expect(text).toContain("3 planets around core B");
  });
});
