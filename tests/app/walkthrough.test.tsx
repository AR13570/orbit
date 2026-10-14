import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  act,
} from "@testing-library/react";
import App, { ZenGame } from "../../src/App";
import GravityGame from "../../src/gravity/GravityGame";
import { tutorialKeys } from "../../src/tutorial/state";
import { newDraft, toGravityLevel } from "../../src/gravity/creator/model";
vi.mock("../../src/render/renderer", () => ({
  createRenderer: () => ({
    resize() {},
    prepareFrame() {},
    render() {},
    destroy() {},
    getVisibleBounds: () => ({ x: -200, y: -200, width: 2200, height: 1400 }),
    getViewport: () => ({ scale: 1, transitioning: false }),
    setWalkthroughFocus() {},
    worldToScreen: () => ({ x: 300, y: 200 }),
  }),
}));
vi.mock("../../src/gravity/renderer", () => ({
  createGravityRenderer: () => ({
    resize() {},
    render() {},
    destroy() {},
    getScale: () => 1,
    setWalkthroughFocus() {},
    worldToScreen: () => ({ x: 300, y: 200 }),
  }),
}));
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function tick(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
}
function practiceKey(key: string, mode: "Zen" | "Gravity" = "Zen") {
  const field = screen.getByLabelText(`${mode} practice field`);
  field.focus();
  fireEvent.keyDown(field, { key });
}
function continuePractice() {
  const button = screen.getByRole("button", {
    name: "Continue",
  }) as HTMLButtonElement;
  expect(button.disabled).toBe(false);
  fireEvent.click(button);
  tick(300);
}
function completeZenPractice() {
  for (let i = 0; i < 4; i++) continuePractice();
  const continueButton = () =>
    screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
  expect(continueButton().disabled).toBe(true);
  tick(1000);
  practiceKey(" ");
  for (let i = 0; i < 160 && continueButton().disabled; i++) tick(250);
  continuePractice();
  const finish = () =>
    screen.getByRole("button", { name: "Start playing" }) as HTMLButtonElement;
  expect(finish().disabled).toBe(true);
  tick(1000);
  practiceKey(" ");
  expect(document.querySelector(".practice-pull-guide")).toBeNull();
  practiceKey("m");
  tick(1000);
  practiceKey(" ");
  for (
    let i = 0;
    i < 600 && !screen.getByRole("status").textContent?.includes("Tap now");
    i++
  )
    tick(50);
  expect(screen.getByRole("status").textContent).toContain("Tap now");
  practiceKey("s");
  for (let i = 0; i < 160 && finish().disabled; i++) tick(250);
  expect(finish().disabled).toBe(false);
  fireEvent.click(finish());
}
describe("guided mode visits", () => {
  it("starts on the first Zen visit and saves Skip for future visits", () => {
    const view = render(<ZenGame />);
    expect(
      screen.getByRole("dialog", { name: "How to play Zen" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Reset level (R)" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(localStorage.getItem(tutorialKeys.zen)).toBe("skipped");
    view.unmount();
    render(<ZenGame />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("completes all steps and supports replay without another first-visit tour", () => {
    vi.useFakeTimers();
    render(<ZenGame />);
    completeZenPractice();
    expect(localStorage.getItem(tutorialKeys.zen)).toBe("complete");
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    fireEvent.click(screen.getByRole("button", { name: "How to play" }));
    expect(screen.getByText("Your ship")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Paused" })).toBeTruthy();
  });
  it("onboards Gravity separately and excludes Creator playtests", () => {
    localStorage.setItem(tutorialKeys.zen, "complete");
    const view = render(<GravityGame onExit={() => {}} />);
    expect(
      screen.getByRole("dialog", { name: "How to play Gravity" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(localStorage.getItem(tutorialKeys.gravity)).toBe("skipped");
    view.unmount();
    localStorage.clear();
    render(
      <GravityGame
        onExit={() => {}}
        customLevel={toGravityLevel(newDraft())}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("walkthrough input and flight preservation", () => {
  it("freezes and preserves a Zen flight on replay, including capture-phase reset", async () => {
    const { OrbitEngine } = await import("../../src/game/engine");
    const launch = vi.spyOn(OrbitEngine.prototype, "launch");
    localStorage.setItem(tutorialKeys.zen, "complete");
    vi.useFakeTimers();
    try {
      const { container } = render(<ZenGame />);
      const canvas = screen.getByLabelText(
        "Slingshot flight field",
      ) as HTMLCanvasElement;
      canvas.setPointerCapture = () => {};
      canvas.hasPointerCapture = () => false;
      const pointer = (type: string, x: number) => {
        const event = new MouseEvent(type, {
          bubbles: true,
          button: 0,
          clientX: x,
          clientY: 300,
        });
        Object.defineProperties(event, {
          pointerId: { value: 1 },
          isPrimary: { value: true },
          pointerType: { value: "mouse" },
        });
        fireEvent(canvas, event);
      };
      pointer("pointerdown", 300);
      pointer("pointerup", 460);
      const engine = launch.mock.instances[0] as InstanceType<
        typeof OrbitEngine
      >;
      engine.update(0.05);
      const before = engine.getSnapshot();
      const update = vi.spyOn(engine, "update"),
        retry = vi.spyOn(engine, "retry"),
        bounds = vi.spyOn(engine, "setFlightBounds");
      fireEvent.click(screen.getByRole("button", { name: "Pause" }));
      fireEvent.click(screen.getByRole("button", { name: "How to play" }));
      const { act } = await import("@testing-library/react");
      act(() => vi.advanceTimersByTime(1500));
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "r" });
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "p" });
      pointer("pointerdown", 300);
      pointer("pointerup", 460);
      fireEvent.click(container.querySelector(".scene-actions button")!);
      expect(launch).toHaveBeenCalledTimes(1);
      expect(update).not.toHaveBeenCalled();
      expect(retry).not.toHaveBeenCalled();
      expect(bounds).not.toHaveBeenCalled();
      expect(engine.getSnapshot().particles).toEqual(before.particles);
      completeZenPractice();
      expect(engine.getSnapshot().status).toBe("flying");
      expect(engine.getSnapshot().particles).toEqual(before.particles);
      expect(document.activeElement).toBe(canvas);
    } finally {
      vi.useRealTimers();
    }
  });
  it("keeps practice keyboard-accessible, gates the final launch and saves Escape dismissal", () => {
    vi.useFakeTimers();
    render(<ZenGame />);
    expect(
      (screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(document.querySelector(".practice-pull-guide")).toBeNull();
    practiceKey(" ");
    tick(100);
    continuePractice();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    tick(300);
    expect(screen.getByText("Your ship")).toBeTruthy();
    const field = screen.getByLabelText("Zen practice field");
    field.focus();
    expect(document.activeElement).toBe(field);
    fireEvent.keyDown(field, { key: "Escape" });
    expect(localStorage.getItem(tutorialKeys.zen)).toBe("skipped");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("mode chooser tutorial entry", () => {
  it.each([
    ["zen", "Zen", "complete"],
    ["zen", "Zen", "skipped"],
    ["gravity", "Gravity", "complete"],
    ["gravity", "Gravity", "skipped"],
  ] as const)(
    "replays %s (%s, %s) from the start and clears the request on exit",
    (mode, label, result) => {
      window.history.replaceState({}, "", "/");
      localStorage.setItem(tutorialKeys[mode], result);
      render(<App />);
      const help = screen.getByRole("button", { name: `How to play ${label}` });
      expect(help.closest(".mode-choice")).toBeNull();
      fireEvent.click(help);
      expect(
        screen.getByRole("dialog", { name: `How to play ${label}` }),
      ).toBeTruthy();
      expect(
        document.querySelector(".walkthrough")?.getAttribute("data-step"),
      ).toBe("intro");
      expect(screen.getByText("Your ship")).toBeTruthy();
      // Opening help must not remove or rewrite the player's saved visit.
      expect(localStorage.getItem(tutorialKeys[mode])).toBe(result);
      fireEvent.click(screen.getByRole("button", { name: "Skip" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Pause" }));
      fireEvent.click(screen.getByRole("button", { name: "Choose mode" }));
      fireEvent.click(
        screen.getByRole("button", {
          name: new RegExp(`^${label}(?:Follow|Build)`),
        }),
      );
      expect(screen.queryByRole("dialog")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Pause" }));
      fireEvent.click(screen.getByRole("button", { name: "Choose mode" }));
      fireEvent.click(
        screen.getByRole("button", { name: `How to play ${label}` }),
      );
      expect(
        document.querySelector(".walkthrough")?.getAttribute("data-step"),
      ).toBe("intro");
      window.history.replaceState({}, "", "/");
    },
  );
  it.each(["Zen", "Gravity"])(
    "keeps the first visit tutorial on normal %s entry",
    (label) => {
      window.history.replaceState({}, "", "/");
      render(<App />);
      fireEvent.click(
        screen.getByRole("button", {
          name: new RegExp(`^${label}(?:Follow|Build)`),
        }),
      );
      expect(
        screen.getByRole("dialog", { name: `How to play ${label}` }),
      ).toBeTruthy();
      window.history.replaceState({}, "", "/");
    },
  );
});
