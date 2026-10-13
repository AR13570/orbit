import { useCallback, useEffect, useRef, useState } from "react";
import { PullGesture, runSeed } from "../controls";
import Icon from "../components/Icon";
import { OrbitSound } from "../sound";
import { GravityEngine } from "./engine";
import { createGravityRenderer } from "./renderer";
import { MAX_PROJECTILES, objectiveText } from "./simulation";
import GravityMenu from "./GravityMenu";
import type { Vec2 } from "../game/types";
import type { GravityLevel } from "./types";
export default function GravityGame({
  onExit,
  customLevel,
  customName,
}: {
  onExit: () => void;
  customLevel?: GravityLevel;
  customName?: string;
}) {
  const [engine] = useState(
    () => new GravityEngine(runSeed(window.location.search), customLevel),
  );
  const [snapshot, setSnapshot] = useState(() => engine.getSnapshot()),
    [paused, setPaused] = useState(false),
    [help, setHelp] = useState(false),
    [muted, setMuted] = useState(true),
    [feedback, setFeedback] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null),
    scene = useRef<HTMLElement>(null),
    renderer = useRef<ReturnType<typeof createGravityRenderer> | null>(null);
  const gesture = useRef(new PullGesture(160)),
    pull = useRef<Vec2 | null>(null),
    preview = useRef<Vec2[]>([]),
    pause = useRef(false),
    mute = useRef(true),
    sound = useRef(new OrbitSound()),
    celebration = useRef(0),
    lastComplete = useRef(false);
  const frameSize = useRef({ width: 0, height: 0, dpr: 1 });
  mute.current = muted;
  const refresh = useCallback(
    () => setSnapshot(engine.getSnapshot()),
    [engine],
  );
  const cancel = useCallback(() => {
    const id = gesture.current.pointerId;
    gesture.current.cancel();
    pull.current = null;
    preview.current = [];
    if (id !== null && canvas.current?.hasPointerCapture?.(id))
      canvas.current.releasePointerCapture(id);
  }, []);
  const openPause = useCallback(() => {
    cancel();
    pause.current = true;
    setPaused(true);
  }, [cancel]);
  const resume = () => {
    pause.current = false;
    setPaused(false);
    setHelp(false);
    canvas.current?.focus();
  };
  const retry = useCallback(() => {
    cancel();
    engine.retry();
    celebration.current = 0;
    setFeedback("");
    refresh();
  }, [cancel, engine, refresh]);
  useEffect(() => {
    const r = createGravityRenderer(canvas.current!);
    renderer.current = r;
    const resize = () => {
      cancel();
      const rect = scene.current!.getBoundingClientRect();
      r.resize(rect.width, rect.height, window.devicePixelRatio);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(scene.current!);
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    let frame = 0,
      last: number | null = null,
      lastHud = 0;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const tick = (time: number) => {
      const dt =
        last === null ? 0 : Math.min(0.05, Math.max(0, (time - last) / 1000));
      last = time;
      const active = !pause.current && !document.hidden;
      if (active) engine.update(dt);
      let state = engine.getSnapshot();
      if (state.complete && !lastComplete.current) {
        cancel();
        if (!mute.current) sound.current.play("dock");
        celebration.current = 0;
      }
      lastComplete.current = state.complete;
      if (state.complete && active && !customLevel) {
        celebration.current += dt;
        if (celebration.current >= 1.4) {
          cancel();
          engine.advance();
          state = engine.getSnapshot();
          celebration.current = 0;
          lastComplete.current = false;
        }
      }
      r.render(state, preview.current, time / 1000, {
        paused: !active,
        reducedMotion: reduced,
        pull: pull.current,
      });
      if (time - lastHud >= 80) {
        setSnapshot(state);
        lastHud = time;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hidden = () => {
      last = null;
      if (document.hidden) openPause();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      cancelAnimationFrame(frame);
      cancel();
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      document.removeEventListener("visibilitychange", hidden);
      r.destroy();
      renderer.current = null;
    };
  }, [engine, cancel, openPause, customLevel]);
  useEffect(() => () => sound.current.destroy(), []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.repeat ||
        e.isComposing ||
        e.defaultPrevented ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        (e.target instanceof Element &&
          e.target.closest(
            'input,textarea,select,[contenteditable]:not([contenteditable="false"])',
          ))
      )
        return;
      if (e.key.toLowerCase() === "r" && !help) {
        e.preventDefault();
        retry();
      } else if (
        (e.key === "Escape" || e.key.toLowerCase() === "p") &&
        !pause.current
      ) {
        e.preventDefault();
        openPause();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [help, retry, openPause]);
  const updatePull = (id: number, x: number, y: number) => {
    const aim = gesture.current.move(id, { x, y });
    if (!aim) return;
    engine.setAim(aim.angle, aim.power);
    pull.current = aim.pull;
    preview.current = engine.predict();
  };
  const alive = snapshot.particles.filter((p) => p.alive).length;
  return (
    <main ref={scene} className="orbit-scene gravity-scene">
      <canvas
        ref={canvas}
        className="scene-canvas"
        tabIndex={0}
        aria-label="Gravity orbital field"
        onPointerDown={(e) => {
          if (!e.isPrimary || gesture.current.active) {
            cancel();
            return;
          }
          if (e.button !== 0 || pause.current || engine.getSnapshot().complete)
            return;
          gesture.current = new PullGesture(
            e.pointerType === "touch" || window.innerWidth <= 760 ? 120 : 160,
          );
          gesture.current.begin(e.pointerId, { x: e.clientX, y: e.clientY });
          const rect = e.currentTarget.getBoundingClientRect();
          frameSize.current = {
            width: rect.width,
            height: rect.height,
            dpr: window.devicePixelRatio,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
          e.preventDefault();
          updatePull(e.pointerId, e.clientX, e.clientY);
        }}
        onPointerMove={(e) => updatePull(e.pointerId, e.clientX, e.clientY)}
        onPointerUp={(e) => {
          if (e.pointerId !== gesture.current.pointerId) return;
          const rect = e.currentTarget.getBoundingClientRect();
          if (
            Math.abs(rect.width - frameSize.current.width) > 0.5 ||
            Math.abs(rect.height - frameSize.current.height) > 0.5 ||
            window.devicePixelRatio !== frameSize.current.dpr
          ) {
            cancel();
            return;
          }
          const shot = gesture.current.end(e.pointerId, {
            x: e.clientX,
            y: e.clientY,
          });
          pull.current = null;
          preview.current = [];
          if (e.currentTarget.hasPointerCapture?.(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
          if (shot && !pause.current) {
            engine.setAim(shot.angle, shot.power);
            if (engine.launch()) {
              setFeedback("");
              if (!mute.current) sound.current.play("launch");
            } else
              setFeedback("The sky is full. Reset to clear your projectiles.");
            refresh();
          }
        }}
        onPointerCancel={cancel}
        onLostPointerCapture={(e) => {
          if (gesture.current.pointerId === e.pointerId) cancel();
        }}
      />
      <div className="scene-hud">
        <span>
          {customLevel ? customName || "Custom level" : "Gravity"}{" "}
          <span className="gravity-level">
            {customLevel ? "Playtest" : `Level ${snapshot.level.index + 1}`}
          </span>
        </span>
      </div>
      <div className="scene-actions">
        <button
          className="pause-button"
          aria-label="Reset level (R)"
          title="Reset level (R)"
          disabled={snapshot.complete && !customLevel}
          onClick={retry}
        >
          <Icon name="reset" />
        </button>
        <button className="pause-button" aria-label="Pause" onClick={openPause}>
          <Icon name="pause" />
        </button>
      </div>
      <div className="gravity-objective">
        <p>{objectiveText(snapshot.level)}</p>
        {snapshot.level.objective.kind !== "none" && (
          <span>
            {snapshot.progress.current} / {snapshot.progress.target}{" "}
            {snapshot.level.objective.kind === "paired" ? "bodies" : "orbits"}
            {snapshot.progress.hold > 0 &&
            snapshot.progress.current === snapshot.progress.target
              ? ` · ${Math.max(0, snapshot.progress.hold - snapshot.progress.held).toFixed(1)}s`
              : ""}
          </span>
        )}
      </div>
      <div className="gravity-footer">
        <p className="gravity-feedback" role="status">
          {snapshot.complete
            ? "Orbits aligned"
            : feedback || `${alive} / ${MAX_PROJECTILES} projectiles in flight`}
        </p>
        <p className="gravity-instruction">
          Pull back. Release. Launch again while they orbit.
        </p>
        {customLevel ? (
          <button
            className="gravity-skip"
            onClick={() => {
              cancel();
              onExit();
            }}
          >
            Back to editor
          </button>
        ) : (
          <button
            className="gravity-skip"
            disabled={snapshot.complete}
            onClick={() => {
              cancel();
              engine.skip();
              celebration.current = 0;
              setFeedback("");
              refresh();
            }}
          >
            Skip level <span aria-hidden="true">↗</span>
          </button>
        )}
      </div>
      {paused &&
        (help ? (
          <GravityMenu
            title="How to play Gravity"
            onClose={() => setHelp(false)}
          >
            <p>
              Pull anywhere on the field and release to launch from the dotted
              ring. A longer pull gives more speed. You can keep launching while
              earlier projectiles fly.
            </p>
            <p>
              Try a sideways launch past a body to fall around it. Complete a
              full revolution to establish an orbit. The ring around the body
              shows your progress.
            </p>
            <p>
              Follow the objective above the field. Only living orbits count,
              and some puzzles need several orbits at once. Repellent bodies
              push projectiles away.
            </p>
            <button className="button-primary" onClick={() => setHelp(false)}>
              Back to pause
            </button>
          </GravityMenu>
        ) : (
          <GravityMenu title="Paused" onClose={resume}>
            <button className="pause-resume" onClick={resume}>
              Resume <Icon name="play" />
            </button>
            <button
              className="pause-option"
              aria-pressed={!muted}
              onClick={() => {
                if (muted) sound.current.unlock();
                setMuted((m) => !m);
              }}
            >
              <Icon name={muted ? "muted" : "sound"} />
              <span>{muted ? "Sound off" : "Sound on"}</span>
            </button>
            <button className="pause-option" onClick={() => setHelp(true)}>
              <Icon name="help" />
              <span>How to play</span>
            </button>
            <button
              className="pause-option"
              onClick={() => {
                retry();
                resume();
              }}
              disabled={snapshot.complete && !customLevel}
            >
              <Icon name="reset" />
              <span>Reset level</span>
            </button>
            <button
              className="pause-option pause-new-seed"
              onClick={() => {
                cancel();
                onExit();
              }}
            >
              {customLevel ? "Back to editor" : "Choose mode"}
            </button>
          </GravityMenu>
        ))}
    </main>
  );
}
