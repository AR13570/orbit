import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GravityGuide from "../../src/gravity/GravityGuide";
import { GravityEngine } from "../../src/gravity/engine";
import { gravityPullDistance } from "../../src/gravity/input";

vi.mock("../../src/gravity/renderer", () => ({
  createGravityRenderer: () => ({
    resize() {},
    render() {},
    destroy() {},
    setZoom() {},
    getScale: () => 1,
    screenToWorld: (x: number, y: number) => ({ x, y }),
  }),
}));

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function launchTwice() {
  const field = screen.getByLabelText("Gravity practice field");
  fireEvent.keyDown(field, { key: "Enter" });
  fireEvent.keyDown(field, { key: "Enter" });
}
function pointer(
  type: string,
  x: number,
  y: number,
  id = 1,
  pointerType = "mouse",
  target: Element | Document = screen.getByLabelText("Gravity practice field"),
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
  Object.defineProperties(event, {
    pointerId: { value: id },
    isPrimary: { value: id !== 2 },
    pointerType: { value: pointerType },
  });
  fireEvent(target, event);
}

describe("Gravity guide", () => {
  it("keeps unequal practice planets alive and separate through mutual attraction", () => {
    const launch = vi.spyOn(GravityEngine.prototype, "launch");
    render(<GravityGuide onFinish={() => {}} />);
    fireEvent.keyDown(screen.getByLabelText("Gravity practice field"), {
      key: "Enter",
    });
    const engine = launch.mock.instances[0] as GravityEngine;
    expect(engine.getSnapshot().physics.planetCollisions).toBe("soft");
    engine.retry();
    engine.setTimeScale(1);
    engine.launchFrom({ x: 410, y: 100 }, { x: 0, y: 0 });
    engine.setProjectileSize(2);
    engine.launchFrom({ x: 470, y: 100 }, { x: 0, y: 0 });
    let closest = Infinity;
    for (let frame = 0; frame < 240; frame++) {
      engine.update(1 / 120);
      const particles = engine.getSnapshot().particles;
      expect(particles.filter((p) => p.alive)).toHaveLength(2);
      expect(particles.map(({ radius, mass }) => ({ radius, mass }))).toEqual([
        { radius: 8, mass: 1 },
        { radius: 16, mass: 4 },
      ]);
      const distance = Math.hypot(
        particles[0].position.x - particles[1].position.x,
        particles[0].position.y - particles[1].position.y,
      );
      expect(distance).toBeGreaterThanOrEqual(24 - 1e-7);
      closest = Math.min(closest, distance);
    }
    expect(closest).toBeLessThan(25);
  });

  it("leaves focus alone on opening and enters the practice loop on first Tab", () => {
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    try {
      render(<GravityGuide onFinish={() => {}} />);
      const skip = screen.getByRole("button", { name: "Skip", exact: true });
      const field = screen.getByLabelText("Gravity practice field");
      expect(document.activeElement).toBe(outside);
      fireEvent.keyDown(outside, { key: "Tab" });
      expect(document.activeElement).toBe(skip);
      fireEvent.keyDown(skip, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(field);
      fireEvent.keyDown(field, { key: "Tab" });
      expect(document.activeElement).toBe(skip);
      outside.focus();
      fireEvent.keyDown(outside, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(field);
    } finally {
      outside.remove();
    }
  });

  it("permits Escape before keyboard focus enters the guide", () => {
    const finished = vi.fn();
    render(<GravityGuide onFinish={finished} />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(finished).toHaveBeenCalledWith("skipped");
  });

  it.each([
    [1, 2],
    [2, 1],
  ])(
    "recovers after rejected fingers lift outside the field in order %s, %s",
    (first, second) => {
      const launch = vi.spyOn(GravityEngine.prototype, "launch");
      render(<GravityGuide onFinish={() => {}} />);
      pointer("pointerdown", 300, 300, 1, "touch");
      pointer("pointermove", 260, 300, 1, "touch");
      pointer("pointerdown", 340, 300, 2, "touch");
      pointer("pointerup", 100, 40, first, "touch", document);
      pointer("pointerup", 150, 40, second, "touch", document);
      expect(launch).not.toHaveBeenCalled();
      pointer("pointerdown", 300, 300, 3, "touch");
      pointer("pointerup", 250, 300, 3, "touch");
      expect(launch).toHaveBeenCalledOnce();
      expect(
        screen.getByRole("heading", { name: "Add another while it moves" }),
      ).toBeTruthy();
    },
  );

  it("recovers after the slider cancels a touch that lifts outside the field", () => {
    const launch = vi.spyOn(GravityEngine.prototype, "launch");
    render(<GravityGuide onFinish={() => {}} />);
    launchTwice();
    fireEvent.click(screen.getByRole("button", { name: "Next", exact: true }));
    launch.mockClear();
    pointer("pointerdown", 300, 300, 1, "touch");
    pointer("pointermove", 260, 300, 1, "touch");
    pointer(
      "pointerdown",
      30,
      300,
      2,
      "touch",
      screen.getByRole("slider", { name: "Projectile size" }),
    );
    pointer("pointerup", 100, 40, 1, "touch", document);
    pointer("pointerup", 150, 40, 2, "touch", document);
    expect(launch).not.toHaveBeenCalled();
    pointer("pointerdown", 300, 300, 3, "touch");
    pointer("pointerup", 250, 300, 3, "touch");
    expect(launch).toHaveBeenCalledOnce();
  });

  it("teaches size with a local slider after two launches, without changing saved play preferences", () => {
    localStorage.setItem("orbit.gravity.projectile-size.v1", "1.5");
    const finished = vi.fn();
    const launches = vi.spyOn(GravityEngine.prototype, "launch");
    render(<GravityGuide onFinish={finished} />);
    launchTwice();
    expect(
      screen.getByRole("heading", { name: "Let gravity draw" }),
    ).toBeTruthy();
    expect(screen.getByText(/Particle Interaction/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next", exact: true }));
    expect(screen.getByRole("heading", { name: "Choose a size" })).toBeTruthy();
    const size = screen.getByRole("slider", { name: "Projectile size" });
    const control = size.closest<HTMLElement>(".projectile-size-control")!;
    expect((size as HTMLInputElement).value).toBe("1");
    expect(control.style.getPropertyValue("--projectile-size-thumb")).toBe(
      "16px",
    );
    const engine = launches.mock.instances[0] as GravityEngine;
    const original = engine
      .getSnapshot()
      .particles.map(({ radius, mass }) => ({ radius, mass }));
    fireEvent.change(size, { target: { value: "2" } });
    expect(control.style.getPropertyValue("--projectile-size-thumb")).toBe(
      "32px",
    );
    expect(engine.getProjectileSize()).toBe(2);
    expect(
      engine
        .getSnapshot()
        .particles.map(({ radius, mass }) => ({ radius, mass })),
    ).toEqual(original);
    expect(localStorage.getItem("orbit.gravity.projectile-size.v1")).toBe(
      "1.5",
    );
    fireEvent.keyDown(screen.getByLabelText("Gravity practice field"), {
      key: "Enter",
    });
    const last = engine.getSnapshot().particles.at(-1)!;
    expect(last.radius).toBe(original[0].radius * 2);
    expect(last.mass).toBe(original[0].mass * 4);
    fireEvent.click(screen.getByRole("button", { name: "Next", exact: true }));
    expect(screen.getByText(/Pinch to zoom/)).toBeTruthy();
    expect(
      screen.getByText(/Choose Skip level or Next level below the goal/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start playing" }));
    expect(finished).toHaveBeenCalledWith("complete");
  });

  it("uses the gameplay pull response for both practice prediction and release", () => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1280);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
    const launch = vi.spyOn(GravityEngine.prototype, "launch");
    const aim = vi.spyOn(GravityEngine.prototype, "setLaunch");
    render(<GravityGuide onFinish={() => {}} />);
    const halfPull = gravityPullDistance("mouse", 1280, 800) / 2;
    pointer("pointerdown", 300, 300);
    pointer("pointermove", 300 - halfPull, 300);
    const previewAim = aim.mock.calls.at(-1)![1];
    expect(previewAim.power).toBeCloseTo(0.25);
    pointer("pointerup", 300 - halfPull, 300);
    expect(aim.mock.calls.at(-1)![1]).toEqual(previewAim);
    const state = (launch.mock.instances[0] as GravityEngine).getSnapshot();
    expect(state.particles[0].velocity.x).toBeCloseTo(105);
  });

  it("keeps the size input inside the keyboard focus loop and permits skipping the size lesson", () => {
    const finish = vi.fn();
    render(<GravityGuide onFinish={finish} />);
    launchTwice();
    fireEvent.click(screen.getByRole("button", { name: "Next", exact: true }));
    const slider = screen.getByRole("slider", { name: "Projectile size" });
    const skip = screen.getByRole("button", { name: "Skip", exact: true });
    slider.focus();
    fireEvent.keyDown(slider, { key: "Tab" });
    expect(document.activeElement).toBe(skip);
    fireEvent.keyDown(skip, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(slider);
    fireEvent.click(skip);
    expect(finish).toHaveBeenCalledWith("skipped");
  });
});

it("rejects a practice launch inside a core with feedback and keeps the current lesson", () => {
  const aim = vi.spyOn(GravityEngine.prototype, "setLaunch");
  render(<GravityGuide onFinish={() => {}} />);
  pointer("pointerdown", 450, 420);
  pointer("pointermove", 405, 420);
  const engine = aim.mock.instances[0] as GravityEngine;
  pointer("pointerup", 405, 420);
  expect(engine.getSnapshot().particles).toHaveLength(0);
  expect(
    screen.getByRole("heading", { name: "Make your first planet" }),
  ).toBeTruthy();
  expect(screen.getByRole("status").textContent).toBe("Start in clear space");
  pointer("pointerdown", 300, 650);
  pointer("pointerup", 255, 650);
  expect(engine.getSnapshot().particles).toHaveLength(1);
  expect(
    screen.getByRole("heading", { name: "Add another while it moves" }),
  ).toBeTruthy();
  expect(screen.queryByText("Start in clear space")).toBeNull();
});
