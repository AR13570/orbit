import { describe, expect, it } from "vitest";
import { bodyStrength } from "../../src/game/physics";
import { gravityForceAt } from "../../src/gravity/physics";
import { snapPosition } from "../../src/gravity/creator/controls";
import {
  newDraft,
  parseDraft,
  toGravityLevel,
} from "../../src/gravity/creator/model";

describe("creator alignment snapping", () => {
  it("chooses the closest centre on each axis even when another reference is also nearby", () => {
    const level = newDraft();
    level.bodies.push(
      { ...level.bodies[0], id: "body-2", position: { x: 456, y: 300 } },
      { ...level.bodies[0], id: "body-3", position: { x: 200, y: 655 } },
    );
    expect(
      snapPosition(level, "body-1", { x: 454, y: 653 }, 10).position,
    ).toEqual({ x: 456, y: 655 });
  });
  it("does not snap to the dragged object's own centre", () => {
    const level = newDraft();
    level.bodies[0].position = { x: 330, y: 450 };
    expect(snapPosition(level, "body-1", { x: 336, y: 455 }, 10)).toEqual({
      position: { x: 336, y: 455 },
      axes: {},
    });
  });
  it("ignores reference axes that would place the dragged body outside the field", () => {
    const level = newDraft();
    level.bodies[0].radius = 80;
    level.bodies.push({
      ...level.bodies[0],
      id: "body-2",
      radius: 16,
      position: { x: 30, y: 300 },
    });
    expect(snapPosition(level, "body-1", { x: 82, y: 200 }, 60)).toEqual({
      position: { x: 82, y: 200 },
      axes: {},
    });
  });
});

describe("independent creator gravity", () => {
  it("preserves a custom strength through saving and playtest conversion", () => {
    const draft = newDraft();
    draft.bodies[0].strength *= 3;
    expect(
      parseDraft(JSON.parse(JSON.stringify(draft))).bodies[0].strength,
    ).toBe(draft.bodies[0].strength);
    expect(toGravityLevel(draft).bodies[0].strength).toBe(
      draft.bodies[0].strength,
    );
    expect(() =>
      parseDraft({
        ...draft,
        bodies: [{ ...draft.bodies[0], strength: Infinity }],
      }),
    ).toThrow();
  });
  it("changes pull independently of collision size and preserves repulsion", () => {
    const body = newDraft().bodies[0],
      position = { x: 750, y: 450 };
    const base = gravityForceAt(position, [body]);
    expect(gravityForceAt(position, [{ ...body, radius: 80 }])).toEqual(base);
    expect(
      gravityForceAt(position, [{ ...body, strength: body.strength * 2 }]).x,
    ).toBeCloseTo(base.x * 2);
    expect(
      gravityForceAt(position, [{ ...body, kind: "repellent" }]).x,
    ).toBeCloseTo(-base.x);
  });
  it("migrates stored bodies without explicit strength using their original size", () => {
    const draft = newDraft();
    const { strength: _strength, ...legacy } = draft.bodies[0];
    expect(parseDraft({ ...draft, bodies: [legacy] }).bodies[0].strength).toBe(
      bodyStrength(legacy.radius),
    );
  });
});
