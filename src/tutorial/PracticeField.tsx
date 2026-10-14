import { getTutorialCameraTarget, TutorialCameraRig } from "./camera";
import { createGravitySurface } from "../render/gravity-surface";
import { FORCE_PALETTE } from "../render/force-palette";
import { useEffect, useRef, useState } from "react";
import { PullGesture, TapSequence, pullDistance } from "../controls";
import {
  fitPlayableCamera,
  worldToClient,
  type Camera,
} from "../render/coordinates";
import { drawBody, drawGravitySurface } from "../render/renderer";
import type { Vec2 } from "../game/types";
import {
  TutorialPractice,
  PRACTICE_BODIES,
  PRACTICE_BOUNDS,
  PRACTICE_GOAL,
  PRACTICE_LAUNCH,
} from "./practice";
import type { Highlight } from "./Walkthrough";
import SplitIcon from "./SplitIcon";
export interface PracticeFrame {
  stage: string;
  time: number;
  highlights: Highlight[];
  launcher: Vec2;
  handle: Vec2;
  ready: boolean;
  feedback: string;
  mode: 1 | 3;
  solution: Vec2[][];
  capturedBy: number | null;
  tapPoint?: Vec2;
  tapNow: boolean;
  attentionScale: number;
  controlsReady: boolean;
  launchAllowed: boolean;
  flying: boolean;
  branched: boolean;
  dragging: boolean;
  guideSnapped: boolean;
  launcherRadius: number;
}
export function practiceView(
  width: number,
  height: number,
  model?: TutorialPractice,
) {
  const compact = width > height && height <= 600;
  const area = compact
    ? {
        left: 16,
        top: 48,
        width: Math.max(120, width * 0.5 - 32),
        height: Math.max(140, height - 72),
      }
    : {
        left: 16,
        top: 52,
        width: Math.max(120, width - 32),
        height: Math.max(140, height - 250),
      };
  return {
    area,
    camera: fitPlayableCamera(
      model?.bounds ?? PRACTICE_BOUNDS,
      model?.launcher ?? PRACTICE_LAUNCH,
      area.width,
      area.height,
      Math.min(90, area.height / 2 - 12),
      16,
    ),
  };
}
export default function PracticeField({
  model,
  step,
  onFrame,
}: {
  model: TutorialPractice;
  step: string;
  onFrame: (frame: PracticeFrame) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const gestureRange = useRef(160);
  const [hud, setHud] = useState<PracticeFrame | null>(null);
  const rig = useRef<TutorialCameraRig | null>(null),
    inputLocked = useRef(true),
    snapAfterResize = useRef(false);
  const view = useRef<{
    width: number;
    height: number;
    camera: Camera;
    area: ReturnType<typeof practiceView>["area"];
  }>({ width: 1, height: 1, ...practiceView(390, 844) });
  const gesture = useRef(new PullGesture(72)),
    taps = useRef(new TapSequence()),
    pull = useRef<Vec2 | null>(null),
    preview = useRef<Vec2[]>([]);
  const flightTap = useRef(false),
    flightId = useRef(0),
    stageRef = useRef(step),
    callback = useRef(onFrame);

  stageRef.current = step;
  callback.current = onFrame;
  const cancel = () => {
    const id = gesture.current.pointerId;
    gesture.current.cancel();
    taps.current.reset();
    pull.current = null;
    preview.current = [];
    flightTap.current = false;
    if (id !== null && canvas.current?.hasPointerCapture?.(id))
      canvas.current.releasePointerCapture(id);
  };
  useEffect(() => {
    cancel();
    inputLocked.current = true;
  }, [step]);
  useEffect(() => {
    const element = canvas.current!;
    const ctx = element.getContext("2d");
    let frame = 0,
      last = 0,
      dpr = 1,
      attentionStage = "",
      attentionStarted = 0,
      waveTime = 0;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const scratch = ctx ? createGravitySurface(ctx) : null;
    const resize = () => {
      cancel();
      snapAfterResize.current = rig.current !== null;
      inputLocked.current = true;
      const rect = element.getBoundingClientRect();
      const width = rect.width || window.innerWidth,
        height = rect.height || window.innerHeight;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      element.width = Math.round(width * dpr);
      element.height = Math.round(height * dpr);
      view.current = { width, height, ...practiceView(width, height, model) };
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    const hidden = () => {
      last = 0;
      cancel();
    };
    document.addEventListener("visibilitychange", hidden);
    const tick = (time: number) => {
      const dt = last ? Math.min(0.05, (time - last) / 1000) : 0;
      last = time;
      if (!document.hidden && !reduced) waveTime += dt;
      if (attentionStage !== stageRef.current) {
        attentionStage = stageRef.current;
        attentionStarted = time;
      }
      const attentionProgress = Math.min(
        1,
        Math.max(0, (time - attentionStarted) / 650),
      );
      const attentionScale =
        reduced || model.interactive()
          ? 1
          : 1 + 0.12 * Math.sin(Math.PI * attentionProgress) ** 2;
      const { width, height } = view.current;
      const { area, camera: overview } = practiceView(width, height, model);
      const target = getTutorialCameraTarget({
        overview,
        area,
        step: stageRef.current,
        mode: model.mode,
        launcher: model.launcher,
        bodies: model.bodies,
        checkpoint: model.checkpoint,
        shotMode: model.shotMode,
      });
      if (!rig.current) rig.current = new TutorialCameraRig(overview, 0.62);
      if (snapAfterResize.current) {
        rig.current.snap(target);
        snapAfterResize.current = false;
      } else rig.current.setTarget(target, reduced);
      const camera = rig.current.update(document.hidden ? 0 : dt);
      inputLocked.current = rig.current.transitioning;
      model.update(dt, document.hidden || inputLocked.current);
      const glyphScale = overview.scale;
      const flying = model.getParticles().some((p) => p.alive);

      const screen = (point: Vec2) =>
        worldToClient(
          point,
          {
            left: area.left,
            top: area.top,
            width: area.width,
            height: area.height,
          },
          camera,
        );
      const launcher = screen(model.launcher),
        suggestion = model.suggestedAim();
      const distance = pullDistance("mouse", width, height) * suggestion.power;
      const handle = {
        x: launcher.x - Math.cos(suggestion.angle) * distance,
        y: launcher.y - Math.sin(suggestion.angle) * distance,
      };
      const circle = (position: Vec2, radius: number): Highlight => {
        const p = screen(position);
        return {
          x: p.x - radius,
          y: p.y - radius,
          width: radius * 2,
          height: radius * 2,
          shape: "circle",
        };
      };
      const highlights =
        stageRef.current === "forces"
          ? model.bodies.map((b) =>
              circle(b.position, b.radius * camera.scale + 8),
            )
          : stageRef.current === "checkpoint"
            ? [
                circle(
                  model.checkpoint.position,
                  model.checkpoint.radius * camera.scale + 8,
                ),
              ]
            : stageRef.current === "orbit"
              ? [
                  circle(
                    model.bodies[0].position,
                    model.bodies[0].radius * camera.scale + 12,
                  ),
                ]
              : [
                  circle(
                    stageRef.current === "split" &&
                      model.getParticles().some((p) => p.alive)
                      ? model.getParticles().find((p) => p.alive)!.position
                      : model.launcher,
                    26,
                  ),
                ];
      const currentFrame: PracticeFrame = {
        stage: stageRef.current,
        time,
        highlights,
        launcher,
        handle,
        ready: model.ready(),
        feedback: model.feedback(),
        mode: model.shotMode,
        solution: model.solution().paths.map((path) => path.map(screen)),
        capturedBy: model.solution().capturedBy,
        tapPoint: model.solution().tapPoint
          ? screen(model.solution().tapPoint!)
          : undefined,
        tapNow: model.tapNow(),
        attentionScale,
        controlsReady: !inputLocked.current,
        launchAllowed: model.launchAllowed() && !inputLocked.current,
        flying,
        branched: model.splitOccurred(),
        dragging: gesture.current.active && model.launchAllowed(),
        guideSnapped: stageRef.current === "practice-split" && gesture.current.active && model.aim.angle === suggestion.angle && model.aim.power === suggestion.power,
        launcherRadius: (22 * camera.scale) / glyphScale,
      };
      callback.current(currentFrame);
      setHud(currentFrame);
      if (ctx && scratch) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#e9ecef";
        ctx.fillRect(0, 0, width, height);
        ctx.save();
        ctx.translate(area.left + area.width / 2, area.top + area.height / 2);
        ctx.scale(camera.scale, camera.scale);
        ctx.translate(-camera.center.x, -camera.center.y);
        const emphasize = (
          position: Vec2,
          active: boolean,
          draw: () => void,
        ) => {
          ctx.save();
          if (active) {
            ctx.translate(position.x, position.y);
            ctx.scale(attentionScale, attentionScale);
            ctx.translate(-position.x, -position.y);
          }
          draw();
          ctx.restore();
        };
        const bodyFocus = (index: number) =>
          stageRef.current === "forces" ||
          (stageRef.current === "orbit" && index === 0);
        for (const b of model.bodies)
          drawGravitySurface(
            ctx,
            b.position,
            b.radius,
            b.kind === "repellent",
            camera.scale,
            waveTime,
            reduced,
            FORCE_PALETTE[b.kind].wave,
            scratch,
          );
        model.bodies.forEach((b, index) =>
          emphasize(b.position, bodyFocus(index), () =>
            drawBody(
              ctx,
              b,
              camera.scale * (bodyFocus(index) ? attentionScale : 1),
            ),
          ),
        );
        if (model.mode === "zen") {
          const {
            position: { x, y },
            radius,
          } = model.checkpoint;
          const goalScale =
            stageRef.current === "checkpoint" ? attentionScale : 1;
          ctx.save();
          if (stageRef.current === "checkpoint") {
            ctx.translate(x, y);
            ctx.scale(attentionScale, attentionScale);
            ctx.translate(-x, -y);
          }
          ctx.fillStyle = "#e9ecef";
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#168dff";
          ctx.globalAlpha = 0.78;
          ctx.lineWidth = 1.6 / (camera.scale * goalScale);
          ctx.stroke();
          ctx.globalAlpha = 0.9;
          const flagHeight = Math.min(10 / glyphScale, radius * 0.52),
            poleX = x - flagHeight * 0.22,
            top = y - flagHeight * 0.5;
          ctx.lineWidth = 1.2 / (camera.scale * goalScale);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(poleX, top);
          ctx.lineTo(poleX, top + flagHeight);
          ctx.stroke();
          ctx.fillStyle = "#168dff";
          ctx.beginPath();
          ctx.moveTo(poleX, top);
          ctx.lineTo(poleX + flagHeight * 0.6, top + flagHeight * 0.22);
          ctx.lineTo(poleX, top + flagHeight * 0.48);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          const b = model.bodies[0];
          ctx.strokeStyle = "#527c9a";
          ctx.lineWidth = 2 / camera.scale;
          ctx.beginPath();
          ctx.arc(
            b.position.x,
            b.position.y,
            b.radius + 8 / camera.scale,
            -Math.PI / 2,
            -Math.PI / 2 + Math.max(0.01, model.orbitProgress()) * Math.PI * 2,
          );
          ctx.stroke();
        }
        const ship = (point: Vec2, angle: number, color: string) => {
          ctx.save();
          ctx.translate(point.x, point.y);
          ctx.rotate(angle);
          ctx.fillStyle = color;
          const r = 7 / glyphScale;
          ctx.beginPath();
          ctx.moveTo(r, 0);
          ctx.lineTo(-r * 0.7, r * 0.55);
          ctx.lineTo(-r * 0.35, 0);
          ctx.lineTo(-r * 0.7, -r * 0.55);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        };
        for (const p of model.getParticles()) {
          ctx.globalAlpha =
            model.mode === "zen" ? model.trailOpacity(p) : p.alive ? 0.5 : 0.12;
          ctx.strokeStyle = "#527c9a";
          ctx.lineWidth = 1.2 / camera.scale;
          ctx.beginPath();
          p.trail.forEach((point, i) =>
            i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y),
          );
          ctx.stroke();
          ctx.globalAlpha = 1;
          if (p.alive)
            ship(p.position, Math.atan2(p.velocity.y, p.velocity.x), "#303943");
        }
        const launcherScale = ["intro", "split", "multiple"].includes(
          stageRef.current,
        )
          ? 1 + (attentionScale - 1) * 1.5
          : 1;
        ctx.save();
        if (launcherScale !== 1) {
          ctx.translate(model.launcher.x, model.launcher.y);
          ctx.scale(launcherScale, launcherScale);
          ctx.translate(-model.launcher.x, -model.launcher.y);
        }
        ctx.globalAlpha = pull.current ? 1 : 0.72;
        ctx.strokeStyle = pull.current ? "rgba(48,57,67,.24)" : "#c3a446";
        ctx.lineWidth =
          (pull.current ? 1 : 1.2) / (camera.scale * launcherScale);
        ctx.setLineDash(
          pull.current ? [1 / camera.scale, 4 / camera.scale] : [],
        );
        ctx.beginPath();
        ctx.arc(
          model.launcher.x,
          model.launcher.y,
          22 / glyphScale,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ship(model.launcher, model.aim.angle, "#303943");
        ctx.restore();
        // Aim dots are deliberately last, above all decorative field relief.
        preview.current.forEach((point, i) => {
          ctx.globalAlpha = 1 - i / (preview.current.length + 1);
          ctx.fillStyle = "#8c66ca";
          ctx.beginPath();
          ctx.arc(point.x, point.y, 2.2 / camera.scale, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
        if (pull.current) {
          ctx.strokeStyle = "#626d78";
          ctx.lineWidth = 1 / camera.scale;
          ctx.beginPath();
          ctx.moveTo(model.launcher.x, model.launcher.y);
          ctx.lineTo(
            model.launcher.x + pull.current.x / camera.scale,
            model.launcher.y + pull.current.y / camera.scale,
          );
          ctx.stroke();
        }
        ctx.restore();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      scratch?.destroy();
      cancelAnimationFrame(frame);
      cancel();
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [model]);
  const aim = (id: number, x: number, y: number) => {
    const value = gesture.current.move(id, { x, y });
    if (
      !value ||
      flightTap.current ||
      !model.launchAllowed() ||
      inputLocked.current
    )
      return;
    const guided = model.guidedAim(value, gestureRange.current);
    model.setAim(guided.angle, guided.power);
    pull.current = {
      x: -Math.cos(guided.angle) * guided.power * gestureRange.current,
      y: -Math.sin(guided.angle) * guided.power * gestureRange.current,
    };
    preview.current = model.preview();
  };
  return (
    <>
      <canvas
        ref={canvas}
        className="practice-canvas"
        tabIndex={0}
        aria-label={`${model.mode === "zen" ? "Zen" : "Gravity"} practice field`}
        aria-describedby="practice-keyboard"
        aria-disabled={!model.interactive() || inputLocked.current}
        onPointerDown={(event) => {
          if (!event.isPrimary || gesture.current.active) {
            cancel();
            return;
          }
          if (
            !model.interactive() ||
            inputLocked.current ||
            event.button !== 0 ||
            document.hidden
          )
            return;
          event.currentTarget.focus();
          gestureRange.current = pullDistance(
              event.pointerType,
              view.current.width,
              view.current.height,
            );
          gesture.current = new PullGesture(gestureRange.current);
          gesture.current.begin(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          });
          flightTap.current =
            step === "practice-split" &&
            model.getParticles().some((p) => p.alive);
          flightId.current = model.launches;
          event.currentTarget.setPointerCapture(event.pointerId);
          event.preventDefault();
          if (!flightTap.current && model.launchAllowed()) {
            model.setAim(model.aim.angle, 0);
            preview.current = [];
          }
        }}
        onPointerMove={(event) =>
          aim(event.pointerId, event.clientX, event.clientY)
        }
        onPointerUp={(event) => {
          if (event.pointerId !== gesture.current.pointerId) return;
          gesture.current.move(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          });
          const tiny = gesture.current.tapEligible,
            inFlight = flightTap.current;
          const shot = gesture.current.end(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          });
          if (event.currentTarget.hasPointerCapture?.(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
          pull.current = null;
          preview.current = [];
          flightTap.current = false;
          if (!model.interactive() || inputLocked.current || document.hidden)
            return;
          if (inFlight) {
            if (tiny && flightId.current === model.launches) model.branch();
          } else if (shot && model.launchAllowed()) {
            taps.current.reset();
            const guided = model.guidedAim(shot, gestureRange.current);
            model.setAim(guided.angle, guided.power);
            model.launch();
          } else if (
            tiny &&
            step === "practice-split" &&
            taps.current.tap(
              { x: event.clientX, y: event.clientY },
              performance.now(),
            )
          ) {
            model.toggleMode();
            inputLocked.current = true;
          }
        }}
        onPointerCancel={cancel}
        onLostPointerCapture={(event) => {
          if (event.pointerId === gesture.current.pointerId) cancel();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" || event.key === "Tab") return;
          if (event.repeat || event.ctrlKey || event.metaKey || event.altKey)
            return;
          event.stopPropagation();
          if (!model.interactive()) return;
          if (document.hidden || inputLocked.current) return;
          if (step === "practice-split" && event.key.toLowerCase() === "m") {
            event.preventDefault();
            cancel();
            model.toggleMode();
            inputLocked.current = true;
          }
          if (step === "practice-split" && event.key.toLowerCase() === "s") {
            event.preventDefault();
            model.branch();
          }
          if (
            event.key === " " &&
            model.launchAllowed() &&
            !inputLocked.current
          ) {
            event.preventDefault();
            model.launch();
          }
          if (
            event.key.startsWith("Arrow") &&
            model.launchAllowed() &&
            !inputLocked.current
          ) {
            event.preventDefault();
            model.setAim(
              model.aim.angle +
                (event.key === "ArrowLeft"
                  ? -0.08
                  : event.key === "ArrowRight"
                    ? 0.08
                    : 0),
              model.aim.power +
                (event.key === "ArrowUp"
                  ? 0.04
                  : event.key === "ArrowDown"
                    ? -0.04
                    : 0),
            );
            preview.current = model.preview();
          }
        }}
      />
      {model.mode === "zen" && model.interactive() && hud?.stage === step && (
        <div
          className="practice-mode-indicator"
          data-mode={hud.mode}
          aria-live="polite"
          style={{
            left: hud.launcher.x,
            top: hud.launcher.y + hud.launcherRadius + 18,
          }}
        >
          <span className="practice-mode-ships" aria-hidden="true">
            <SplitIcon split={hud.mode === 3} />
          </span>
          <span>
            {hud.mode === 1
              ? "Single"
              : hud.branched
                ? "Three ships"
                : hud.flying
                  ? "Split flight"
                  : "Split ready"}
          </span>
        </div>
      )}
      <div className="practice-topbar">
        <span>Practice</span>
        {model.interactive() && (
          <div>
            <button
              onClick={() => {
                cancel();
                model.reset();
              }}
            >
              Reset practice
            </button>
          </div>
        )}
      </div>
      <p id="practice-keyboard" className="visually-hidden">
        In practice levels, arrow keys aim and Space launches. In the split
        level, M selects split mode and S splits a flying ship. Escape skips
        this guide.
      </p>
    </>
  );
}
