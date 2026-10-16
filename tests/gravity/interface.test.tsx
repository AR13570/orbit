import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App";
import { loadGravityProgress } from "../../src/gravity/progress";
import GravityGame from "../../src/gravity/GravityGame";
import { GravityEngine } from "../../src/gravity/engine";
import { newDraft, toGravityLevel } from "../../src/gravity/creator/model";
vi.mock("../../src/gravity/renderer", () => ({
  createGravityRenderer: () => ({
    resize: () => {},
    render: () => {},
    destroy: () => {},
    getScale: () => 1,
    setWalkthroughFocus() {},
    worldToScreen: (point: unknown) => point,
    screenToWorld: (x: number, y: number) => ({ x, y }),
    setZoom: () => {},
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
    setWalkthroughFocus() {},
    worldToScreen: (point: unknown) => point,
  }),
}));
let frame: FrameRequestCallback;
beforeEach(() => {
  window.history.replaceState({}, "", "/");
  localStorage.clear();
  localStorage.setItem("orbit.walkthrough.zen.v1", "complete");
  localStorage.setItem("orbit.walkthrough.gravity.v1", "complete");
  localStorage.setItem("orbit.walkthrough.gravity.v2", "complete");
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
  pointerType = "touch",
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
    pointerType: { value: pointerType },
  });
  fireEvent(c, e);
}
function pull(c: HTMLCanvasElement) {
  pointer(c, "pointerdown", 220, 300);
  pointer(c, "pointerup", 220, 330);
}
describe("Gravity interface", () => {
  describe.each([
    {
      name: "desktop",
      width: 1280,
      height: 800,
      pointerType: "mouse",
      limit: 90,
    },
    { name: "phone", width: 390, height: 844, pointerType: "touch", limit: 48 },
    {
      name: "landscape",
      width: 844,
      height: 390,
      pointerType: "touch",
      limit: 48,
    },
  ])("$name launch response", ({ width, height, pointerType, limit }) => {
    it.each([24, 48, 80, "maximum", "over cap"] as const)(
      "keeps %s pull preview, arc power and physical release consistent",
      (pull) => {
        vi.spyOn(window, "innerWidth", "get").mockReturnValue(width);
        vi.spyOn(window, "innerHeight", "get").mockReturnValue(height);
        const launch = vi.spyOn(GravityEngine.prototype, "launch");
        const setLaunch = vi.spyOn(GravityEngine.prototype, "setLaunch");
        render(<GravityGame onExit={() => {}} />);
        const canvas = field(),
          distance =
            pull === "maximum" ? limit : pull === "over cap" ? limit * 3 : pull;
        pointer(canvas, "pointerdown", 300, 300, 1, true, pointerType);
        pointer(
          canvas,
          "pointermove",
          300 - distance,
          300,
          1,
          true,
          pointerType,
        );
        const previewAim = setLaunch.mock.calls.at(-1)![1] as {
          power: number;
          angle: number;
          pull: { x: number; y: number };
        };
        const expectedPower = Math.min(1, distance / limit) ** 2;
        expect(previewAim.power).toBeCloseTo(expectedPower, 12);
        expect(Math.hypot(previewAim.pull!.x, previewAim.pull!.y)).toBeCloseTo(
          Math.min(distance, limit),
        );
        pointer(canvas, "pointerup", 300 - distance, 300, 1, true, pointerType);
        expect(setLaunch.mock.calls.at(-1)![1]).toEqual(previewAim);
        const state = (launch.mock.instances[0] as GravityEngine).getSnapshot();
        expect(state.aim.power).toBeCloseTo(expectedPower, 12);
        expect(state.particles[0].position).toEqual({ x: 300, y: 300 });
        expect(state.particles[0].velocity.x).toBeCloseTo(
          expectedPower === 1 ? 460 : 420 * expectedPower,
          10,
        );
        expect(state.particles[0].velocity.y).toBeCloseTo(0);
      },
    );
  });
  it.each([
    {
      pointerType: "mouse",
      width: 1280,
      height: 800,
      base: 90,
      zoom: 0.5,
      factor: Math.sqrt(0.5),
    },
    {
      pointerType: "mouse",
      width: 1280,
      height: 800,
      base: 90,
      zoom: 0.75,
      factor: Math.sqrt(0.75),
    },
    {
      pointerType: "touch",
      width: 390,
      height: 844,
      base: 48,
      zoom: 0.5,
      factor: Math.sqrt(0.5),
    },
    {
      pointerType: "touch",
      width: 844,
      height: 390,
      base: 48,
      zoom: 0.75,
      factor: Math.sqrt(0.75),
    },
  ])(
    "keeps $pointerType aim, capped handle and release aligned at $zoom zoom",
    ({ pointerType, width, height, base, zoom, factor }) => {
      vi.spyOn(window, "innerWidth", "get").mockReturnValue(width);
      vi.spyOn(window, "innerHeight", "get").mockReturnValue(height);
      const launch = vi.spyOn(GravityEngine.prototype, "launch");
      const setLaunch = vi.spyOn(GravityEngine.prototype, "setLaunch");
      render(<GravityGame onExit={() => {}} />);
      const canvas = field();
      fireEvent.wheel(canvas, { deltaY: -Math.log(zoom) / 0.002 });
      for (const [fraction, expectedPower, expectedSpeed] of [
        [0.5, 0.25, 105],
        [0.95, 0.9025, 399.79984375],
        [1.3, 1, 460],
      ]) {
        const distance = base * factor * fraction;
        pointer(canvas, "pointerdown", 300, 300, 1, true, pointerType);
        pointer(
          canvas,
          "pointermove",
          300 - distance,
          300,
          1,
          true,
          pointerType,
        );
        const aim = setLaunch.mock.calls.at(-1)![1] as {
          power: number;
          pull: { x: number; y: number };
        };
        expect(aim.power).toBeCloseTo(expectedPower, 12);
        expect(Math.hypot(aim.pull.x, aim.pull.y)).toBeCloseTo(
          Math.min(distance, base * factor),
          10,
        );
        pointer(canvas, "pointerup", 300 - distance, 300, 1, true, pointerType);
        expect(setLaunch.mock.calls.at(-1)![1]).toEqual(aim);
        const state = (
          launch.mock.instances.at(-1) as GravityEngine
        ).getSnapshot();
        const planet = state.particles.at(-1)!;
        expect(Math.hypot(planet.velocity.x, planet.velocity.y)).toBeCloseTo(
          expectedSpeed,
          8,
        );
      }
    },
  );
  it("cancels held shots before changing zoom with wheel or keyboard", () => {
    const launch = vi.spyOn(GravityEngine.prototype, "launch");
    render(<GravityGame onExit={() => {}} />);
    const canvas = field();
    for (const change of [
      () => fireEvent.wheel(canvas, { deltaY: 300 }),
      () => fireEvent.keyDown(canvas, { key: "-" }),
      () => fireEvent.keyDown(window, { key: "0" }),
    ]) {
      pointer(canvas, "pointerdown", 300, 300, 1, true, "mouse");
      pointer(canvas, "pointermove", 250, 300, 1, true, "mouse");
      change();
      pointer(canvas, "pointerup", 250, 300, 1, true, "mouse");
    }
    expect(launch).not.toHaveBeenCalled();
  });
  it("persists the interaction toggle across retry, level changes and remount without resetting a running sky", () => {
    const launch = vi.spyOn(GravityEngine.prototype, "launch");
    const view = render(<GravityGame onExit={() => {}} />);
    pull(field());
    act(() => frame(100));
    act(() => frame(150));
    const engine = launch.mock.instances[0] as GravityEngine;
    const before = engine.getSnapshot();
    fireEvent.click(screen.getByRole("button", { name: "Pause", exact: true }));
    fireEvent.click(
      screen.getByRole("button", { name: "Advanced", exact: true }),
    );
    fireEvent.click(
      screen.getByRole("switch", { name: "Particle Interaction" }),
    );
    const after = engine.getSnapshot();
    expect(after.physics.planetGravity).toBe(false);
    expect(after.particles).toEqual(before.particles);
    expect(after.elapsed).toBe(before.elapsed);
    fireEvent.click(
      screen.getByRole("button", { name: "Reset level", exact: true }),
    );
    expect(engine.getSnapshot().physics.planetGravity).toBe(false);
    fireEvent.click(
      screen.getByRole("button", { name: "Skip level", exact: true }),
    );
    expect(engine.getSnapshot().physics.planetGravity).toBe(false);
    view.unmount();
    render(<GravityGame onExit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause", exact: true }));
    fireEvent.click(
      screen.getByRole("button", { name: "Advanced", exact: true }),
    );
    expect(
      screen
        .getByRole("switch", { name: "Particle Interaction" })
        .getAttribute("aria-checked"),
    ).toBe("false");
  });
  it("honors a custom sky's interaction rule until an explicit player choice", () => {
    const draft = newDraft();
    draft.physics.planetGravity = false;
    render(
      <GravityGame customLevel={toGravityLevel(draft)} onExit={() => {}} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Pause", exact: true }));
    fireEvent.click(
      screen.getByRole("button", { name: "Advanced", exact: true }),
    );
    const toggle = screen.getByRole("switch", { name: "Particle Interaction" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });
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
  it("keeps authored level rules out of the player menu while retaining gameplay actions", () => {
    localStorage.setItem("orbit-gravity-interaction", "true");
    render(<GravityGame onExit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.queryByRole("combobox")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Advanced", exact: true }),
    );
    expect(
      screen
        .getByRole("switch", { name: "Path assist" })
        .getAttribute("aria-checked"),
    ).toBe("false");
    expect(screen.queryByRole("button", { name: "Clear trails" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save sky image" })).toBeNull();
    for (const name of [
      "Resume",
      "Sound on",
      "How to play",
      "Reset level",
      "Choose a level",
      "Choose mode",
    ])
      expect(screen.getByRole("button", { name, exact: true })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sound on" }));
    expect(
      screen
        .getByRole("button", { name: "Sound off" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    fireEvent.keyDown(screen.getByRole("button", { name: "Resume" }), {
      key: "Escape",
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(field());
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
    fireEvent.click(screen.getByRole("button", { name: /^Zen/ }));
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
  it("keeps a completed sky moving until Next level is chosen", () => {
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
    expect(screen.getByText("Level 1")).toBeTruthy();
    expect(engine!.getSnapshot().elapsed).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Next level" }));
    expect(screen.getByText("Level 2")).toBeTruthy();
    expect(engine!.getSnapshot().completedCount).toBe(1);
  });
});

it("Reset level after completion persists the level actually being replayed", () => {
  const current = GravityEngine.prototype.getRenderSnapshot;
  vi.spyOn(GravityEngine.prototype, "getRenderSnapshot").mockImplementation(
    function (this: GravityEngine) {
      const state = current.call(this);
      return { ...state, complete: true };
    },
  );
  render(<GravityGame onExit={() => {}} />);
  act(() => frame!(100));
  const seed = Number(localStorage.getItem("orbit.gravity.default-seed.v1"));
  expect(loadGravityProgress(seed).currentIndex).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "Reset level (R)" }));
  expect(loadGravityProgress(seed)).toMatchObject({
    currentIndex: 0,
    unlockedIndex: 1,
    completedIndices: [0],
  });
});

it("rejects core-overlapping release and lets the next clear-space drag launch", () => {
  const aim = vi.spyOn(GravityEngine.prototype, "setLaunch");
  render(<GravityGame onExit={() => {}} />);
  const canvas = field();
  pointer(canvas, "pointerdown", 450, 450, 1, true, "mouse");
  pointer(canvas, "pointermove", 405, 450, 1, true, "mouse");
  const engine = aim.mock.instances[0] as GravityEngine;
  pointer(canvas, "pointerup", 405, 450, 1, true, "mouse");
  expect(engine.getSnapshot().particles).toHaveLength(0);
  expect(screen.getByRole("status").textContent).toBe("Start in clear space");
  pointer(canvas, "pointerdown", 300, 650, 1, true, "mouse");
  pointer(canvas, "pointerup", 255, 650, 1, true, "mouse");
  expect(engine.getSnapshot().particles).toHaveLength(1);
  expect(screen.getByRole("status").textContent).toBe("1 planet in motion");
});

it("checks the live core pose when a moving core crosses the held launch point", () => {
  const level = toGravityLevel(newDraft());
  level.motions = [
    {
      bodyId: "body-1",
      kind: "circle",
      center: { x: 450, y: 450 },
      radius: 100,
      period: 1,
    },
  ];
  const aim = vi.spyOn(GravityEngine.prototype, "setLaunch");
  render(<GravityGame onExit={() => {}} customLevel={level} />);
  const canvas = field();
  pointer(canvas, "pointerdown", 450, 550, 1, true, "mouse");
  pointer(canvas, "pointermove", 405, 550, 1, true, "mouse");
  const engine = aim.mock.instances[0] as GravityEngine;
  expect(engine.getSnapshot().level.bodies[0].position).toEqual({
    x: 550,
    y: 450,
  });
  engine.setTimeScale(1);
  engine.update(0.25);
  pointer(canvas, "pointerup", 405, 550, 1, true, "mouse");
  expect(engine.getSnapshot().particles).toHaveLength(0);
  expect(screen.getByRole("status").textContent).toBe("Start in clear space");
});
