import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App, { OdesseyGame } from "../../src/App";
import GravityGame from "../../src/gravity/GravityGame";
import { GravityEngine } from "../../src/gravity/engine";
import { OrbitEngine } from "../../src/game/engine";
import {
  PATH_ASSIST_KEY,
  readPathAssist,
  setPathAssist,
} from "../../src/pathAssist";
const renders = vi.hoisted(() => ({
  odessey: vi.fn(),
  gravity: vi.fn(),
  gravityScale: 1,
}));
let frame: FrameRequestCallback;
vi.mock("../../src/render/renderer", () => ({
  createRenderer: () => ({
    resize() {},
    prepareFrame() {},
    render: renders.odessey,
    destroy() {},
    getVisibleBounds: () => ({ x: -100, y: -100, width: 2000, height: 1200 }),
    getViewport: () => ({ scale: 1, transitioning: false }),
    setWalkthroughFocus() {},
    worldToScreen: (point: unknown) => point,
  }),
}));
vi.mock("../../src/gravity/renderer", () => ({
  createGravityRenderer: () => ({
    resize() {},
    render: renders.gravity,
    destroy() {},
    getScale: () => renders.gravityScale,
    setWalkthroughFocus() {},
    worldToScreen: (point: unknown) => point,
    screenToWorld: (x: number, y: number) => ({ x, y }),
  }),
}));
beforeEach(() => {
  localStorage.clear();
  setPathAssist("partial");
  window.history.replaceState({}, "", "/");
  localStorage.setItem("orbit.walkthrough.odessey.v1", "complete");
  localStorage.setItem("orbit.walkthrough.gravity.v2", "complete");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frame = callback;
    return 1;
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  renders.odessey.mockClear();
  renders.gravity.mockClear();
  renders.gravityScale = 1;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setPathAssist("partial");
});
describe("shared path assist preference", () => {
  it("defaults corrupted stored values to Partial", () => {
    localStorage.setItem(PATH_ASSIST_KEY, "complete-win-route");
    expect(readPathAssist()).toBe("partial");
  });
  it("keeps the chosen setting usable for both modes when storage writes fail", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    setPathAssist("full");
    expect(readPathAssist()).toBe("full");
    const view = render(<OdesseyGame />);
    fireEvent.click(screen.getByRole("button", { name: "Pause", exact: true }));
    fireEvent.click(
      screen.getByRole("button", { name: "Advanced", exact: true }),
    );
    expect(
      screen
        .getByRole("switch", { name: "Path assist", exact: true })
        .getAttribute("aria-checked"),
    ).toBe("true");
    view.unmount();
    render(<GravityGame onExit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause", exact: true }));
    fireEvent.click(
      screen.getByRole("button", { name: "Advanced", exact: true }),
    );
    expect(
      screen
        .getByRole("switch", { name: "Path assist", exact: true })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });
  it("shares both settings across mode changes without launches and preserves dialog focus wrapping", () => {
    const odessey = vi.spyOn(OrbitEngine.prototype, "launch"),
      gravity = vi.spyOn(GravityEngine.prototype, "launch");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /^OdesseyFollow/ }));
    fireEvent.click(screen.getByRole("button", { name: "Pause", exact: true }));
    fireEvent.click(
      screen.getByRole("button", { name: "Advanced", exact: true }),
    );
    const full = screen.getByRole("switch", {
      name: "Path assist",
      exact: true,
    });
    fireEvent.click(full);
    expect(localStorage.getItem(PATH_ASSIST_KEY)).toBe("full");
    fireEvent.click(
      screen.getByRole("button", { name: "Choose mode", exact: true }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^GravityBuild/ }));
    fireEvent.click(screen.getByRole("button", { name: "Pause", exact: true }));
    fireEvent.click(
      screen.getByRole("button", { name: "Advanced", exact: true }),
    );
    expect(
      screen
        .getByRole("switch", { name: "Path assist", exact: true })
        .getAttribute("aria-checked"),
    ).toBe("true");
    fireEvent.click(
      screen.getByRole("switch", { name: "Path assist", exact: true }),
    );
    expect(localStorage.getItem(PATH_ASSIST_KEY)).toBe("partial");
    const modes = screen.getByRole("button", {
      name: "Choose mode",
      exact: true,
    });
    modes.focus();
    fireEvent.keyDown(modes, { key: "Tab" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Resume", exact: true }),
    );
    expect(odessey).not.toHaveBeenCalled();
    expect(gravity).not.toHaveBeenCalled();
  });
  it("collapses Advanced each pause opening and omits hidden switches from keyboard focus", () => {
    render(<GravityGame onExit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause", exact: true }));
    const advanced = screen.getByRole("button", {
      name: "Advanced",
      exact: true,
    });
    expect(advanced.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("switch", { name: "Path assist" })).toBeNull();
    expect(
      screen.queryByRole("switch", { name: "Particle Interaction" }),
    ).toBeNull();
    fireEvent.click(advanced);
    expect(
      screen
        .getByRole("switch", { name: "Particle Interaction" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    fireEvent.click(
      screen.getByRole("button", { name: "Resume", exact: true }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Pause", exact: true }));
    expect(
      screen
        .getByRole("button", { name: "Advanced", exact: true })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(screen.queryByRole("switch", { name: "Path assist" })).toBeNull();
  });
  it("does not add settings controls to either tutorial", () => {
    localStorage.clear();
    const view = render(<OdesseyGame startTutorial />);
    expect(screen.queryByRole("switch", { name: "Path assist" })).toBeNull();
    view.unmount();
    render(<GravityGame onExit={() => {}} startTutorial />);
    expect(screen.queryByRole("switch", { name: "Path assist" })).toBeNull();
  });
});

function aim(canvas: HTMLCanvasElement, type: string, x: number, y: number) {
  canvas.setPointerCapture = () => {};
  canvas.hasPointerCapture = () => false;
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    isPrimary: { value: true },
    pointerType: { value: "mouse" },
  });
  fireEvent(canvas, event);
}
describe("aim prediction setting behavior", () => {
  it("requests the full Odessey flight horizon and renders its longer path only while aiming", () => {
    setPathAssist("full");
    const predict = vi.spyOn(OrbitEngine.prototype, "predict");
    render(<OdesseyGame />);
    const canvas = screen.getByLabelText(
      "Slingshot flight field",
    ) as HTMLCanvasElement;
    aim(canvas, "pointerdown", 300, 500);
    aim(canvas, "pointermove", 220, 500);
    act(() => frame(100));
    expect(predict).toHaveBeenLastCalledWith(22);
    expect(renders.odessey.mock.calls.at(-1)?.[3].pathAssist).toBe("full");
    aim(canvas, "pointercancel", 220, 500);
    act(() => frame(200));
    expect(renders.odessey.mock.calls.at(-1)?.[1]).toEqual([]);
  });
  it("clears a changed Full Odessey aim inside the throttle window but retains an identical aim", () => {
    setPathAssist("full");
    render(<OdesseyGame />);
    const canvas = screen.getByLabelText(
      "Slingshot flight field",
    ) as HTMLCanvasElement;
    aim(canvas, "pointerdown", 300, 500);
    aim(canvas, "pointermove", 220, 500);
    act(() => frame(100));
    expect(renders.odessey.mock.calls.at(-1)?.[1][0].length).toBeGreaterThan(0);
    aim(canvas, "pointermove", 220, 400);
    act(() => frame(120));
    expect(renders.odessey.mock.calls.at(-1)?.[1]).toEqual([]);
    act(() => frame(200));
    const updated = renders.odessey.mock.calls.at(-1)?.[1];
    expect(updated[0].length).toBeGreaterThan(0);
    aim(canvas, "pointermove", 220, 400);
    act(() => frame(220));
    expect(renders.odessey.mock.calls.at(-1)?.[1]).toEqual(updated);
  });
  it("uses a longer bounded Gravity job, refreshes a held-still sky, and cancels on pause or setting changes", () => {
    setPathAssist("full");
    const begin = vi.spyOn(GravityEngine.prototype, "beginPrediction");
    render(<GravityGame onExit={() => {}} />);
    const canvas = screen.getByLabelText(
      "Gravity orbital field",
    ) as HTMLCanvasElement;
    aim(canvas, "pointerdown", 100, 200);
    aim(canvas, "pointermove", 20, 200);
    act(() => frame(100));
    expect(begin).toHaveBeenCalledWith(10);
    const first = begin.mock.results[0].value!;
    while (!first.done) act(() => frame(150));
    const completed = renders.gravity.mock.calls.at(-1)?.[1].length;
    expect(completed).toBeGreaterThan(100);
    act(() => frame(700));
    expect(begin.mock.calls.length).toBeGreaterThanOrEqual(2);
    const job = begin.mock.results.at(-1)!.value!,
      cancel = vi.spyOn(job, "cancel");
    fireEvent.click(screen.getByRole("button", { name: "Pause", exact: true }));
    expect(cancel).toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Advanced", exact: true }),
    );
    fireEvent.click(
      screen.getByRole("switch", { name: "Path assist", exact: true }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Resume", exact: true }),
    );
    act(() => frame(800));
    expect(renders.gravity.mock.calls.at(-1)?.[1]).toEqual([]);
    aim(canvas, "pointerup", 20, 200);
    expect(screen.getByRole("status").textContent).toBe("0 planets in motion");
    aim(canvas, "pointerdown", 100, 200);
    // Preserve the same normalized slow shot with the longer pull range.
    // Leave room below the preview horizon cap to observe zoom extending it.
    aim(canvas, "pointermove", 32, 200);
    act(() => frame(900));
    const partialSeconds = begin.mock.calls.at(-1)![0]!;
    expect(partialSeconds).toBeGreaterThan(1.4);
    expect(partialSeconds).toBeLessThanOrEqual(4);
    expect(partialSeconds).toBeLessThan(10);
    const partial = begin.mock.results.at(-1)!.value!;
    while (!partial.done) act(() => frame(950));
    renders.gravityScale = 0.5;
    act(() => frame(1100));
    const zoomedOutSeconds = begin.mock.calls.at(-1)![0]!;
    expect(zoomedOutSeconds).toBeGreaterThan(partialSeconds);
    expect(zoomedOutSeconds).toBeLessThanOrEqual(4);
  });
});
