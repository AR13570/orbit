import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { TutorialStep } from "./steps";
import type { TutorialResult } from "./state";
import type { FocusArea } from "../render/coordinates";
import PracticeField, { type PracticeFrame } from "./PracticeField";
import { TutorialPractice } from "./practice";
export interface Highlight {
  x: number;
  y: number;
  width: number;
  height: number;
  shape?: "circle" | "rect";
}
export default function Walkthrough({
  mode,
  steps,
  clearFocus,
  onFinish,
}: {
  mode: "zen" | "gravity";
  steps: TutorialStep[];
  readTarget: (id: string, area: FocusArea) => Highlight | null;
  clearFocus: () => void;
  onFinish: (result: TutorialResult) => void;
}) {
  const [model] = useState(() => new TutorialPractice(mode));
  const [index, setIndex] = useState(0),
    [frame, setFrame] = useState<PracticeFrame | null>(null),
    [fading, setFading] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    completed = useRef(new Set<string>()),
    transition = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useRef(
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const step = steps[index],
    last = index === steps.length - 1;
  const ready =
    !model.interactive() ||
    completed.current.has(step.id) ||
    (frame?.stage === step.id && frame.ready);
  const updateFrame = useCallback((next: PracticeFrame) => {
    if (next.ready) completed.current.add(next.stage);
    setFrame(next);
  }, []);
  useEffect(() => {
    clearFocus();
    model.enterStage(steps[0].id);
    return () => {
      clearFocus();
      if (transition.current) clearTimeout(transition.current);
    };
  }, [clearFocus, model]);
  useEffect(() => {
    heading.current?.focus();
  }, [index]);
  useEffect(() => {
    const keepFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        heading.current?.focus();
    };
    document.addEventListener("focusin", keepFocus);
    return () => document.removeEventListener("focusin", keepFocus);
  }, []);
  const move = (next: number) => {
    if (fading || next < 0 || next >= steps.length) return;
    const apply = () => {
      model.enterStage(steps[next].id);
      setIndex(next);
      setFading(false);
    };
    if (reduced.current) apply();
    else {
      setFading(true);
      transition.current = setTimeout(apply, 100);
    }
  };
  const current = frame?.stage === step.id ? frame : null;
  const showGuides = !!current?.launchAllowed;
  const awaitingMode = step.id === "practice-split" && current?.mode !== 3;
  const title =
    step.id === "practice-split" && !awaitingMode
      ? "Split around the body"
      : step.title;
  const caption = model.interactive()
    ? current?.feedback || step.text
    : step.text;
  return (
    <div
      ref={root}
      className="walkthrough interactive-walkthrough cinematic-walkthrough"
      data-step={step.id}
      data-mode={mode}
      role="dialog"
      aria-modal="true"
      aria-label={mode === "zen" ? "How to play Zen" : "How to play Gravity"}
      aria-describedby="walkthrough-description"
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          onFinish("skipped");
        }
        if (event.key === "Tab") {
          const items = root.current!.querySelectorAll<HTMLElement>(
              "canvas[tabindex], button:not(:disabled)",
            ),
            first = items[0],
            final = items[items.length - 1];
          if (
            event.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === heading.current)
          ) {
            event.preventDefault();
            final.focus();
          } else if (!event.shiftKey && document.activeElement === final) {
            event.preventDefault();
            first.focus();
          }
        }
      }}
    >
      <PracticeField model={model} step={step.id} onFrame={updateFrame} />
      <svg
        className="walkthrough-spotlight"
        aria-hidden="true"
        width="100%"
        height="100%"
      >
        {current && showGuides && (
          <>
            <g className="practice-solution">
              {current.solution.map((path, i) => (
                <polyline
                  key={i}
                  className={`practice-solution-path${step.id === "practice-split" ? i === current.capturedBy ? " is-clear" : " is-blocked" : ""}`}
                  points={path.map((p) => `${p.x},${p.y}`).join(" ")}
                />
              ))}
              {current.tapPoint && (
                <g
                  className={`practice-tap-marker ${current.tapNow ? "is-ready" : ""}`}
                >
                  <circle
                    cx={current.tapPoint.x}
                    cy={current.tapPoint.y}
                    r="5"
                  />
                  <text x={current.tapPoint.x + 9} y={current.tapPoint.y - 9}>
                    {current.tapNow ? "Tap now" : "Split point"}
                  </text>
                </g>
              )}
            </g>
            <g className={`practice-pull-guide${current.guideSnapped ? " is-snapped" : ""}`}>
              <line
                x1={current.launcher.x}
                y1={current.launcher.y}
                x2={current.handle.x}
                y2={current.handle.y}
              />
              <circle cx={current.handle.x} cy={current.handle.y} r={current.guideSnapped ? 9 : 6} />
              {!current.flying && !current.dragging && (
                <circle
                  className="practice-pull-contact"
                  cx={current.launcher.x}
                  cy={current.launcher.y}
                  r="10"
                  style={
                    {
                      "--pull-x": `${current.handle.x - current.launcher.x}px`,
                      "--pull-y": `${current.handle.y - current.launcher.y}px`,
                    } as CSSProperties
                  }
                />
              )}
            </g>
          </>
        )}
        {current && awaitingMode && (
          <g
            className="practice-double-tap-hint"
            transform={`translate(${current.launcher.x} ${current.launcher.y})`}
          >
            <circle className="tap-contact" r="10" />
            <circle className="tap-ripple tap-one" r="13" />
            <circle className="tap-ripple tap-two" r="13" />
          </g>
        )}
        {current && step.id === "split" && (
          <g
            className="practice-branch-demo"
            transform={`translate(${current.launcher.x} ${current.launcher.y + current.launcherRadius + 26})`}
          >
            <path d="M-24 0H24 M0 0L24 -16 M0 0L24 16" />
            <circle r="3" cx="0" cy="0" />
            <circle className="branch-top" r="3" cx="0" cy="0" />
            <circle className="branch-bottom" r="3" cx="0" cy="0" />
          </g>
        )}
      </svg>
      <section className={`walkthrough-copy ${fading ? "is-changing" : ""}`}>
        <div
          className="walkthrough-progress"
          aria-label={`Step ${index + 1} of ${steps.length}`}
        >
          <span>
            {index + 1} / {steps.length}
          </span>
          <div aria-hidden="true">
            {steps.map((item, n) => (
              <i key={item.id} className={n <= index ? "is-reached" : ""} />
            ))}
          </div>
        </div>
        <h2 ref={heading} tabIndex={-1}>
          {title}
        </h2>
        <p
          id="walkthrough-description"
          className={`practice-caption ${model.interactive() && ready ? "is-success" : ""}`}
          role="status"
          aria-live="polite"
        >
          {caption}
        </p>
        <div className="walkthrough-actions">
          <button
            disabled={index === 0 || fading}
            onClick={() => move(index - 1)}
          >
            Back
          </button>
          <button onClick={() => onFinish("skipped")}>Skip</button>
          <button
            className="walkthrough-next"
            disabled={!ready || fading}
            onClick={() => (last ? onFinish("complete") : move(index + 1))}
          >
            {last ? "Start playing" : "Continue"}
          </button>
        </div>
      </section>
    </div>
  );
}
