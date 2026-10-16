import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OdesseyGame } from "../../src/App";
import { OrbitEngine } from "../../src/game/engine";
import {
  loadOdesseyCheckpoint,
  resolveOdesseySeed,
  saveOdesseyCheckpoint,
} from "../../src/game/progress";
vi.mock("../../src/render/renderer", () => ({
  createRenderer: () => ({
    resize() {},
    prepareFrame() {},
    render() {},
    destroy() {},
    setWalkthroughFocus() {},
    getVisibleBounds: () => ({ x: -100, y: -100, width: 5000, height: 3000 }),
    getViewport: () => ({
      center: { x: 900, y: 500 },
      scale: 1,
      transitioning: false,
    }),
    screenToWorld: (x: number, y: number) => ({ x, y }),
    worldToScreen: (p: unknown) => p,
  }),
}));
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("orbit.walkthrough.odessey.v1", "complete");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
  window.history.replaceState({}, "", "/?mode=odessey&seed=42");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});
it("resumes the saved checkpoint and Reset level retains it", () => {
  saveOdesseyCheckpoint(new OrbitEngine(42, 5).getCheckpoint());
  const view = render(<OdesseyGame />);
  expect(screen.getByLabelText("Checkpoint 4")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  fireEvent.click(screen.getByRole("button", { name: "Reset level (R)" }));
  expect(screen.getByLabelText("Checkpoint 4")).toBeTruthy();
  view.unmount();
  render(<OdesseyGame />);
  expect(screen.getByLabelText("Checkpoint 4")).toBeTruthy();
});
it("New seed starts fresh and its URL resumes without replacing explicit or default journeys", () => {
  localStorage.setItem("orbit.odessey.default-seed.v1", "17");
  saveOdesseyCheckpoint(new OrbitEngine(42, 5).getCheckpoint());
  const view = render(<OdesseyGame />);
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  fireEvent.click(screen.getByRole("button", { name: "New seed" }));
  expect(screen.getByLabelText("Checkpoint 0")).toBeTruthy();
  const newSeed = resolveOdesseySeed(window.location.search);
  expect(newSeed).not.toBe(42);
  expect(localStorage.getItem("orbit.odessey.default-seed.v1")).toBe("17");
  expect(loadOdesseyCheckpoint(42)?.checkpointCount).toBe(4);
  expect(loadOdesseyCheckpoint(newSeed)?.checkpointCount).toBe(0);
  view.unmount();
  render(<OdesseyGame />);
  expect(screen.getByLabelText("Checkpoint 0")).toBeTruthy();
});
it("debug level and tutorial practice do not replace the real saved checkpoint", () => {
  saveOdesseyCheckpoint(new OrbitEngine(42, 5).getCheckpoint());
  const saved = localStorage.getItem("orbit.odessey.progress.v1:42");
  window.history.replaceState({}, "", "/?mode=odessey&seed=42&debug=1&level=15");
  const view = render(<OdesseyGame />);
  expect(screen.getByLabelText("Checkpoint 14")).toBeTruthy();
  expect(localStorage.getItem("orbit.odessey.progress.v1:42")).toBe(saved);
  view.unmount();
  window.history.replaceState({}, "", "/?mode=odessey&seed=42");
  render(<OdesseyGame startTutorial />);
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(localStorage.getItem("orbit.odessey.progress.v1:42")).toBe(saved);
});
it("repeated New seed in an ordinary journey keeps updating its default seed", () => {
  window.history.replaceState({}, "", "/?mode=odessey");
  localStorage.setItem("orbit.odessey.default-seed.v1", "17");
  let view = render(<OdesseyGame />);
  for (const next of [18, 19]) {
    vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      (array as Uint32Array)[0] = next;
      return array;
    });
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.click(screen.getByRole("button", { name: "New seed" }));
    expect(resolveOdesseySeed("")).toBe(next);
    expect(new URLSearchParams(window.location.search).has("seed")).toBe(false);
    view.unmount();
    view = render(<OdesseyGame />);
    expect(resolveOdesseySeed("")).toBe(next);
    expect(screen.getByLabelText("Checkpoint 0")).toBeTruthy();
  }
});
