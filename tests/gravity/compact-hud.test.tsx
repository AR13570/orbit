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

vi.mock("../../src/gravity/renderer", () => ({
  createGravityRenderer: () => ({
    resize() {},
    render() {},
    destroy() {},
    setZoom() {},
    getScale: () => 1,
    worldToScreen: (point: unknown) => point,
    screenToWorld: (x: number, y: number) => ({ x, y }),
  }),
}));

let frame: FrameRequestCallback;
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("orbit.walkthrough.gravity.v2", "complete");
  window.history.replaceState({}, "", "/?seed=42");
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
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps skip and completed next actions in the footer through real completion", () => {
  const setSize = vi.spyOn(GravityEngine.prototype, "setProjectileSize");
  const { container } = render(<GravityGame onExit={() => {}} />);
  const engine = setSize.mock.instances[0] as GravityEngine;
  const objective = container.querySelector(".gravity-objective")!;
  const footer = container.querySelector(".gravity-footer")!;
  const skip = screen.getByRole("button", { name: "Skip level" });
  expect(objective.contains(skip)).toBe(false);
  expect(footer.contains(skip)).toBe(true);
  expect(skip.querySelector("svg")).toBeTruthy();
  expect(footer.querySelector("button")).toBe(skip);
  expect(container.querySelector(".gameplay-zoom-controls")).toBeNull();

  fireEvent.click(skip);
  expect(screen.getByRole("dialog", { name: "Skip this level?" })).toBeTruthy();
  expect(screen.getByText("Level 1")).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Skip level", exact: true }),
  );
  expect(screen.getByText("Level 2")).toBeTruthy();
  expect(engine.getSnapshot().completedCount).toBe(0);
  const progressAfterSkip = JSON.parse(
    localStorage.getItem("orbit.gravity.progress.v1:42")!,
  );
  expect(progressAfterSkip.currentIndex).toBe(1);
  expect(progressAfterSkip.completedIndices).toEqual([]);

  engine.goTo(0);
  const witness = engine.getSnapshot().level.witness;
  let shot = 0;
  for (
    let tick = 0;
    tick < 85 * 120 && !engine.getRenderSnapshot().complete;
    tick++
  ) {
    while (
      shot < witness.length &&
      witness[shot].time <= engine.getRenderSnapshot().elapsed + 1e-8
    ) {
      const launch = witness[shot++];
      if (launch.position && launch.velocity)
        engine.launchFrom(launch.position, launch.velocity);
      else {
        engine.setAim(launch.angle, launch.power);
        engine.launch();
      }
    }
    engine.update(1 / 120);
  }
  expect(engine.getSnapshot().complete).toBe(true);
  act(() => frame(100));
  const next = screen.getByRole("button", { name: "Next level" });
  expect(objective.contains(next)).toBe(false);
  expect(footer.contains(next)).toBe(true);
  expect(next.querySelector(".gravity-next-border rect")).toBeTruthy();
  expect(screen.getByText("Orbits aligned")).toBeTruthy();
  expect(
    JSON.parse(localStorage.getItem("orbit.gravity.progress.v1:42")!)
      .completedIndices,
  ).toEqual([0]);
  fireEvent.click(next);
  expect(screen.getByText("Level 2")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Skip level" })).toBeTruthy();
});

it("places the playtest return below its objective and exits once", () => {
  const onExit = vi.fn();
  const { container } = render(
    <GravityGame onExit={onExit} customLevel={toGravityLevel(newDraft())} />,
  );
  const back = screen.getByRole("button", { name: "Back to editor" });
  expect(container.querySelector(".gravity-objective")!.contains(back)).toBe(
    true,
  );
  expect(back.querySelector("svg")).toBeTruthy();
  expect(container.querySelector(".gravity-footer button")).toBeNull();
  fireEvent.click(back);
  expect(onExit).toHaveBeenCalledTimes(1);
});

function finish(engine: GravityEngine) {
  const witness = engine.getRenderSnapshot().level.witness;
  let shot = 0;
  for (let n = 0; n < 85 * 120 && !engine.getRenderSnapshot().complete; n++) {
    while (
      shot < witness.length &&
      witness[shot].time <= engine.getRenderSnapshot().elapsed + 1e-8
    ) {
      const launch = witness[shot++];
      if (launch.position && launch.velocity)
        engine.launchFrom(launch.position, launch.velocity);
      else {
        engine.setAim(launch.angle, launch.power);
        engine.launch();
      }
    }
    engine.update(1 / 120);
  }
  expect(engine.getRenderSnapshot().complete).toBe(true);
}

it("fills the border and advances once after three active seconds, pausing with the menu", () => {
  const setSize = vi.spyOn(GravityEngine.prototype, "setProjectileSize");
  render(<GravityGame onExit={() => {}} />);
  const engine = setSize.mock.instances[0] as GravityEngine;
  finish(engine);
  act(() => frame(100));
  const border = document.querySelector<SVGPathElement>(
    ".gravity-next-progress",
  )!;
  expect(border).toBeTruthy();
  act(() => frame(1100));
  expect(Number(border.style.strokeDashoffset)).toBeCloseTo(2 / 3, 3);
  fireEvent.click(screen.getByRole("button", { name: "Pause", exact: true }));
  act(() => frame(7100));
  expect(engine.getRenderSnapshot().level.index).toBe(0);
  expect(Number(border.style.strokeDashoffset)).toBeCloseTo(2 / 3, 3);
  fireEvent.click(screen.getByRole("button", { name: "Resume", exact: true }));
  act(() => frame(9099));
  expect(engine.getRenderSnapshot().level.index).toBe(0);
  act(() => frame(9100));
  expect(engine.getRenderSnapshot().level.index).toBe(1);
  act(() => frame(12100));
  expect(engine.getRenderSnapshot().level.index).toBe(1);
});

it("keeps the level when a skip is cancelled and clears a pending countdown on reset", () => {
  const setSize = vi.spyOn(GravityEngine.prototype, "setProjectileSize");
  render(<GravityGame onExit={() => {}} />);
  const engine = setSize.mock.instances[0] as GravityEngine;
  fireEvent.click(
    screen.getByRole("button", { name: "Skip level", exact: true }),
  );
  expect(screen.getByRole("dialog", { name: "Skip this level?" })).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Keep playing", exact: true }),
  );
  expect(engine.getRenderSnapshot().level.index).toBe(0);
  expect(screen.queryByRole("dialog")).toBeNull();
  finish(engine);
  act(() => frame(100));
  act(() => frame(2100));
  fireEvent.click(
    screen.getByRole("button", { name: "Reset level (R)", exact: true }),
  );
  act(() => frame(10100));
  expect(engine.getRenderSnapshot().level.index).toBe(0);
  expect(
    screen.getByRole("button", { name: "Skip level", exact: true }),
  ).toBeTruthy();
});
