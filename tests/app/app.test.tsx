import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import App from "../../src/App";
import { OrbitEngine } from "../../src/game/engine";
vi.mock("../../src/render/renderer", () => ({
  createRenderer: () => ({
    resize: vi.fn(),
    prepareFrame: vi.fn(),
    getVisibleBounds: () => ({ x: -100, y: -100, width: 2000, height: 1200 }),
    render: vi.fn(),
    destroy: vi.fn(),
    screenToWorld: (x: number, y: number) => ({ x, y }),
    worldToScreen: (p: unknown) => p,
    getViewport: () => ({
      center: { x: 900, y: 500 },
      scale: 1,
      transitioning: false,
    }),
  }),
}));
class Observer {
  observe() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", Observer);
vi.stubGlobal("matchMedia", () => ({ matches: false }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function pointer(
  canvas: HTMLCanvasElement,
  type: string,
  x: number,
  y: number,
  id = 1,
  primary = true,
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
  Object.defineProperties(event, {
    pointerId: { value: id },
    isPrimary: { value: primary },
    pointerType: { value: "mouse" },
  });
  fireEvent(canvas, event);
}
function tap(canvas: HTMLCanvasElement, x = 200, y = 200) {
  pointer(canvas, "pointerdown", x, y);
  pointer(canvas, "pointerup", x, y);
}
function field() {
  const canvas = screen.getByLabelText(
    "Slingshot flight field",
  ) as HTMLCanvasElement;
  canvas.setPointerCapture = vi.fn();
  canvas.hasPointerCapture = () => true;
  canvas.releasePointerCapture = (id) =>
    pointer(canvas, "lostpointercapture", 0, 0, id);
  return canvas;
}
describe("minimal scene lifecycle", () => {
  it("shows the last offscreen chance without announcing each countdown tick", () => {
    const initial = new OrbitEngine(42).getSnapshot();
    const piece = (id: number, remaining?: number, alive = true) =>
      Object.assign(
        {
          id,
          position: { x: -300, y: 0 },
          velocity: { x: 0, y: 0 },
          alive,
          trail: [],
        },
        remaining === undefined ? {} : { offscreenRemaining: remaining },
      );
    let current = {
      ...initial,
      status: "flying" as const,
      particles: [piece(1, 2.1), piece(2, 4.2), piece(3, undefined, false)],
    };
    vi.spyOn(OrbitEngine.prototype, "getSnapshot").mockImplementation(
      () => current,
    );
    vi.spyOn(OrbitEngine.prototype, "update").mockImplementation(() => {});
    let nextFrame: FrameRequestCallback;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      nextFrame = callback;
      return 1;
    });
    const { container } = render(<App />);
    expect(screen.getByText("Offscreen · 5s")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe(
      "Offscreen. Six seconds to return.",
    );
    expect(
      container
        .querySelector(".offscreen-countdown")
        ?.getAttribute("aria-hidden"),
    ).toBe("true");
    current = { ...current, particles: [piece(1, 1), piece(2, 3.1)] };
    act(() => nextFrame(100));
    expect(screen.getByText("Offscreen · 4s")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe(
      "Offscreen. Six seconds to return.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(container.querySelector(".offscreen-countdown")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(screen.getByText("Offscreen · 4s")).toBeTruthy();
    current = { ...current, particles: [piece(1, 1), piece(2)] };
    act(() => nextFrame(200));
    expect(container.querySelector(".offscreen-countdown")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("In flight");
    current = { ...current, particles: [piece(1, 0, false)] };
    act(() => nextFrame(300));
    expect(container.querySelector(".offscreen-countdown")).toBeNull();
  });
  it("predicts a stationary new pull with zero launch power", () => {
    const powers: number[] = [];
    const original = OrbitEngine.prototype.predict;
    vi.spyOn(OrbitEngine.prototype, "predict").mockImplementation(function (
      this: OrbitEngine,
      seconds,
    ) {
      powers.push(this.getSnapshot().aim.power);
      return original.call(this, seconds);
    });
    render(<App />);
    const canvas = screen.getByLabelText(
      "Slingshot flight field",
    ) as HTMLCanvasElement;
    canvas.setPointerCapture = vi.fn();
    canvas.hasPointerCapture = () => false;
    const down = new MouseEvent("pointerdown", {
      bubbles: true,
      button: 0,
      clientX: 200,
      clientY: 200,
    });
    Object.defineProperties(down, {
      pointerId: { value: 1 },
      isPrimary: { value: true },
      pointerType: { value: "mouse" },
    });
    fireEvent(canvas, down);
    expect(powers.length).toBeGreaterThan(0);
    expect(powers[powers.length - 1]).toBe(0);
  });
  it("shows no old launch chrome and opens a focused pause menu", () => {
    render(<App />);
    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.getByLabelText("Journey status").children).toHaveLength(1);
    expect(screen.getByLabelText("Checkpoint 0")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Launch" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Resume" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "How to play" }));
    expect(screen.getByRole("dialog", { name: "How to play" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Paused" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "p" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("New seed creates a fresh playable field without a seed argument", () => {
    const fields: number[] = [];
    const original = OrbitEngine.prototype.restart;
    render(<App />);
    const restart = vi
      .spyOn(OrbitEngine.prototype, "restart")
      .mockImplementation(function (this: OrbitEngine, seed) {
        fields.push(this.getSnapshot().sector.seed);
        original.call(this, seed);
        fields.push(this.getSnapshot().sector.seed);
        expect(this.getSnapshot().status).toBe("aiming");
        expect(this.getSnapshot().checkpointCount).toBe(0);
      });
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.click(screen.getByRole("button", { name: "New seed" }));
    expect(restart).toHaveBeenCalledWith();
    expect(fields[1]).not.toBe(fields[0]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Ready to pull");
  });
  it("double tap selects split mode and a short in-flight tap branches once", () => {
    const toggle = vi.spyOn(OrbitEngine.prototype, "toggleShotCount");
    const predict = vi.spyOn(OrbitEngine.prototype, "predict");
    const launch = vi.spyOn(OrbitEngine.prototype, "launch");
    render(<App />);
    const canvas = field();
    tap(canvas);
    tap(canvas);
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(launch).not.toHaveBeenCalled();
    expect(screen.getByText("Split mode")).toBeTruthy();
    pointer(canvas, "pointerdown", 200, 200);
    pointer(canvas, "pointermove", 120, 200);
    expect(predict.mock.results.at(-1)?.value).toHaveLength(1);
    pointer(canvas, "pointerup", 120, 200);
    expect(launch).toHaveBeenCalledTimes(1);
    const engine = launch.mock.instances[0] as OrbitEngine;
    expect(engine.getSnapshot().particles).toHaveLength(1);
    expect(engine.getSnapshot().shotCount).toBe(3);
    expect(engine.getSnapshot().canBranch).toBe(true);
    engine.update(0.2);
    const before = engine.getSnapshot().particles[0];
    const branch = vi.spyOn(engine, "branch");
    const aim = vi.spyOn(engine, "setAim");
    const predictionsBefore = predict.mock.calls.length;
    tap(canvas);
    expect(branch).toHaveBeenCalledTimes(1);
    expect(aim).not.toHaveBeenCalled();
    expect(predict.mock.calls).toHaveLength(predictionsBefore);
    expect(launch).toHaveBeenCalledTimes(1);
    const pieces = engine.getSnapshot().particles;
    expect(pieces).toHaveLength(3);
    for (let n = 0; n < 3; n++) {
      expect(pieces[n].position).toEqual(before.position);
      const v = pieces[n].velocity,
        b = before.velocity;
      const delta = Math.atan2(b.x * v.y - b.y * v.x, b.x * v.x + b.y * v.y);
      expect(delta).toBeCloseTo([0, -Math.PI / 60, Math.PI / 60][n], 10);
    }
    tap(canvas);
    tap(canvas);
    expect(branch).toHaveBeenCalledTimes(1);
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(engine.getSnapshot().particles).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset shot" }));
    expect(engine.getSnapshot().shotCount).toBe(3);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.click(screen.getByRole("button", { name: "New seed" }));
    expect(engine.getSnapshot().shotCount).toBe(3);
    expect(engine.getSnapshot().checkpointCount).toBe(0);
  });
  it("rejects dragged, held, interrupted and stale-flight taps without branching", () => {
    const launch = vi.spyOn(OrbitEngine.prototype, "launch");
    render(<App />);
    const canvas = field();
    tap(canvas);
    tap(canvas);
    pointer(canvas, "pointerdown", 200, 200);
    pointer(canvas, "pointerup", 120, 200);
    const engine = launch.mock.instances[0] as OrbitEngine;
    const branch = vi.spyOn(engine, "branch");
    pointer(canvas, "pointerdown", 200, 200);
    pointer(canvas, "pointermove", 220, 200);
    pointer(canvas, "pointerup", 200, 200);
    const now = vi.spyOn(performance, "now").mockReturnValue(0);
    pointer(canvas, "pointerdown", 200, 200);
    now.mockReturnValue(251);
    pointer(canvas, "pointerup", 200, 200);
    now.mockRestore();
    pointer(canvas, "pointerdown", 200, 200);
    pointer(canvas, "pointercancel", 200, 200);
    pointer(canvas, "pointerup", 200, 200);
    pointer(canvas, "pointerdown", 200, 200);
    pointer(canvas, "pointerdown", 300, 300, 2, false);
    pointer(canvas, "pointerup", 200, 200);
    pointer(canvas, "pointerdown", 200, 200);
    pointer(canvas, "lostpointercapture", 200, 200);
    pointer(canvas, "pointerup", 200, 200);
    pointer(canvas, "pointerdown", 200, 200);
    fireEvent(window, new Event("orientationchange"));
    pointer(canvas, "pointerup", 200, 200);
    pointer(canvas, "pointerdown", 200, 200);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    pointer(canvas, "pointerup", 200, 200);
    pointer(canvas, "pointerdown", 200, 200);
    engine.retry();
    engine.launch();
    pointer(canvas, "pointerup", 200, 200);
    expect(branch).not.toHaveBeenCalled();
    expect(engine.getSnapshot().particles).toHaveLength(1);
    expect(engine.getSnapshot().shotCount).toBe(3);
    tap(canvas);
    expect(branch).toHaveBeenCalledTimes(1);
  });
  it("single-mode flight taps neither branch nor toggle or relaunch", () => {
    const launch = vi.spyOn(OrbitEngine.prototype, "launch");
    const toggle = vi.spyOn(OrbitEngine.prototype, "toggleShotCount");
    render(<App />);
    const canvas = field();
    pointer(canvas, "pointerdown", 200, 200);
    pointer(canvas, "pointerup", 120, 200);
    const engine = launch.mock.instances[0] as OrbitEngine;
    const branch = vi.spyOn(engine, "branch");
    tap(canvas);
    tap(canvas);
    expect(engine.getSnapshot().particles).toHaveLength(1);
    expect(branch).not.toHaveBeenCalled();
    expect(toggle).not.toHaveBeenCalled();
    expect(launch).toHaveBeenCalledTimes(1);
  });
  it("pause, dragged taps and secondary-pointer interference clear tap sequences", () => {
    const toggle = vi.spyOn(OrbitEngine.prototype, "toggleShotCount");
    render(<App />);
    const canvas = field();
    tap(canvas);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    tap(canvas);
    expect(toggle).not.toHaveBeenCalled();
    pointer(canvas, "pointerdown", 200, 200);
    pointer(canvas, "pointermove", 220, 200);
    pointer(canvas, "pointermove", 200, 200);
    pointer(canvas, "pointerup", 200, 200);
    tap(canvas);
    expect(toggle).not.toHaveBeenCalled();
    pointer(canvas, "pointerdown", 200, 200);
    pointer(canvas, "pointerdown", 300, 300, 2, false);
    pointer(canvas, "pointerup", 300, 300, 2, false);
    pointer(canvas, "pointerup", 200, 200);
    tap(canvas);
    expect(toggle).not.toHaveBeenCalled();
    tap(canvas);
    expect(toggle).toHaveBeenCalledTimes(1);
  });
  it("requires manual resume after hidden-tab return", () => {
    render(<App />);
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByRole("dialog", { name: "Paused" })).toBeTruthy();
    hidden.mockReturnValue(false);
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByRole("dialog", { name: "Paused" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
