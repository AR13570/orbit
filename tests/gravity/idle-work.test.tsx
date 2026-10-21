import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Profiler } from "react";
import GravityGame from "../../src/gravity/GravityGame";
import { GravityEngine } from "../../src/gravity/engine";
import { setTheme } from "../../src/theme";
const { draw, pauseMusic } = vi.hoisted(() => ({
  draw: vi.fn(),
  pauseMusic: vi.fn(),
}));
vi.mock("../../src/gravity/renderer", () => ({
  createGravityRenderer: () => ({
    resize() {},
    render: draw,
    destroy() {},
    prepareFrame() {},
    setZoom() {},
    getScale: () => 1,
    getDefaultScale: () => 1,
    getFlightBounds: () => ({ x: -1000, y: -1000, width: 4000, height: 4000 }),
    screenToWorld: (x: number, y: number) => ({ x, y }),
  }),
}));
vi.mock("../../src/audio/useAmbientMusic", () => ({
  useAmbientMusic: () => pauseMusic,
}));
// Test the parent loop independently of the guide's own animated practice scene.
vi.mock("../../src/gravity/GravityGuide", async (original) => ({
  ...(await original<typeof import("../../src/gravity/GravityGuide")>()),
  default: ({ onFinish }: { onFinish: (result: "complete") => void }) => (
    <button onClick={() => onFinish("complete")}>Finish guide</button>
  ),
}));
let frame: FrameRequestCallback;
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("orbit.walkthrough.gravity.v2", "complete");
  document.documentElement.dataset.theme = "dark";
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    frame = cb;
    return 1;
  });
  draw.mockClear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const tick = (time: number) => act(() => frame(time));
it("requests only one computed snapshot per active frame even when the HUD updates", () => {
  const snapshots = vi.spyOn(GravityEngine.prototype, "getRenderSnapshot");
  let commits = 0;
  render(
    <Profiler
      id="game"
      onRender={() => {
        commits++;
      }}
    >
      <GravityGame onExit={() => {}} />
    </Profiler>,
  );
  tick(0);
  const initialCommits = commits;
  snapshots.mockClear();
  for (let n = 1; n <= 8; n++) tick(n * 100);
  expect(snapshots).toHaveBeenCalledTimes(8);
  expect(commits).toBe(initialCommits);
});
it("does no snapshot or canvas work while paused and repaints theme, settings and resize changes once", () => {
  const snapshots = vi.spyOn(GravityEngine.prototype, "getRenderSnapshot");
  render(<GravityGame onExit={() => {}} />);
  tick(0);
  fireEvent.click(screen.getByRole("button", { name: "Pause", exact: true }));
  tick(20);
  snapshots.mockClear();
  draw.mockClear();
  for (let n = 1; n <= 10; n++) tick(20 + n * 100);
  expect(draw).not.toHaveBeenCalled();
  expect(snapshots).not.toHaveBeenCalled();
  act(() => setTheme("light"));
  tick(1040);
  expect(draw).toHaveBeenCalledTimes(1);
  draw.mockClear();
  tick(1060);
  expect(draw).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Advanced", exact: true }),
  );
  fireEvent.click(
    screen.getByRole("switch", { name: "Particle Interaction", exact: true }),
  );
  tick(1080);
  expect(draw).toHaveBeenCalledTimes(1);
  draw.mockClear();
  act(() => window.dispatchEvent(new Event("resize")));
  tick(1100);
  expect(draw).toHaveBeenCalledTimes(1);
  draw.mockClear();
  tick(1120);
  expect(draw).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Resume", exact: true }));
  tick(1140);
  expect(draw).toHaveBeenCalledTimes(1);
  expect(draw.mock.calls[0][2]).toBeLessThan(0.1);
});
it("keeps the main scene frozen during help and resumes without advancing the wave clock through help time", () => {
  const snapshots = vi.spyOn(GravityEngine.prototype, "getRenderSnapshot");
  render(<GravityGame onExit={() => {}} startTutorial />);
  tick(0);
  draw.mockClear();
  snapshots.mockClear();
  for (let n = 1; n <= 10; n++) tick(n * 100);
  expect(draw).not.toHaveBeenCalled();
  expect(snapshots).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Finish guide" }));
  tick(1020);
  expect(draw).toHaveBeenCalledTimes(1);
  expect(draw.mock.calls[0][2]).toBeCloseTo(0.02);
});
it("retains a dirty repaint while hidden and paints once on returning to the paused view", () => {
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  render(<GravityGame onExit={() => {}} />);
  tick(0);
  hidden.mockReturnValue(true);
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  tick(20);
  draw.mockClear();
  for (let n = 1; n <= 10; n++) tick(20 + n * 100);
  expect(draw).not.toHaveBeenCalled();
  hidden.mockReturnValue(false);
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  tick(1040);
  expect(draw).toHaveBeenCalledTimes(1);
  draw.mockClear();
  tick(1060);
  expect(draw).not.toHaveBeenCalled();
});
