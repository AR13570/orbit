import { useEffect, useRef, useState } from "react";
import { PullGesture } from "../controls";
import { bodyStrength } from "../game/physics";
import { gravityAim, gravityLaunchIsClear, gravityPullDistance } from "./input";
import { gravityLaunchSpeed } from "./physics";
import { GravityEngine } from "./engine";
import ProjectileSizeControl from "./ProjectileSizeControl";
import { createGravityRenderer } from "./renderer";
import type { GravityLevel, Vec2 } from "./types";
import "./gravity-guide.css";
export const GRAVITY_GUIDE_KEY = "orbit.walkthrough.gravity.v2";
let sessionSeen = false,
  unwritten = false;
export function gravityGuideSeen() {
  try {
    return (
      ["complete", "skipped"].includes(
        localStorage.getItem(GRAVITY_GUIDE_KEY) ?? "",
      ) || unwritten
    );
  } catch {
    return sessionSeen;
  }
}
export function finishGravityGuide(result: "complete" | "skipped") {
  sessionSeen = true;
  try {
    localStorage.setItem(GRAVITY_GUIDE_KEY, result);
    unwritten = false;
  } catch {
    unwritten = true; /* Play remains available without storage. */
  }
}
const practice: GravityLevel = {
  index: 0,
  seed: 2026,
  family: "none",
  bounds: { x: 0, y: 0, width: 900, height: 900 },
  launch: { x: 450, y: 650 },
  bodies: [
    {
      id: "pull",
      kind: "attractor",
      position: { x: 450, y: 420 },
      radius: 32,
      strength: bodyStrength(40),
    },
    {
      id: "push",
      kind: "repellent",
      position: { x: 710, y: 360 },
      radius: 20,
      strength: bodyStrength(20),
    },
  ],
  objective: { kind: "none", count: 1, turns: 1, hold: 0 },
  requirements: [{ bodyId: "pull", count: 1, turns: 1 }],
  physics: {
    planetGravity: true,
    planetCollisions: "soft",
    bodyCollisions: true,
  },
  witness: [],
};
const lessons = [
  [
    "Make your first planet",
    "Start in any clear space. Pull back to choose its speed and direction, then release.",
  ],
  [
    "Add another while it moves",
    "Try a different position and angle. Each new planet joins the same moving sky.",
  ],
  [
    "Let gravity draw",
    "Blue cores pull. Coral cores push. Rings and counts show each core’s goal. In Advanced, Particle Interaction controls mutual pull. Particle grouping is off by default; turn it on to let planets settle together on contact.",
  ],
  [
    "Choose a size",
    "Choose the size of your next planet. Bigger planets pull harder.",
  ],
  [
    "Keep a sky you love",
    "Skip a level from the bottom of the screen after confirming. Complete a goal to advance automatically after three seconds, or tap Next level to go sooner. Pinch to zoom; scroll on desktop.",
  ],
];
export default function GravityGuide({
  onFinish,
}: {
  onFinish: (result: "complete" | "skipped") => void;
}) {
  const [stage, setStage] = useState(0),
    [blockedLaunch, setBlockedLaunch] = useState(false),
    [projectileSize, setProjectileSize] = useState(1),
    [projectileScale, setProjectileScale] = useState(1),
    [engine] = useState(() => new GravityEngine(2026, practice));
  const cameraLocked = useRef(false),
    touches = useRef(new Set<number>()),
    touchRejected = useRef(false);
  const root = useRef<HTMLElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    renderer = useRef<ReturnType<typeof createGravityRenderer> | null>(null);
  const gesture = useRef(new PullGesture(160)),
    origin = useRef<Vec2 | null>(null),
    pull = useRef<Vec2 | null>(null),
    preview = useRef<Vec2[]>([]);
  const cancel = () => {
    const id = gesture.current.pointerId;
    gesture.current.cancel();
    origin.current = null;
    pull.current = null;
    preview.current = [];
    if (id !== null && canvas.current?.hasPointerCapture?.(id))
      canvas.current.releasePointerCapture(id);
  };
  useEffect(() => {
    if (!blockedLaunch) return;
    const timer = window.setTimeout(() => setBlockedLaunch(false), 2400);
    return () => window.clearTimeout(timer);
  }, [blockedLaunch]);
  useEffect(() => {
    const enterGuide = (event: KeyboardEvent) => {
      if (root.current?.contains(event.target as Node)) return;
      if (event.key === "Tab") {
        const targets = root.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),canvas[tabindex="0"],input:not(:disabled)',
        );
        if (!targets?.length) return;
        event.preventDefault();
        event.stopPropagation();
        targets[event.shiftKey ? targets.length - 1 : 0].focus();
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onFinish("skipped");
      }
    };
    document.addEventListener("keydown", enterGuide, true);
    return () => document.removeEventListener("keydown", enterGuide, true);
  }, [onFinish]);
  useEffect(() => {
    const r = createGravityRenderer(canvas.current!, { compact: true });
    renderer.current = r;
    const resize = () => {
      cancel();
      const rect = canvas.current!.getBoundingClientRect();
      r.resize(rect.width, rect.height, window.devicePixelRatio);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas.current!);
    resize();
    let frame = 0,
      last = 0,
      started = 0,
      lastScale = 1;
    const tick = (time: number) => {
      if (!started) started = time;
      if (!cameraLocked.current)
        r.setZoom(
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? 1
            : 0.94 + 0.08 * Math.min(1, (time - started) / 900),
        );
      if (last && !document.hidden)
        engine.update(Math.min(0.05, (time - last) / 1000));
      last = time;
      r.render(engine.getRenderSnapshot(), preview.current, time / 1000, {
        paused: document.hidden,
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
          .matches,
        pull: pull.current,
      });
      const scale = r.getScale();
      if (scale !== lastScale) {
        setProjectileScale(scale);
        lastScale = scale;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const interrupt = () => {
      cancel();
      touches.current.clear();
      touchRejected.current = false;
    };
    const finishPointer = (event: PointerEvent) => {
      // Bubble after the canvas release handler, which may launch a valid shot.
      if (gesture.current.pointerId === event.pointerId) cancel();
      touches.current.delete(event.pointerId);
      if (touches.current.size === 0) touchRejected.current = false;
    };
    window.addEventListener("orientationchange", interrupt);
    window.addEventListener("blur", interrupt);
    document.addEventListener("visibilitychange", interrupt);
    document.addEventListener("pointerup", finishPointer);
    document.addEventListener("pointercancel", finishPointer);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      r.destroy();
      window.removeEventListener("orientationchange", interrupt);
      window.removeEventListener("blur", interrupt);
      document.removeEventListener("visibilitychange", interrupt);
      document.removeEventListener("pointerup", finishPointer);
      document.removeEventListener("pointercancel", finishPointer);
      renderer.current = null;
    };
  }, [engine]);
  const launched = () => setStage((value) => (value < 2 ? value + 1 : value));
  const aim = (id: number, x: number, y: number) => {
    const rawShot = gesture.current.move(id, { x, y });
    if (!rawShot || !origin.current) return;
    const shot = gravityAim(rawShot);
    engine.setLaunch(origin.current, shot);
    pull.current = shot.pull;
    preview.current = gravityLaunchIsClear(
      origin.current,
      engine.getRenderSnapshot(),
    )
      ? engine.predictFrom(origin.current, {
          x: Math.cos(shot.angle) * gravityLaunchSpeed(shot.power),
          y: Math.sin(shot.angle) * gravityLaunchSpeed(shot.power),
        })
      : [];
  };
  return (
    <div className="gravity-guide-backdrop">
      <section
        ref={root}
        className="gravity-guide"
        role="dialog"
        aria-modal="true"
        aria-label="How to play Gravity"
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") {
            e.preventDefault();
            onFinish("skipped");
          }
          if (e.key === "Tab") {
            const targets = root.current!.querySelectorAll<HTMLElement>(
              'button:not(:disabled),canvas[tabindex="0"],input:not(:disabled)',
            );
            const first = targets[0],
              last = targets[targets.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <div className="gravity-guide-heading">
          <span>How to play Gravity</span>
        </div>
        <div key={stage} className="gravity-guide-copy" aria-live="polite">
          <span className="gravity-guide-step">
            {stage + 1} / {lessons.length}
          </span>
          <h1>{lessons[stage][0]}</h1>
          <p>{lessons[stage][1]}</p>
        </div>
        <div className="gravity-guide-actions">
          <button
            className="gravity-guide-skip"
            onClick={() => onFinish("skipped")}
          >
            Skip
          </button>
          {stage >= 2 && (
            <button
              className="pause-resume"
              onClick={() =>
                stage === lessons.length - 1
                  ? onFinish("complete")
                  : setStage(stage + 1)
              }
            >
              {stage === lessons.length - 1 ? "Start playing" : "Next"}
            </button>
          )}
        </div>
        <div className="gravity-guide-practice">
          <canvas
            ref={canvas}
            className="gravity-guide-field"
            tabIndex={0}
            aria-label="Gravity practice field"
            onPointerDown={(e) => {
              if (e.pointerType === "touch") {
                touches.current.add(e.pointerId);
                if (touches.current.size > 1) touchRejected.current = true;
              }
              if (
                e.button !== 0 ||
                !e.isPrimary ||
                gesture.current.active ||
                touchRejected.current
              ) {
                cancel();
                return;
              }
              cameraLocked.current = true;
              setBlockedLaunch(false);
              renderer.current?.setZoom(1);
              gesture.current = new PullGesture(
                gravityPullDistance(
                  e.pointerType,
                  window.innerWidth,
                  window.innerHeight,
                  1,
                ),
              );
              origin.current = renderer.current?.screenToWorld(
                e.clientX,
                e.clientY,
              ) ?? { x: 450, y: 650 };
              gesture.current.begin(e.pointerId, {
                x: e.clientX,
                y: e.clientY,
              });
              e.currentTarget.setPointerCapture?.(e.pointerId);
              e.preventDefault();
              aim(e.pointerId, e.clientX, e.clientY);
            }}
            onPointerMove={(e) => aim(e.pointerId, e.clientX, e.clientY)}
            onPointerUp={(e) => {
              touches.current.delete(e.pointerId);
              const rawShot = gesture.current.end(e.pointerId, {
                  x: e.clientX,
                  y: e.clientY,
                }),
                p = origin.current;
              if (rawShot && p && !document.hidden && !touchRejected.current) {
                if (gravityLaunchIsClear(p, engine.getRenderSnapshot())) {
                  engine.setLaunch(p, gravityAim(rawShot));
                  if (engine.launch()) launched();
                } else setBlockedLaunch(true);
              }
              cancel();
              if (touches.current.size === 0) touchRejected.current = false;
            }}
            onPointerCancel={(e) => {
              touches.current.delete(e.pointerId);
              cancel();
              if (touches.current.size === 0) touchRejected.current = false;
            }}
            onLostPointerCapture={cancel}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                engine.setLaunch(
                  { x: 450 + stage * 45, y: 650 },
                  { angle: 0, power: 0.2 },
                );
                if (engine.launch()) launched();
              }
            }}
          />
          {blockedLaunch && (
            <p className="gravity-launch-feedback" role="status">
              Start in clear space
            </p>
          )}
          {stage === 3 && (
            <ProjectileSizeControl
              value={projectileSize}
              baseRadius={
                engine.getRenderSnapshot().physics.planetRadius / projectileSize
              }
              scale={projectileScale}
              onInteract={cancel}
              onChange={(value) => {
                cancel();
                engine.setProjectileSize(value);
                setProjectileSize(value);
              }}
            />
          )}
        </div>
        <div className="gravity-guide-bottom">
          <p>
            {stage < 2
              ? "Drag in the practice field, or focus it and press Enter."
              : "Keep experimenting in this practice sky."}
          </p>
        </div>
      </section>
    </div>
  );
}
