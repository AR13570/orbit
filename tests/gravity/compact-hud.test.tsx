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
import { gravityForceAt, gravityLaunchPower } from "../../src/gravity/physics";
import type { GravityLevel } from "../../src/gravity/types";

function hudLevel(index: number): GravityLevel {
  const body = {
    id: "fixture-core",
    kind: "attractor" as const,
    position: { x: 600, y: 600 },
    radius: 96,
    strength: 12000000,
    softening: 180,
  };
  const position = { x: 790, y: 600 };
  const speed = Math.sqrt(-gravityForceAt(position, [body]).x * 190);
  return {
    seed: 42,
    index,
    source: "campaign",
    title: `Countdown fixture ${index + 1}`,
    family: "loop",
    bounds: { x: 0, y: 0, width: 1200, height: 1200 },
    launch: position,
    bodies: [body],
    orbitPadding: 210,
    objective: { kind: "loop", count: 1, turns: 2, hold: 0 },
    requirements: [{ bodyId: body.id, count: 1, turns: 2 }],
    physics: {
      planetRadius: 6,
      planetMass: 1,
      planetGravity: true,
      planetCollisions: "none",
      bodyCollisions: true,
    },
    witness: [
      {
        time: 0,
        position,
        velocity: { x: 0, y: speed },
        angle: Math.PI / 2,
        power: gravityLaunchPower(speed),
      },
    ],
  };
}
// Isolate lifecycle UI from campaign authoring while retaining the real engine,
// two full physical revolutions, saved progress and next-level navigation.
vi.mock("../../src/gravity/campaign", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/gravity/campaign")>()),
  getGravityLevel: (_seed: number, index: number) => hudLevel(index),
}));

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
  finish(engine);
  expect(engine.getRenderSnapshot().progress.complete).toBe(true);
  // Losing the actual orbit after earning success must not revoke the UI win.
  engine.setFlightBounds({ x: -10000, y: -10000, width: 1, height: 1 });
  engine.update(1 / 120);
  expect(engine.getRenderSnapshot().progress.complete).toBe(false);
  expect(engine.getRenderSnapshot().complete).toBe(true);
  expect(engine.getRenderSnapshot().completedCount).toBe(1);
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
  engine.setTimeScale(1);
  const level = engine.getRenderSnapshot().level;
  const witness = level.witness;
  expect(level.objective.turns).toBe(2);
  let shot = 0;
  for (let n = 0; n < 60 * 120 && !engine.getRenderSnapshot().complete; n++) {
    while (
      shot < witness.length &&
      witness[shot].time <= engine.getRenderSnapshot().elapsed + 1e-8
    ) {
      const launch = witness[shot++];
      expect(engine.launchFrom(launch.position!, launch.velocity!)).toBe(true);
    }
    engine.update(1 / 120);
  }
  const completed = engine.getRenderSnapshot();
  expect(shot).toBe(witness.length);
  expect(completed.complete).toBe(true);
  expect(completed.progress.complete).toBe(true);
  expect(
    Math.abs(completed.particles[0].orbits[level.bodies[0].id].localWinding),
  ).toBeGreaterThanOrEqual(4 * Math.PI - 1e-9);
}

it("fills the border and advances once after ten active seconds, pausing with the menu", () => {
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
  expect(Number(border.style.strokeDashoffset)).toBeCloseTo(0.9, 3);
  fireEvent.click(screen.getByRole("button", { name: "Pause", exact: true }));
  act(() => frame(7100));
  expect(engine.getRenderSnapshot().level.index).toBe(0);
  expect(Number(border.style.strokeDashoffset)).toBeCloseTo(0.9, 3);
  fireEvent.click(screen.getByRole("button", { name: "Resume", exact: true }));
  act(() => frame(16099));
  expect(engine.getRenderSnapshot().level.index).toBe(0);
  act(() => frame(16100));
  expect(engine.getRenderSnapshot().level.index).toBe(1);
  act(() => frame(19100));
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

it("cancels automatic advancement while keeping manual Next available, then resets for a new win", () => {
  const setSize = vi.spyOn(GravityEngine.prototype, "setProjectileSize");
  render(<GravityGame onExit={() => {}} />);
  const engine = setSize.mock.instances[0] as GravityEngine;
  finish(engine);
  act(() => frame(100));
  act(() => frame(2100));
  const cancel = screen.getByRole("button", {
    name: "Cancel automatic next level",
  });
  expect(cancel.textContent).toBe("Cancel");
  fireEvent.click(cancel);
  expect(
    screen.queryByRole("button", { name: "Cancel automatic next level" }),
  ).toBeNull();
  expect(document.querySelector(".gravity-next-progress")).toBeNull();
  expect(
    screen.getByText(
      "Automatic advancement cancelled. Choose Next level when ready.",
    ),
  ).toBeTruthy();
  act(() => frame(30100));
  expect(engine.getRenderSnapshot().level.index).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "Next level" }));
  expect(engine.getRenderSnapshot().level.index).toBe(1);
  act(() => frame(30200));
  finish(engine);
  act(() => frame(30300));
  expect(
    screen.getByRole("button", { name: "Cancel automatic next level" }),
  ).toBeTruthy();
  expect(document.querySelector(".gravity-next-progress")).toBeTruthy();
  act(() => frame(40300));
  expect(engine.getRenderSnapshot().level.index).toBe(2);
});

it("cancels a running next-level countdown with Escape without opening pause", () => {
  const setSize = vi.spyOn(GravityEngine.prototype, "setProjectileSize");
  render(<GravityGame onExit={() => {}} />);
  const engine = setSize.mock.instances[0] as GravityEngine;
  finish(engine);
  act(() => frame(100));
  act(() => frame(2100));
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "Paused" })).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Cancel automatic next level" }),
  ).toBeNull();
  expect(document.querySelector(".gravity-next-progress")).toBeNull();
  act(() => frame(30100));
  expect(engine.getRenderSnapshot().level.index).toBe(0);
  // Once the countdown is cancelled, Escape retains its normal pause action.
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.getByRole("dialog", { name: "Paused" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Resume", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Next level" }));
  expect(engine.getRenderSnapshot().level.index).toBe(1);
});
