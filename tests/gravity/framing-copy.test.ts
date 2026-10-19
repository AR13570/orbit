import { describe, expect, it } from "vitest";
import { getGravityLevel } from "../../src/gravity/campaign";
import { fitGravityFrame } from "../../src/gravity/renderer";
import { worldToClient } from "../../src/render/coordinates";
import { newDraft, toGravityLevel } from "../../src/gravity/creator/model";
import { objectiveText } from "../../src/gravity/simulation";
import { corePositionLabel } from "../../src/gravity/core-position-label";

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
        expect(body.radius * frame.camera.scale * 2).toBeLessThanOrEqual(
          frame.area.height,
        );
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
    const level = toGravityLevel(newDraft());
    const core = level.bodies[0];
    level.launch = { x: 450, y: 450 };
    level.orbitPadding = 80;
    level.bodies = [
      [300, 300],
      [600, 300],
      [300, 600],
      [600, 600],
    ].map(([x, y], index) => ({
      ...core,
      id: `square-${index}`,
      radius: 96,
      position: { x, y },
    }));
    const { camera, area } = fitGravityFrame(level, 1280, 720, false);
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
  it.each([2, 3, 4])(
    "states the full %i-revolution shared-orbit demand",
    (turns) => {
      const level = Array.from({ length: 45 }, (_, index) =>
        getGravityLevel(42, index),
      ).find((candidate) => candidate.sharedOrbit?.length)!;
      level.source = "procedural";
      level.objective.turns = turns;
      const text = objectiveText(level);
      expect(text).toContain("in one shared orbit");
      expect(text).toContain(`for ${turns} revolutions.`);
      level.sharedCounter = true;
      expect(objectiveText(level)).toContain(
        `in opposite directions for ${turns} revolutions.`,
      );
    },
  );
  it("summarizes uniform two-revolution populations without repeating each core", () => {
    const level = Array.from({ length: 45 }, (_, index) =>
      getGravityLevel(42, index),
    ).find((candidate) => (candidate.requirements?.length ?? 0) > 1)!;
    expect(level).toBeDefined();
    const count = level.requirements![0].count;
    const text = objectiveText(level);
    expect(text).toBe(
      `Keep ${count} ${count === 1 ? "planet" : "planets"} orbiting each core for 2 revolutions.`,
    );
    expect(text.length).toBeLessThan(80);
    expect(text).not.toContain(" · ");
  });
  it("describes full campaign orbits without partial-relay instructions or timed waits", () => {
    for (let index = 0; index < 45; index++) {
      const level = getGravityLevel(42, index);
      expect(level.objective.turns).toBeGreaterThanOrEqual(2);
      expect(
        level.requirements?.every(
          (goal) => (goal.turns ?? level.objective.turns) >= 2,
        ) ?? true,
      ).toBe(true);
      expect(level.journey).toBeUndefined();
      expect(objectiveText(level)).not.toMatch(
        /curve past|full orbit at|hold|seconds|core [A-Z]/,
      );
    }
  });
  it("includes every attractive core without treating surrounding repellers as orbit targets", () => {
    const level = Array.from({ length: 45 }, (_, index) =>
      getGravityLevel(42, index),
    ).find(
      (candidate) =>
        candidate.bodies.some((body) => body.kind === "repellent") &&
        candidate.bodies.filter((body) => body.kind === "attractor").length >
          1 &&
        !!candidate.requirements,
    )!;
    expect(level).toBeDefined();
    const targets = level.bodies.filter((body) => body.kind === "attractor");
    expect(level.requirements!.map((goal) => goal.bodyId).sort()).toEqual(
      targets.map((body) => body.id).sort(),
    );
    expect(objectiveText(level)).toContain("each core for 2 revolutions");
    expect(objectiveText(level)).not.toMatch(/core [A-Z]|repeller/);
  });
  it("keeps explicitly authored custom populations, directions and turn counts clear", () => {
    const level = toGravityLevel(newDraft());
    level.bodies.push({
      ...structuredClone(level.bodies[0]),
      id: "second-core",
      position: { x: 650, y: 450 },
    });
    level.objective.turns = 2;
    level.requirements = [
      {
        bodyId: level.bodies[0].id,
        count: 2,
        turns: 2,
        direction: "clockwise",
      },
      {
        bodyId: level.bodies[1].id,
        count: 3,
        turns: 3,
        direction: "counterclockwise",
      },
    ];
    const text = objectiveText(level);
    expect(text).toContain(
      "2 planets around the leftmost core clockwise for 2 revolutions",
    );
    expect(text).toContain(
      "3 planets around the rightmost core counterclockwise for 3 revolutions",
    );
  });
  it("identifies spatial targets independently of body ordering and ignores repellers", () => {
    const level = toGravityLevel(newDraft());
    const core = level.bodies[0];
    level.bodies = [
      { ...core, id: "bottom", position: { x: 450, y: 700 } },
      { ...core, id: "top", position: { x: 450, y: 200 } },
      { ...core, id: "middle", position: { x: 450, y: 450 } },
      {
        ...core,
        id: "repel",
        kind: "repellent",
        position: { x: -2000, y: 300 },
      },
    ];
    const before = structuredClone(level.bodies);
    expect(corePositionLabel(level, "top")).toBe("the uppermost core");
    expect(corePositionLabel(level, "middle")).toBe("the middle core");
    expect(corePositionLabel(level, "bottom")).toBe("the lowermost core");
    expect(level.bodies).toEqual(before);
    level.journey = {
      legs: [
        { bodyId: "bottom", radius: 100, sweep: Math.PI },
        { bodyId: "top", radius: 100, sweep: 2 * Math.PI },
      ],
    };
    expect(objectiveText(level)).toContain(
      "the lowermost core → the uppermost core",
    );
    expect(objectiveText(level)).toContain(
      "Finish a full orbit at the uppermost core.",
    );
  });
});
