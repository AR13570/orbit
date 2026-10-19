import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import GravityGame from "../../src/gravity/GravityGame";
import { GravityEngine } from "../../src/gravity/engine";
import { newDraft, toGravityLevel } from "../../src/gravity/creator/model";
const { panBy } = vi.hoisted(() => ({ panBy: vi.fn() }));
vi.mock("../../src/gravity/renderer", () => ({
  createGravityRenderer: () => ({
    resize() {},
    render() {},
    destroy() {},
    getScale: () => 1,
    screenToWorld: (x: number, y: number) => ({ x, y }),
    setZoom() {},
    resetPan() {},
    panBy,
  }),
}));
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("orbit.walkthrough.gravity.v2", "complete");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
  panBy.mockClear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function mouse(c: HTMLElement, type: string, x: number, y: number) {
  const e = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
  Object.defineProperties(e, {
    pointerId: { value: 1 },
    pointerType: { value: "mouse" },
    isPrimary: { value: true },
  });
  fireEvent(c, e);
}
it("Space-drag pans Gravity without launching, and offers reset view", () => {
  const draft = newDraft();
  draft.bodies = [];
  const launch = vi.spyOn(GravityEngine.prototype, "launch");
  render(<GravityGame onExit={() => {}} customLevel={toGravityLevel(draft)} />);
  const canvas = screen.getByLabelText(
    "Gravity orbital field",
  ) as HTMLCanvasElement;
  canvas.setPointerCapture = vi.fn();
  canvas.hasPointerCapture = () => false;
  fireEvent.keyDown(window, { key: " ", code: "Space" });
  mouse(canvas, "pointerdown", 150, 250);
  mouse(canvas, "pointermove", 190, 275);
  mouse(canvas, "pointerup", 190, 275);
  fireEvent.keyUp(window, { key: " ", code: "Space" });
  expect(panBy).toHaveBeenCalledWith(40, 25);
  expect(launch).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Reset view" })).toBeTruthy();
  mouse(canvas, "pointerdown", 150, 250);
  mouse(canvas, "pointerup", 150, 280);
  expect(launch).toHaveBeenCalledTimes(1);
});
