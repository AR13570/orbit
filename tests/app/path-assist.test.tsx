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
import { newDraft, toGravityLevel } from "../../src/gravity/creator/model";
import { OrbitEngine } from "../../src/game/engine";
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
    setZoom() {},
    setWalkthroughFocus() {},
    worldToScreen: (point: unknown) => point,
    screenToWorld: (x: number, y: number) => ({ x, y }),
  }),
}));
beforeEach(() => {
  localStorage.clear();
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
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
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
});
describe("removed full path assist", () => {
  it.each(["odessey", "gravity"])(
    "ignores an old Full setting and exposes no Full control in %s",
    (mode) => {
      localStorage.setItem("orbit.path-assist.v1", "full");
      render(
        mode === "odessey" ? (
          <OdesseyGame />
        ) : (
          <GravityGame onExit={() => {}} />
        ),
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Pause", exact: true }),
      );
      if (mode === "gravity")
        fireEvent.click(
          screen.getByRole("button", { name: "Advanced", exact: true }),
        );
      else
        expect(
          screen.queryByRole("button", { name: "Advanced", exact: true }),
        ).toBeNull();
      expect(
        screen.queryByRole("switch", { name: "Path assist", exact: true }),
      ).toBeNull();
      expect(
        screen.queryByRole("button", {
          name: "About Path assist",
          exact: true,
        }),
      ).toBeNull();
    },
  );
  it("collapses the remaining Gravity controls on each pause and preserves dialog focus wrapping", () => {
    const launch = vi.spyOn(GravityEngine.prototype, "launch");
    render(<GravityGame onExit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause", exact: true }));
    expect(
      screen.queryByRole("switch", { name: "Particle Interaction" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Advanced", exact: true }),
    );
    expect(
      screen
        .getByRole("switch", { name: "Particle Interaction" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    const last = screen.getByRole("button", {
      name: "Choose mode",
      exact: true,
    });
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Resume", exact: true }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Resume", exact: true }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Pause", exact: true }));
    expect(
      screen
        .getByRole("button", { name: "Advanced", exact: true })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(launch).not.toHaveBeenCalled();
  });
  it("does not add settings to either tutorial", () => {
    localStorage.clear();
    const view = render(<OdesseyGame startTutorial />);
    expect(screen.queryByRole("switch", { name: "Path assist" })).toBeNull();
    view.unmount();
    render(<GravityGame onExit={() => {}} startTutorial />);
    expect(screen.queryByRole("switch", { name: "Path assist" })).toBeNull();
  });
});

function aim(
  canvas: HTMLCanvasElement,
  type: string,
  x: number,
  y: number,
  pointerType = "mouse",
  pointerId = 1,
) {
  canvas.setPointerCapture = () => {};
  canvas.hasPointerCapture = () => false;
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    isPrimary: { value: pointerId === 1 },
    pointerType: { value: pointerType },
  });
  fireEvent(canvas, event);
}
function emptyGravityLevel() {
  const draft = newDraft();
  draft.bodies = [];
  draft.physics = { bodyCollisions: false, planetGravity: true };
  return toGravityLevel(draft);
}

describe("aim prediction setting behavior", () => {
  it("always requests the short Odessey horizon even with a legacy Full setting", () => {
    localStorage.setItem("orbit.path-assist.v1", "full");
    const predict = vi.spyOn(OrbitEngine.prototype, "predict");
    render(<OdesseyGame />);
    const canvas = screen.getByLabelText(
      "Slingshot flight field",
    ) as HTMLCanvasElement;
    aim(canvas, "pointerdown", 300, 500);
    aim(canvas, "pointermove", 220, 500);
    act(() => frame(100));
    expect(predict).toHaveBeenLastCalledWith(1.6);
    expect(renders.odessey.mock.calls.at(-1)?.[3].pathAssist).toBeUndefined();
    aim(canvas, "pointercancel", 220, 500);
    act(() => frame(200));
    expect(renders.odessey.mock.calls.at(-1)?.[1]).toEqual([]);
  });
  it("keeps the short Odessey path continuous and coalesces pointer moves", () => {
    localStorage.setItem("orbit.path-assist.v1", "full");
    const predict = vi.spyOn(OrbitEngine.prototype, "predict");
    render(<OdesseyGame />);
    const canvas = screen.getByLabelText(
      "Slingshot flight field",
    ) as HTMLCanvasElement;
    aim(canvas, "pointerdown", 300, 500);
    aim(canvas, "pointermove", 220, 500);
    act(() => frame(100));
    expect(renders.odessey.mock.calls.at(-1)?.[1][0].length).toBeGreaterThan(0);
    const first = structuredClone(renders.odessey.mock.calls.at(-1)?.[1]);
    const calls = predict.mock.calls.length;
    aim(canvas, "pointermove", 220, 450);
    aim(canvas, "pointermove", 220, 400);
    expect(predict).toHaveBeenCalledTimes(calls);
    act(() => frame(120));
    expect(predict).toHaveBeenCalledTimes(calls + 1);
    const refreshed = renders.odessey.mock.calls.at(-1)?.[1];
    expect(refreshed[0].length).toBeGreaterThan(0);
    expect(refreshed).not.toEqual(first);
    expect(refreshed).toEqual(predict.mock.results.at(-1)!.value);
    act(() => frame(200));
    const updated = renders.odessey.mock.calls.at(-1)?.[1];
    expect(updated[0].length).toBeGreaterThan(0);
    aim(canvas, "pointermove", 220, 400);
    act(() => frame(220));
    expect(renders.odessey.mock.calls.at(-1)?.[1]).toEqual(updated);
    expect(predict).toHaveBeenCalledTimes(calls + 1);
  });
  it("bounds Gravity to its short preview, refreshes a held-still sky and cancels on pause", () => {
    localStorage.setItem("orbit.path-assist.v1", "full");
    const begin = vi.spyOn(GravityEngine.prototype, "beginPrediction");
    render(<GravityGame customLevel={emptyGravityLevel()} onExit={() => {}} />);
    const canvas = screen.getByLabelText(
      "Gravity orbital field",
    ) as HTMLCanvasElement;
    aim(canvas, "pointerdown", 100, 200);
    aim(canvas, "pointermove", 20, 200);
    act(() => frame(100));
    expect(begin.mock.calls.every(([seconds]) => seconds! <= 12)).toBe(true);
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
    expect(partialSeconds).toBeGreaterThan(4.2);
    expect(partialSeconds).toBeLessThanOrEqual(12);
    expect(partialSeconds).toBeLessThan(20);
    const partial = begin.mock.results.at(-1)!.value!;
    while (!partial.done) act(() => frame(950));
    renders.gravityScale = 0.5;
    act(() => frame(1100));
    const zoomedOutSeconds = begin.mock.calls.at(-1)![0]!;
    expect(zoomedOutSeconds).toBeGreaterThan(partialSeconds);
    expect(zoomedOutSeconds).toBeLessThanOrEqual(12);
  });
});

describe("live aim playback and touch feedback", () => {
  it("restores Gravity pace on release, cancellation, zoom and focus loss", () => {
    const playback = vi.spyOn(GravityEngine.prototype, "setAiming");
    render(<GravityGame customLevel={emptyGravityLevel()} onExit={() => {}} />);
    const canvas = screen.getByLabelText(
      "Gravity orbital field",
    ) as HTMLCanvasElement;
    for (const end of [
      "pointerup",
      "pointercancel",
      "zoom",
      "blur",
      "focus",
    ] as const) {
      aim(canvas, "pointerdown", 100, 200);
      expect(playback).toHaveBeenLastCalledWith(true);
      aim(canvas, "pointermove", 20, 200);
      if (end === "zoom") fireEvent.wheel(canvas, { deltaY: 100 });
      else if (end === "blur") fireEvent(window, new Event("blur"));
      else if (end === "focus") fireEvent.blur(canvas);
      else aim(canvas, end, 20, 200);
      expect(playback).toHaveBeenLastCalledWith(false);
    }
  });
  it.each(["gravity", "odessey"])(
    "acknowledges only deliberate touch aiming and successful shooting in %s",
    (mode) => {
      const vibrate = vi.fn(() => true);
      Object.defineProperty(navigator, "vibrate", {
        configurable: true,
        value: vibrate,
      });
      try {
        render(
          mode === "gravity" ? (
            <GravityGame customLevel={emptyGravityLevel()} onExit={() => {}} />
          ) : (
            <OdesseyGame />
          ),
        );
        const canvas = screen.getByLabelText(
          mode === "gravity"
            ? "Gravity orbital field"
            : "Slingshot flight field",
        ) as HTMLCanvasElement;
        aim(canvas, "pointerdown", 100, 200, "touch");
        expect(vibrate).not.toHaveBeenCalled();
        aim(canvas, "pointermove", 20, 200, "touch");
        aim(canvas, "pointermove", 10, 200, "touch");
        expect(vibrate.mock.calls).toEqual([[6]]);
        aim(canvas, "pointerup", 10, 200, "touch");
        expect(vibrate.mock.calls).toEqual([[6], [10]]);
      } finally {
        Reflect.deleteProperty(navigator, "vibrate");
      }
    },
  );
  it("keeps a Full Gravity preview visible and completes jobs throughout pointer changes", () => {
    localStorage.setItem("orbit.path-assist.v1", "full");
    const begin = vi.spyOn(GravityEngine.prototype, "beginPrediction");
    render(<GravityGame customLevel={emptyGravityLevel()} onExit={() => {}} />);
    const canvas = screen.getByLabelText(
      "Gravity orbital field",
    ) as HTMLCanvasElement;
    aim(canvas, "pointerdown", 100, 200);
    for (let i = 1; i <= 30; i++) {
      aim(canvas, "pointermove", 20, 200 + i);
      act(() => frame(16 * i));
      expect(renders.gravity.mock.calls.at(-1)?.[1].length).toBeGreaterThan(1);
    }
    expect(
      begin.mock.results.filter(({ value }) => value?.done).length,
    ).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole("button", { name: "Pause", exact: true }));
    act(() => frame(600));
    expect(renders.gravity.mock.calls.at(-1)?.[1]).toEqual([]);
  });
  it("suppresses Gravity feedback for blocked launches, pinch and pause cancellation", () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: vibrate,
    });
    const draft = newDraft();
    draft.bodies = [
      {
        id: "core",
        kind: "attractor",
        position: { x: 100, y: 200 },
        radius: 60,
        strength: 0,
      },
    ];
    draft.physics = { bodyCollisions: true };
    try {
      render(
        <GravityGame customLevel={toGravityLevel(draft)} onExit={() => {}} />,
      );
      const canvas = screen.getByLabelText(
        "Gravity orbital field",
      ) as HTMLCanvasElement;
      aim(canvas, "pointerdown", 100, 200, "touch");
      aim(canvas, "pointermove", 20, 200, "touch");
      aim(canvas, "pointerup", 20, 200, "touch");
      expect(vibrate).not.toHaveBeenCalled();
      aim(canvas, "pointerdown", 300, 200, "touch");
      aim(canvas, "pointerdown", 400, 200, "touch", 2);
      aim(canvas, "pointermove", 220, 200, "touch");
      aim(canvas, "pointerup", 220, 200, "touch");
      aim(canvas, "pointerup", 400, 200, "touch", 2);
      expect(vibrate).not.toHaveBeenCalled();
      aim(canvas, "pointerdown", 300, 200, "touch");
      aim(canvas, "pointermove", 220, 200, "touch");
      expect(vibrate.mock.calls).toEqual([[6]]);
      fireEvent.click(
        screen.getByRole("button", { name: "Pause", exact: true }),
      );
      aim(canvas, "pointerup", 220, 200, "touch");
      expect(vibrate.mock.calls).toEqual([[6]]);
      expect(screen.getByRole("heading", { name: "Paused" })).not.toBeNull();
    } finally {
      Reflect.deleteProperty(navigator, "vibrate");
    }
  });
  it("suppresses Odessey feedback while panning or cancelling a deliberate touch aim", () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: vibrate,
    });
    try {
      render(<OdesseyGame />);
      const canvas = screen.getByLabelText(
        "Slingshot flight field",
      ) as HTMLCanvasElement;
      fireEvent.keyDown(window, { key: " ", code: "Space" });
      aim(canvas, "pointerdown", 300, 500);
      aim(canvas, "pointermove", 220, 500);
      aim(canvas, "pointerup", 220, 500);
      fireEvent.keyUp(window, { key: " ", code: "Space" });
      expect(vibrate).not.toHaveBeenCalled();
      aim(canvas, "pointerdown", 300, 500, "touch");
      aim(canvas, "pointermove", 220, 500, "touch");
      aim(canvas, "pointercancel", 220, 500, "touch");
      aim(canvas, "pointerup", 220, 500, "touch");
      expect(vibrate.mock.calls).toEqual([[6]]);
    } finally {
      Reflect.deleteProperty(navigator, "vibrate");
    }
  });
  it("resumes slowdown when a moving core clears a stationary held launch origin", () => {
    const draft = newDraft();
    draft.bodies[0].radius = 40;
    draft.bodies[0].strength = 0;
    draft.physics = { bodyCollisions: true };
    const level = toGravityLevel(draft);
    level.motions = [
      {
        bodyId: level.bodies[0].id,
        kind: "circle",
        center: { x: 100, y: 200 },
        radius: 150,
        period: 1,
      },
    ];
    const launch = vi.spyOn(GravityEngine.prototype, "setLaunch");
    const playback = vi.spyOn(GravityEngine.prototype, "setAiming");
    render(<GravityGame customLevel={level} onExit={() => {}} />);
    const canvas = screen.getByLabelText(
      "Gravity orbital field",
    ) as HTMLCanvasElement;
    aim(canvas, "pointerdown", 100, 350);
    aim(canvas, "pointermove", 60, 350);
    const engine = launch.mock.instances[0] as GravityEngine;
    engine.setTimeScale(1);
    expect(playback).toHaveBeenLastCalledWith(true);
    for (let frame = 0; frame < 40; frame++) engine.update(0.25 / 0.65 / 40);
    act(() => frame(100));
    expect(playback).toHaveBeenLastCalledWith(false);
    for (let frame = 0; frame < 40; frame++) engine.update(0.25 / 40);
    act(() => frame(116));
    expect(playback).toHaveBeenLastCalledWith(true);
    expect(engine.getRenderSnapshot().launchPosition).toEqual({
      x: 100,
      y: 350,
    });
  });
});
