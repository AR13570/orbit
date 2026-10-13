import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App";
import GravityGame from "../../src/gravity/GravityGame";
import { GravityEngine } from "../../src/gravity/engine";
import { newDraft, toGravityLevel } from "../../src/gravity/creator/model";
vi.mock("../../src/gravity/renderer", () => ({
  createGravityRenderer: () => ({
    resize: () => {},
    render: () => {},
    destroy: () => {},
    getScale: () => 1,
  }),
}));
vi.mock("../../src/render/renderer", () => ({
  createRenderer: () => ({
    resize: () => {},
    prepareFrame: () => {},
    getVisibleBounds: () => ({ x: 0, y: 0, width: 1800, height: 1000 }),
    render: () => {},
    destroy: () => {},
    getViewport: () => ({ scale: 1, transitioning: false }),
  }),
}));
let frame: FrameRequestCallback;
beforeEach(() => {
  window.history.replaceState({}, "", "/");
  localStorage.clear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    frame = cb;
    return 1;
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function field() {
  const c = screen.getByLabelText("Gravity orbital field") as HTMLCanvasElement;
  c.setPointerCapture = () => {};
  c.hasPointerCapture = () => false;
  return c;
}
function pointer(
  c: HTMLCanvasElement,
  type: string,
  x: number,
  y: number,
  id = 1,
  primary = true,
) {
  const e = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
  Object.defineProperties(e, {
    pointerId: { value: id },
    isPrimary: { value: primary },
    pointerType: { value: "touch" },
  });
  fireEvent(c, e);
}
function pull(c: HTMLCanvasElement) {
  pointer(c, "pointerdown", 220, 300);
  pointer(c, "pointerup", 220, 330);
}
describe("Gravity interface", () => {
  it("opens the creator from the chooser and returns to modes", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Gravity creator/ }));
    expect(screen.getByLabelText("Level design field")).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get("mode")).toBe(
      "creator",
    );
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Choose mode" }));
    expect(screen.getByRole("heading", { name: "Orbit" })).toBeTruthy();
    expect(new URLSearchParams(window.location.search).has("mode")).toBe(false);
  });
  it("shows free play without an orbit quota for a design with no challenge", () => {
    render(
      <GravityGame
        customLevel={toGravityLevel(newDraft())}
        onExit={() => {}}
      />,
    );
    expect(screen.getByText("Free play")).toBeTruthy();
    expect(screen.queryByText(/\d+ \/ \d+ orbits/)).toBeNull();
    expect(screen.getByRole("button", { name: "Back to editor" })).toBeTruthy();
  });
  it("holds a completed custom level for retry and return to editing", () => {
    let engine: GravityEngine;
    const original = GravityEngine.prototype.launch;
    vi.spyOn(GravityEngine.prototype, "launch").mockImplementation(function (
      this: GravityEngine,
    ) {
      engine = this;
      return original.call(this);
    });
    const exit = vi.fn();
    const draft = newDraft();
    draft.objective.kind = "loop";
    render(
      <GravityGame
        customLevel={toGravityLevel(draft)}
        customName="My sky"
        onExit={exit}
      />,
    );
    pull(field());
    engine!.retry();
    engine!.setAim(0, Math.sqrt((1440000 * 200) / (200 * 200 + 1600)) / 420);
    engine!.launch();
    for (let n = 0; n < 1440; n++) engine!.update(1 / 120);
    for (let t = 100; t < 4000; t += 50) act(() => frame(t));
    expect(screen.getByText("Orbits aligned")).toBeTruthy();
    expect(screen.getByText("Playtest")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Skip level" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reset level (R)" }));
    expect(engine!.getSnapshot().complete).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Back to editor" }));
    expect(exit).toHaveBeenCalledOnce();
  });
  it("ignores the old interaction preference and exposes no interaction control", () => {
    localStorage.setItem("orbit-gravity-interaction", "true");
    render(<GravityGame onExit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(
      screen.queryByRole("switch", { name: "Projectile interaction" }),
    ).toBeNull();
  });
  it("starts at the mode chooser and can enter either mode and return", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Orbit" })).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: /Gravity.*Build living/ }),
    );
    expect(field()).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose mode" }));
    fireEvent.click(screen.getByRole("button", { name: /Zen/ }));
    expect(screen.getByLabelText("Slingshot flight field")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose mode" }));
    expect(screen.getByRole("heading", { name: "Orbit" })).toBeTruthy();
  });
  it("accepts repeated touch launches and freezes flight while paused", () => {
    let engine: GravityEngine;
    const original = GravityEngine.prototype.launch;
    vi.spyOn(GravityEngine.prototype, "launch").mockImplementation(function (
      this: GravityEngine,
    ) {
      engine = this;
      return original.call(this);
    });
    render(<GravityGame onExit={() => {}} />);
    const c = field();
    pull(c);
    act(() => frame(100));
    pull(c);
    act(() => frame(200));
    expect(engine!.getSnapshot().particles.filter((p) => p.alive)).toHaveLength(
      2,
    );
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    const before = engine!.getSnapshot().elapsed;
    act(() => frame(400));
    expect(engine!.getSnapshot().elapsed).toBe(before);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Resume" }),
    );
  });
  it("cancels held shots on pause, resize and secondary-pointer interference", () => {
    const launch = vi.spyOn(GravityEngine.prototype, "launch");
    render(<GravityGame onExit={() => {}} />);
    const c = field();
    pointer(c, "pointerdown", 220, 300);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    pointer(c, "pointerup", 220, 330);
    pointer(c, "pointerdown", 220, 300);
    fireEvent(window, new Event("resize"));
    pointer(c, "pointerup", 220, 330);
    pointer(c, "pointerdown", 220, 300);
    pointer(c, "pointerdown", 100, 100, 2, false);
    pointer(c, "pointerup", 220, 330);
    expect(launch).not.toHaveBeenCalled();
  });
  it("retries the same puzzle and skips to the next", () => {
    render(<GravityGame onExit={() => {}} />);
    const c = field();
    pull(c);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset level (R)" }));
    expect(screen.getByText("Level 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Skip level" }));
    expect(screen.getByText("Level 2")).toBeTruthy();
  });
  it("pauses on a hidden document and requires explicit resume", () => {
    render(<GravityGame onExit={() => {}} />);
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByRole("dialog", { name: "Paused" })).toBeTruthy();
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByRole("dialog", { name: "Paused" })).toBeTruthy();
  });
  it("advances a completed puzzle once after visible, unpaused feedback", () => {
    let engine: GravityEngine;
    const original = GravityEngine.prototype.launch;
    vi.spyOn(GravityEngine.prototype, "launch").mockImplementation(function (
      this: GravityEngine,
    ) {
      engine = this;
      return original.call(this);
    });
    render(<GravityGame onExit={() => {}} />);
    pull(field());
    engine!.retry();
    const witness = engine!.getSnapshot().level.witness;
    let shot = 0;
    for (let n = 0; n < 85 * 120 && !engine!.getSnapshot().complete; n++) {
      while (shot < witness.length && witness[shot].time <= n / 120 + 1e-8) {
        engine!.setAim(witness[shot].angle, witness[shot].power);
        engine!.launch();
        shot++;
      }
      engine!.update(1 / 120);
    }
    act(() => frame(100));
    expect(screen.getByText("Orbits aligned")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    for (let t = 150; t < 1500; t += 50) act(() => frame(t));
    expect(screen.getByText("Level 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    for (let t = 1500; t <= 3000; t += 50) act(() => frame(t));
    expect(screen.getByText("Level 2")).toBeTruthy();
    expect(engine!.getSnapshot().completedCount).toBe(1);
  });
});
