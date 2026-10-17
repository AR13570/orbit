import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import GravityGame from "../../src/gravity/GravityGame";
import { GravityEngine } from "../../src/gravity/engine";
import { newDraft, toGravityLevel } from "../../src/gravity/creator/model";

const previews = vi.hoisted(() => ({
  last: [] as { x: number; y: number }[],
  scale: 1,
}));
let frame: FrameRequestCallback;
vi.mock("../../src/gravity/renderer", () => ({
  createGravityRenderer: () => ({
    resize() {},
    render(_state: unknown, preview: { x: number; y: number }[]) {
      previews.last = [...preview];
    },
    destroy() {},
    setZoom() {},
    getScale: () => previews.scale,
    screenToWorld: (x: number, y: number) => ({ x, y }),
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
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  previews.last = [];
  previews.scale = 1;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frame = callback;
    return 1;
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function pointer(element: Element, type: string, x: number, y: number, id = 1) {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
  Object.defineProperties(event, {
    pointerId: { value: id },
    isPrimary: { value: id === 1 },
    pointerType: { value: "touch" },
  });
  fireEvent(element, event);
}
function field() {
  const canvas = screen.getByLabelText(
    "Gravity orbital field",
  ) as HTMLCanvasElement;
  canvas.setPointerCapture = () => {};
  canvas.hasPointerCapture = () => false;
  return canvas;
}
function shoot(canvas: HTMLCanvasElement) {
  pointer(canvas, "pointerdown", 300, 300);
  pointer(canvas, "pointerup", 330, 300);
}
it("sizes only future projectiles and keeps the size through retry, skip and reload", () => {
  const launch = vi.spyOn(GravityEngine.prototype, "launch");
  const view = render(<GravityGame onExit={() => {}} />);
  const slider = screen.getByRole("slider", { name: "Projectile size" });
  expect((slider as HTMLInputElement).value).toBe("1");
  shoot(field());
  const engine = launch.mock.instances[0] as GravityEngine;
  const before = engine.getSnapshot();
  fireEvent.change(slider, { target: { value: "2" } });
  expect(engine.getSnapshot().particles).toEqual(before.particles);
  expect(engine.getSnapshot().elapsed).toBe(before.elapsed);
  shoot(field());
  const particles = engine.getSnapshot().particles;
  expect(particles[1].radius).toBeCloseTo(particles[0].radius * 2);
  expect(particles[1].mass).toBeCloseTo(particles[0].mass * 4);
  expect(particles[1].velocity).toEqual(particles[0].velocity);
  fireEvent.click(screen.getByRole("button", { name: "Reset level (R)" }));
  shoot(field());
  expect(engine.getSnapshot().particles[0].radius).toBe(particles[1].radius);
  fireEvent.click(screen.getByRole("button", { name: "Skip level" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Skip level", exact: true }),
  );
  expect((slider as HTMLInputElement).value).toBe("2");
  view.unmount();
  render(<GravityGame onExit={() => {}} />);
  expect(
    (
      screen.getByRole("slider", {
        name: "Projectile size",
      }) as HTMLInputElement
    ).value,
  ).toBe("2");
});
it("cancels a held shot when the size control is touched, even before it changes", () => {
  const launch = vi.spyOn(GravityEngine.prototype, "launch");
  render(<GravityGame onExit={() => {}} />);
  const canvas = field();
  pointer(canvas, "pointerdown", 300, 300);
  pointer(canvas, "pointermove", 330, 300);
  pointer(
    screen.getByRole("slider", { name: "Projectile size" }),
    "pointerdown",
    30,
    400,
    2,
  );
  pointer(canvas, "pointerup", 330, 300);
  expect(launch).not.toHaveBeenCalled();
  shoot(canvas);
  expect(launch).toHaveBeenCalledOnce();
});
it("cancels predictions on keyboard size changes and keeps the control inert when paused", () => {
  const launch = vi.spyOn(GravityEngine.prototype, "launch");
  render(<GravityGame onExit={() => {}} />);
  const canvas = field();
  pointer(canvas, "pointerdown", 300, 300);
  pointer(canvas, "pointermove", 330, 300);
  act(() => frame(100));
  expect(previews.last.length).toBeGreaterThan(0);
  fireEvent.change(screen.getByRole("slider", { name: "Projectile size" }), {
    target: { value: "1.1" },
  });
  act(() => frame(200));
  expect(previews.last).toEqual([]);
  pointer(canvas, "pointerup", 330, 300);
  expect(launch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  expect(screen.queryByRole("slider", { name: "Projectile size" })).toBeNull();
});
it("uses the custom projectile profile as its unchanged default scale", () => {
  const draft = newDraft();
  draft.physics.planetRadius = 7;
  draft.physics.planetMass = 3;
  const level = toGravityLevel(draft);
  const launch = vi.spyOn(GravityEngine.prototype, "launch");
  render(<GravityGame customLevel={level} onExit={() => {}} />);
  expect(
    (
      screen.getByRole("slider", {
        name: "Projectile size",
      }) as HTMLInputElement
    ).value,
  ).toBe("1");
  shoot(field());
  const particle = (launch.mock.instances[0] as GravityEngine).getSnapshot()
    .particles[0];
  expect(particle.radius).toBe(level.physics!.planetRadius);
  expect(particle.mass).toBe(level.physics!.planetMass);
});
it("keeps a fine size preference aligned with the slider and new launches", () => {
  localStorage.setItem("orbit.gravity.projectile-size.v1", "1.23");
  const launch = vi.spyOn(GravityEngine.prototype, "launch");
  const draft = newDraft();
  draft.physics.planetRadius = 7;
  render(<GravityGame customLevel={toGravityLevel(draft)} onExit={() => {}} />);
  const slider = screen.getByRole("slider", {
    name: "Projectile size",
  }) as HTMLInputElement;
  expect(slider.value).toBe("1.23");
  shoot(field());
  const engine = launch.mock.instances[0] as GravityEngine;
  expect(engine.getProjectileSize()).toBe(Number(slider.value));
  expect(engine.getSnapshot().particles[0].radius).toBeCloseTo(8.61);
});

it("starts at the previous default size without a percentage readout", () => {
  localStorage.setItem("orbit.gravity.projectile-size.v1", "0.5");
  render(<GravityGame onExit={() => {}} />);
  const slider = screen.getByRole("slider", { name: "Projectile size" });
  expect(slider.getAttribute("min")).toBe("1");
  expect((slider as HTMLInputElement).value).toBe("1");
  expect(slider.getAttribute("aria-valuetext")).toBe("Default size");
  expect(slider.closest(".projectile-size-control")!.textContent).not.toContain(
    "%",
  );
  fireEvent.change(slider, { target: { value: "1.4" } });
  expect(slider.getAttribute("aria-valuetext")).toBe("1.4 times default size");
  fireEvent.change(slider, { target: { value: "2" } });
  expect(slider.getAttribute("aria-valuetext")).toBe("Double size");
});

it("sizes the endpoint circles and growing thumb from the projected custom planet", () => {
  const draft = newDraft();
  draft.physics.planetRadius = 7;
  render(<GravityGame customLevel={toGravityLevel(draft)} onExit={() => {}} />);
  const slider = screen.getByRole("slider", { name: "Projectile size" });
  const control = slider.closest<HTMLElement>(".projectile-size-control")!;
  expect(control.style.getPropertyValue("--projectile-size-min")).toBe("14px");
  expect(control.style.getPropertyValue("--projectile-size-max")).toBe("28px");
  for (const [value, diameter] of [
    ["1", "14px"],
    ["1.5", "21px"],
    ["2", "28px"],
  ]) {
    fireEvent.change(slider, { target: { value } });
    expect(control.style.getPropertyValue("--projectile-size-thumb")).toBe(
      diameter,
    );
  }
  act(() => frame(100));
  // Changing size must not make the default endpoint grow along with the selection.
  expect(control.style.getPropertyValue("--projectile-size-min")).toBe("14px");
  previews.scale = 2;
  act(() => frame(200));
  // Keep oversized custom planets inside the control with the same 1:2 ratio.
  expect(control.style.getPropertyValue("--projectile-size-min")).toBe("18px");
  expect(control.style.getPropertyValue("--projectile-size-max")).toBe("36px");
  expect(control.style.getPropertyValue("--projectile-size-thumb")).toBe(
    "36px",
  );
  previews.scale = 0.1;
  act(() => frame(300));
  expect(control.style.getPropertyValue("--projectile-size-min")).toBe("9px");
  expect(control.style.getPropertyValue("--projectile-size-max")).toBe("18px");
});
