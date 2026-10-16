import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZenGame } from "../../src/App";
import GravityGame from "../../src/gravity/GravityGame";
import { setSoundMuted } from "../../src/soundPreference";
const soundtrack = vi.hoisted(() => ({ states: [] as boolean[] }));
vi.mock("../../src/audio/useAmbientMusic", () => ({
  useAmbientMusic: (active: boolean) => {
    soundtrack.states.push(active);
    return () => {};
  },
}));
vi.mock("../../src/render/renderer", () => ({
  createRenderer: () => ({
    resize() {},
    prepareFrame() {},
    getVisibleBounds: () => ({ x: 0, y: 0, width: 1800, height: 1000 }),
    render() {},
    destroy() {},
    getViewport: () => ({ scale: 1, transitioning: false }),
    setWalkthroughFocus() {},
    worldToScreen: (p: unknown) => p,
  }),
}));
vi.mock("../../src/gravity/renderer", () => ({
  createGravityRenderer: () => ({
    resize() {},
    render() {},
    destroy() {},
    getScale: () => 1,
    setWalkthroughFocus() {},
    worldToScreen: (p: unknown) => p,
    screenToWorld: (x: number, y: number) => ({ x, y }),
  }),
}));
const KEY = "orbit.sound-muted.v1";
beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/");
  localStorage.setItem("orbit.walkthrough.zen.v1", "complete");
  localStorage.setItem("orbit.walkthrough.gravity.v2", "complete");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
  soundtrack.states = [];
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setSoundMuted(false);
});
const openPause = () =>
  fireEvent.click(screen.getByRole("button", { name: "Pause", exact: true }));
describe("shared remembered sound", () => {
  it.each(["zen", "gravity"])(
    "starts %s muted before soundtrack startup when Sound off was saved",
    (mode) => {
      localStorage.setItem(KEY, "true");
      render(mode === "zen" ? <ZenGame /> : <GravityGame onExit={() => {}} />);
      expect(soundtrack.states[0]).toBe(false);
      openPause();
      expect(
        screen
          .getByRole("button", { name: "Sound off", exact: true })
          .getAttribute("aria-pressed"),
      ).toBe("false");
    },
  );
  it("saves both choices immediately and shares them across mode remounts", () => {
    let view = render(<ZenGame />);
    openPause();
    fireEvent.click(
      screen.getByRole("button", { name: "Sound on", exact: true }),
    );
    expect(localStorage.getItem(KEY)).toBe("true");
    view.unmount();
    view = render(<GravityGame onExit={() => {}} />);
    openPause();
    fireEvent.click(
      screen.getByRole("button", { name: "Sound off", exact: true }),
    );
    expect(localStorage.getItem(KEY)).toBe("false");
    view.unmount();
    render(<ZenGame />);
    openPause();
    expect(
      screen
        .getByRole("button", { name: "Sound on", exact: true })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
});

it("updates mounted menus from storage changes and clearing the saved setting", () => {
  render(<GravityGame onExit={() => {}} />);
  openPause();
  localStorage.setItem(KEY, "true");
  fireEvent(
    window,
    new StorageEvent("storage", { key: KEY, newValue: "true" }),
  );
  expect(
    screen.getByRole("button", { name: "Sound off", exact: true }),
  ).toBeTruthy();
  localStorage.clear();
  fireEvent(window, new StorageEvent("storage", { key: null }));
  expect(
    screen.getByRole("button", { name: "Sound on", exact: true }),
  ).toBeTruthy();
});
it("shares a muted session across mode remounts when storage writes fail", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  const view = render(<ZenGame />);
  openPause();
  fireEvent.click(
    screen.getByRole("button", { name: "Sound on", exact: true }),
  );
  view.unmount();
  soundtrack.states = [];
  render(<GravityGame onExit={() => {}} />);
  expect(soundtrack.states[0]).toBe(false);
  openPause();
  expect(
    screen.getByRole("button", { name: "Sound off", exact: true }),
  ).toBeTruthy();
});
