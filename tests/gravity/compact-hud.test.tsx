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

it("keeps skip and completed next actions beside the objective through real completion", () => {
  const setSize = vi.spyOn(GravityEngine.prototype, "setProjectileSize");
  const { container } = render(<GravityGame onExit={() => {}} />);
  const engine = setSize.mock.instances[0] as GravityEngine;
  const objective = container.querySelector(".gravity-objective")!;
  const footer = container.querySelector(".gravity-footer")!;
  const skip = screen.getByRole("button", { name: "Skip level" });
  expect(objective.contains(skip)).toBe(true);
  expect(skip.querySelector("svg")).toBeTruthy();
  expect(footer.querySelector("button")).toBeNull();
  expect(container.querySelector(".gameplay-zoom-controls")).toBeNull();

  fireEvent.click(skip);
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
  expect(objective.contains(next)).toBe(true);
  expect(next.querySelector("svg")).toBeTruthy();
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
