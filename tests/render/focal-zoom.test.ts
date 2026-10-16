import { expect, it, vi } from "vitest";
import { createRenderer } from "../../src/render/renderer";
import { createGravityRenderer } from "../../src/gravity/renderer";
import { OrbitEngine } from "../../src/game/engine";
import { getGravityLevel } from "../../src/gravity/campaign";
function canvas() {
  const canvas = document.createElement("canvas");
  const context = new Proxy({} as Record<string, unknown>, {
    get: (obj, key: string) => obj[key] ?? (obj[key] = vi.fn()),
  });
  vi.spyOn(canvas, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left: 17,
    top: 29,
    width: 390,
    height: 844,
  } as DOMRect);
  return canvas;
}
for (const mode of ["odessey", "gravity"] as const) {
  it(`${mode} preserves the selected world point during zoom in and out`, () => {
    const c = canvas();
    const r = mode === "odessey" ? createRenderer(c) : createGravityRenderer(c);
    r.resize(390, 844, 1);
    if (mode === "odessey")
      (r as ReturnType<typeof createRenderer>).prepareFrame(
        new OrbitEngine(42).getSnapshot(),
        0,
        { reducedMotion: true },
      );
    else
      (r as ReturnType<typeof createGravityRenderer>).prepareFrame(
        getGravityLevel(42, 0),
      );
    const cursor = { x: 290, y: 350 };
    const selected = r.screenToWorld(cursor.x, cursor.y);
    for (const zoom of [1.2, mode === "odessey" ? 1 / 1.2 : 0.5, 1]) {
      r.setZoom(zoom, { from: cursor, to: cursor });
      const after = r.screenToWorld(cursor.x, cursor.y);
      expect(after.x).toBeCloseTo(selected.x, 8);
      expect(after.y).toBeCloseTo(selected.y, 8);
    }
    const from = { x: 180, y: 400 },
      to = { x: 220, y: 425 };
    const pinchPoint = r.screenToWorld(from.x, from.y);
    r.setZoom(1.1, { from, to });
    const afterPinch = r.screenToWorld(to.x, to.y);
    expect(afterPinch.x).toBeCloseTo(pinchPoint.x, 8);
    expect(afterPinch.y).toBeCloseTo(pinchPoint.y, 8);
    r.destroy();
  });
}
