import { describe, expect, it, vi } from "vitest";
import {
  drawGravityCore,
  gravityCoreLabelStyle,
} from "../../src/gravity/core-label";
import type { Body } from "../../src/game/types";

describe("Gravity core counters", () => {
  it("prioritizes a semibold current count over tiny light chevrons", () => {
    const style = gravityCoreLabelStyle(40, 1, 1);
    expect(style.fontSize).toBe(14);
    expect(style.symbolHeight).toBe(6);
    expect(style.strokeWidth).toBe(1);
    expect(style.symbolOpacity).toBe(0.65);
    expect(style.gap).toBe(4);
  });
  it("fits two-digit counts inside smaller physical faces without enlarging their collision surface", () => {
    for (const scale of [0.25, 0.5, 1, 2]) {
      const style = gravityCoreLabelStyle(48, scale, 12);
      expect(style.estimatedContentWidth).toBeLessThanOrEqual(
        48 * scale * 1.25,
      );
      expect(style.fontSize).toBeGreaterThan(0);
    }
  });
  it("draws only the current number without a core name or target fraction", () => {
    const context = new Proxy(
      {
        globalAlpha: 1,
        measureText: () => ({
          width: 10,
          actualBoundingBoxAscent: 12,
          actualBoundingBoxDescent: 2,
          actualBoundingBoxLeft: 6,
          actualBoundingBoxRight: 4,
        }),
      },
      {
        get(target: Record<string, unknown>, key: string) {
          return target[key] ?? (target[key] = vi.fn());
        },
      },
    ) as unknown as CanvasRenderingContext2D;
    const body: Body = {
      id: "well-4",
      kind: "attractor",
      position: { x: 100, y: 100 },
      radius: 48,
      strength: 2800000,
    };
    drawGravityCore(context, body, 1, 3);
    expect(context.fillText).toHaveBeenCalledWith("3", 101, 105);
    expect(context.font).toContain("600 14px");
    expect(context.arc).toHaveBeenCalledWith(100, 100, 48, 0, Math.PI * 2);
  });
  it("repellers only display subtle outward symbols", () => {
    const context = new Proxy(
      { globalAlpha: 1 },
      {
        get(target: Record<string, unknown>, key: string) {
          return target[key] ?? (target[key] = vi.fn());
        },
      },
    ) as unknown as CanvasRenderingContext2D;
    drawGravityCore(
      context,
      {
        id: "repeller",
        kind: "repellent",
        position: { x: 0, y: 0 },
        radius: 40,
        strength: 1,
      },
      1,
      0,
    );
    expect(context.fillText).not.toHaveBeenCalled();
  });
});
