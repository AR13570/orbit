import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PracticeField, {
  type PracticeFrame,
} from "../../src/tutorial/PracticeField";
import { TutorialPractice } from "../../src/tutorial/practice";
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe("visible practice guide", () => {
  it.each([
    ["mouse", "launch"],
    ["touch", "launch"],
    ["mouse", "practice-split"],
    ["touch", "practice-split"],
  ] as const)(
    "following the %s guide for %s launches at its recommended power",
    (pointerType, stage) => {
      const original = { width: window.innerWidth, height: window.innerHeight };
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: pointerType === "touch" ? 600 : 1440,
      });
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: pointerType === "touch" ? 960 : 900,
      });
      vi.stubGlobal("matchMedia", (query: string) => ({
        matches: pointerType === "touch" && query === "(any-pointer: coarse)",
      }));
      try {
        const model = new TutorialPractice("odessey");
        model.enterStage(stage);
        if (stage === "practice-split") model.toggleMode();
        let frame: PracticeFrame | undefined;
        render(
          <PracticeField
            model={model}
            step={stage}
            onFrame={(value) => {
              frame = value;
            }}
          />,
        );
        act(() => vi.advanceTimersByTime(1000));
        expect(frame).toBeDefined();
        const field = screen.getByLabelText(
          "Odessey practice field",
        ) as HTMLCanvasElement;
        field.setPointerCapture = () => {};
        field.hasPointerCapture = () => false;
        const pointer = (type: string, point: { x: number; y: number }) => {
          const event = new MouseEvent(type, {
            bubbles: true,
            button: 0,
            clientX: point.x,
            clientY: point.y,
          });
          Object.defineProperties(event, {
            pointerId: { value: 1 },
            isPrimary: { value: true },
            pointerType: { value: pointerType },
            clientX: { value: point.x },
            clientY: { value: point.y },
          });
          fireEvent(field, event);
        };
        pointer("pointerdown", frame!.launcher);
        const release = stage === "practice-split"
          ? { x: frame!.handle.x + 8, y: frame!.handle.y + 6 }
          : frame!.handle;
        pointer("pointermove", release);
        if (stage === "practice-split") {
          act(() => vi.advanceTimersByTime(20));
          expect(frame!.guideSnapped).toBe(true);
        }
        pointer("pointerup", release);
        expect(model.launches).toBe(1);
        expect(model.aim.power).toBeCloseTo(model.suggestedAim().power, 10);
      } finally {
        Object.defineProperty(window, "innerWidth", {
          configurable: true,
          value: original.width,
        });
        Object.defineProperty(window, "innerHeight", {
          configurable: true,
          value: original.height,
        });
      }
    },
  );
});

it("P does not pause tutorial physics and hidden pages resume automatically", () => {
  const model = new TutorialPractice("odessey");
  model.enterStage("launch");
  render(<PracticeField model={model} step="launch" onFrame={() => {}} />);
  const field = screen.getByLabelText("Odessey practice field");
  expect(screen.queryByRole("button", { name: /pause|resume/i })).toBeNull();
  act(() => vi.advanceTimersByTime(1000));
  fireEvent.keyDown(field, { key: " " });
  fireEvent.keyDown(field, { key: "p" });
  act(() => vi.advanceTimersByTime(100));
  const before = structuredClone(model.getParticles());
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  fireEvent(document, new Event("visibilitychange"));
  act(() => vi.advanceTimersByTime(2000));
  expect(model.getParticles()).toEqual(before);
  hidden.mockReturnValue(false);
  fireEvent(document, new Event("visibilitychange"));
  act(() => vi.advanceTimersByTime(20000));
  expect(model.ready()).toBe(true);
  expect(screen.queryByRole("button", { name: /pause|resume/i })).toBeNull();
});

it.each([false, true])(
  "briefly emphasizes each introduction and respects reduced motion (%s)",
  (reducedMotion) => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: reducedMotion && query === "(prefers-reduced-motion: reduce)",
    }));
    const model = new TutorialPractice("odessey");
    const frames: PracticeFrame[] = [];
    const onFrame = (frame: PracticeFrame) => frames.push(frame);
    const view = render(
      <PracticeField model={model} step="intro" onFrame={onFrame} />,
    );
    act(() => vi.advanceTimersByTime(16));
    expect(frames[0].attentionScale).toBe(1);
    act(() => vi.advanceTimersByTime(300));
    expect(frames.at(-1)!.attentionScale).toBeGreaterThanOrEqual(1);
    if (!reducedMotion)
      expect(frames.at(-1)!.attentionScale).toBeGreaterThan(1.05);
    act(() => vi.advanceTimersByTime(600));
    expect(frames.at(-1)!.attentionScale).toBe(1);
    if (reducedMotion)
      expect(frames.every((frame) => frame.attentionScale === 1)).toBe(true);
    model.enterStage("forces");
    frames.length = 0;
    view.rerender(
      <PracticeField model={model} step="forces" onFrame={onFrame} />,
    );
    act(() => vi.advanceTimersByTime(16));
    expect(frames[0].attentionScale).toBe(1);
    act(() => vi.advanceTimersByTime(300));
    if (!reducedMotion)
      expect(frames.at(-1)!.attentionScale).toBeGreaterThan(1.05);
    act(() => vi.advanceTimersByTime(600));
    expect(frames.at(-1)!.attentionScale).toBe(1);
    if (reducedMotion)
      expect(frames.every((frame) => frame.attentionScale === 1)).toBe(true);
  },
);

it("blocks split launching until the player selects split mode", () => {
  const model = new TutorialPractice("odessey");
  model.enterStage("practice-split");
  render(
    <PracticeField model={model} step="practice-split" onFrame={() => {}} />,
  );
  const field = screen.getByLabelText("Odessey practice field");
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByText("Single")).toBeTruthy();
  const canvas = field as HTMLCanvasElement;
  canvas.setPointerCapture = () => {};
  canvas.hasPointerCapture = () => false;
  for (const [type, x] of [
    ["pointerdown", 150],
    ["pointermove", 190],
    ["pointerup", 190],
  ] as const) {
    const event = new MouseEvent(type, {
      bubbles: true,
      button: 0,
      clientX: x,
      clientY: 150,
    });
    Object.defineProperties(event, {
      pointerId: { value: 1 },
      pointerType: { value: "mouse" },
      isPrimary: { value: true },
    });
    fireEvent(field, event);
  }
  fireEvent.keyDown(field, { key: " " });
  expect(model.getParticles()).toHaveLength(0);
  expect(model.launches).toBe(0);
  fireEvent.keyDown(field, { key: "m" });
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByText("Split ready")).toBeTruthy();
  fireEvent.keyDown(field, { key: " " });
  expect(model.getParticles().filter((p) => p.alive)).toHaveLength(1);
  expect(screen.queryByText("Single")).toBeNull();
});
