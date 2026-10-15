import { useGameplayZoom } from "./useGameplayZoom";
import { usePathAssist } from "./pathAssist";
import { MAX_FLIGHT_SECONDS } from "./game/physics";
import ModeChooser, { type OrbitMode } from "./ModeChooser";
import GravityGame from "./gravity/GravityGame";
import GravityCreator from "./gravity/creator/GravityCreator";
import { useCallback, useEffect, useRef, useState } from "react";
import { OrbitEngine } from "./game/engine";
import { zenDebugStart } from "./game/debug";
import { loadZenCheckpoint, resolveZenSeed, saveZenCheckpoint, rememberZenSeed } from "./game/progress";
import { createRenderer } from "./render/renderer";
import type { SlingshotVisual } from "./render/renderer";
import { PullGesture, TapSequence, runSeed, pullDistance } from "./controls";
import { FeedbackClock } from "./transitions";
import { OrbitSound } from "./sound";
import { AccelerationSoundTracker } from "./audio/acceleration";
import Walkthrough from "./tutorial/Walkthrough";
import {
  tutorialSeen,
  finishTutorial,
  type TutorialResult,
} from "./tutorial/state";
import { tutorialSteps } from "./tutorial/steps";
import { worldHighlight, elementHighlight } from "./tutorial/targets";
import type { FocusArea } from "./render/coordinates";
import PauseMenu from "./components/PauseMenu";
import Icon from "./components/Icon";
import GameHeader from "./components/GameHeader";
import type { GameSnapshot, Vec2 } from "./game/types";
export function ZenGame({
  onExit,
  startTutorial = false,
}: { onExit?: () => void; startTutorial?: boolean } = {}) {
  const [debug] = useState(() => zenDebugStart(window.location.search));
  const [engine] = useState(() => {
    if (debug.enabled) return new OrbitEngine(runSeed(window.location.search), debug.level);
    const seed = resolveZenSeed(window.location.search);
    const game = new OrbitEngine(seed);
    const saved = loadZenCheckpoint(seed);
    if (saved) game.restoreCheckpoint(saved);
    return game;
  });
  const [snapshot, setSnapshot] = useState(() => engine.getSnapshot());
  const [paused, setPaused] = useState(false),
    [help, setHelp] = useState(
      () => startTutorial || (!debug.enabled && !tutorialSeen("zen")),
    ),
    [muted, setMuted] = useState(true),
    [hint, setHint] = useState(true);
  const [modeFeedback, setModeFeedback] = useState("");
  const pathAssist = usePathAssist(),
    pathAssistRef = useRef(pathAssist);
  pathAssistRef.current = pathAssist;
  const previewDirty = useRef(false),
    lastPreview = useRef(-Infinity);
  const canvas = useRef<HTMLCanvasElement>(null),
    scene = useRef<HTMLElement>(null),
    renderer = useRef<ReturnType<typeof createRenderer> | null>(null);
  const returnToPause = useRef(false),
    tutorialInterrupted = useRef(false);
  const taps = useRef(new TapSequence());
  const tapInterrupted = useRef(false);
  const flightTap = useRef(new PullGesture(160));
  const tappedFlight = useRef<number | null>(null);
  const gesture = useRef(new PullGesture(160)),
    sling = useRef<SlingshotVisual | null>(null),
    preview = useRef<Vec2[][]>([]),
    gestureScale = useRef(1),
    gestureFrame = useRef({ width: 0, height: 0, dpr: 1 });
  const pauseRef = useRef(false),
    helpRef = useRef(false),
    muteRef = useRef(true),
    sound = useRef(new OrbitSound()),
    accelerationSound = useRef(new AccelerationSoundTracker()),
    lastEvent = useRef(0),
    clock = useRef(new FeedbackClock());
  pauseRef.current = paused;
  helpRef.current = help;
  muteRef.current = muted;
  const savedCheckpoint = useRef("");
  const persistCheckpoint = useCallback((s: GameSnapshot) => {
    if (debug.enabled || helpRef.current) return;
    const key = `${s.sector.seed}:${s.sector.index}:${s.checkpointCount}`;
    if (savedCheckpoint.current === key) return;
    saveZenCheckpoint(engine.getCheckpoint());
    savedCheckpoint.current = key;
  }, [debug.enabled, engine]);
  useEffect(() => { persistCheckpoint(engine.getSnapshot()); }, [engine, persistCheckpoint]);
  const refresh = useCallback(() => {
    const s = engine.getSnapshot();
    persistCheckpoint(s);
    const r = renderer.current;
    if (r) {
      r.prepareFrame(s, performance.now() / 1000, {
        paused: pauseRef.current || helpRef.current,
        cameraLocked: gesture.current.active,
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
          .matches,
      });
      if (!helpRef.current) engine.setFlightBounds(r.getVisibleBounds());
    }
    setSnapshot(s);
  }, [engine, persistCheckpoint]);
  const cancel = useCallback(() => {
    taps.current.reset();
    const id = gesture.current.pointerId ?? flightTap.current.pointerId;
    gesture.current.cancel();
    flightTap.current.cancel();
    tappedFlight.current = null;
    sling.current = null;
    preview.current = [];
    previewDirty.current = false;
    lastPreview.current = -Infinity;
    if (id !== null && canvas.current?.hasPointerCapture?.(id))
      canvas.current.releasePointerCapture(id);
  }, []);
  useEffect(() => {
    cancel();
  }, [pathAssist, cancel]);
  const zoom = useGameplayZoom({
    canvas,
    blocked: () => helpRef.current || pauseRef.current || document.hidden,
    cancel,
    apply: (value) => {
      renderer.current?.setZoom?.(value);
      if (renderer.current && !helpRef.current)
        engine.setFlightBounds(renderer.current.getVisibleBounds());
    },
  });
  const openPause = useCallback(() => {
    sound.current.setEnabled(false);
    accelerationSound.current.reset();
    cancel();
    pauseRef.current = true;
    setPaused(true);
  }, [cancel]);
  const resume = () => {
    pauseRef.current = false;
    setPaused(false);
    canvas.current?.focus();
  };
  const restart = () => {
    cancel();
    if (debug.enabled) engine.restart(undefined, debug.level);
    else {
      const previousSeed = engine.getSnapshot().sector.seed;
      let seed = crypto.getRandomValues(new Uint32Array(1))[0];
      if (seed === previousSeed) seed = (seed + 1) >>> 0;
      if (runSeed(window.location.search) === undefined) rememberZenSeed(seed);
      else {
        const url = new URL(window.location.href);
        url.searchParams.set("seed", String(seed));
        window.history.replaceState(window.history.state, "", url);
      }
      engine.restart(seed);
    }
    clock.current.reset();
    setHelp(false);
    helpRef.current = false;
    resume();
    refresh();
  };
  const resetLevel = useCallback(() => {
    // A completed checkpoint must finish its existing once-only advance.
    if (helpRef.current || engine.getSnapshot().status === "docked") return;
    cancel();
    engine.retry();
    clock.current.reset();
    pauseRef.current = false;
    setPaused(false);
    canvas.current?.focus();
    refresh();
  }, [engine, cancel, refresh]);
  useEffect(() => {
    const resetKey = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() !== "r" ||
        e.repeat ||
        e.isComposing ||
        e.defaultPrevented ||
        helpRef.current ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        (e.target instanceof Element &&
          e.target.closest(
            'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
          ))
      )
        return;
      e.preventDefault();
      resetLevel();
    };
    // Capture R before the pause dialog's focus/keyboard boundary.
    window.addEventListener("keydown", resetKey, true);
    return () => window.removeEventListener("keydown", resetKey, true);
  }, [resetLevel]);
  useEffect(() => {
    if (!canvas.current || !scene.current) return;
    const r = createRenderer(canvas.current);
    renderer.current = r;
    const resize = () => {
      cancel();
      const rect = scene.current!.getBoundingClientRect();
      r.resize(rect.width, rect.height, window.devicePixelRatio);
      r.prepareFrame(engine.getSnapshot(), performance.now() / 1000, {
        paused: true,
        cameraLocked: true,
      });
      if (!helpRef.current) engine.setFlightBounds(r.getVisibleBounds());
    };
    const observer = new ResizeObserver(resize);
    observer.observe(scene.current);
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    let frame = 0,
      last = 0,
      lastHud = 0,
      hintTime = 0,
      hintEnded = false;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const tick = (time: number) => {
      const dt = last ? Math.min((time - last) / 1000, 0.05) : 0;
      last = time;
      const active = !pauseRef.current && !helpRef.current && !document.hidden;
      let s = engine.getSnapshot();
      const renderOptions = {
        reducedMotion: reduced,
        paused: !active,
        cameraLocked: gesture.current.active,
        slingshot: sling.current,
        pathAssist: pathAssistRef.current,
      };
      r.prepareFrame(s, time / 1000, renderOptions);
      if (!helpRef.current) engine.setFlightBounds(r.getVisibleBounds());
      if (active) {
        engine.update(dt);
        s = engine.getSnapshot();
        hintTime += dt;
        if (hintTime > 5 && !hintEnded) {
          hintEnded = true;
          setHint(false);
        }
        // Dock increments the count before its animation ends. Save that boundary now.
        persistCheckpoint(s);
        const next = clock.current.step(s.status, dt, true);
        if (next) {
          cancel();
          if (next === "advance") engine.advance();
          else engine.retry();
          s = engine.getSnapshot();
          persistCheckpoint(s);
        }
      } else clock.current.step(s.status, dt, false);
      const audioActive = active && !muteRef.current;
      sound.current.setEnabled(audioActive);
      if (s.event && s.event.id !== lastEvent.current) {
        lastEvent.current = s.event.id;
        if (s.event.kind === "launch" || s.event.kind === "restart")
          accelerationSound.current.reset();
        if (audioActive) sound.current.play(s.event.kind);
      }
      if (audioActive && s.status === "flying") {
        const cue = accelerationSound.current.sample(s.particles, s.elapsed);
        if (cue) sound.current.accelerate(cue.intensity);
      } else accelerationSound.current.reset();
      if (
        active &&
        gesture.current.active &&
        pathAssistRef.current === "full" &&
        previewDirty.current &&
        time - lastPreview.current >= 80
      ) {
        preview.current = engine.predict(MAX_FLIGHT_SECONDS);
        previewDirty.current = false;
        lastPreview.current = time;
      }
      if (!helpRef.current)
        r.render(
          s,
          gesture.current.active ? preview.current : [],
          time / 1000,
          renderOptions,
        );
      if (!helpRef.current) engine.setFlightBounds(r.getVisibleBounds());
      if (time - lastHud > 80) {
        setSnapshot(s);
        lastHud = time;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hidden = () => {
      last = 0;
      if (document.hidden) {
        if (helpRef.current) tutorialInterrupted.current = true;
        openPause();
      }
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
  }, [engine, cancel, openPause, persistCheckpoint]);
  useEffect(() => {
    if (muted || paused || help) {
      sound.current.setEnabled(false);
      accelerationSound.current.reset();
    }
  }, [muted, paused, help]);
  useEffect(() => () => sound.current.destroy(), []);
  useEffect(() => {
    if (!modeFeedback) return;
    const timer = window.setTimeout(() => setModeFeedback(""), 1500);
    return () => window.clearTimeout(timer);
  }, [modeFeedback]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        helpRef.current ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement)?.tagName,
        )
      )
        return;
      if (e.key === "Escape" || e.key.toLowerCase() === "p") {
        e.preventDefault();
        if (pauseRef.current) {
          pauseRef.current = false;
          setPaused(false);
        } else openPause();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [openPause]);
  const updatePull = (id: number, x: number, y: number) => {
    const aim = gesture.current.move(id, { x, y });
    if (!aim) return;
    if (!gesture.current.tapEligible) taps.current.reset();
    const current = engine.getSnapshot(),
      launch = current.sector.launch;
    const changed =
      current.aim.angle !== aim.angle || current.aim.power !== aim.power;
    engine.setAim(aim.angle, aim.power);
    sling.current = {
      anchor: launch,
      pull: {
        x: launch.x + aim.pull.x / gestureScale.current,
        y: launch.y + aim.pull.y / gestureScale.current,
      },
      power: aim.power,
    };
    if (renderer.current)
      engine.setFlightBounds(renderer.current.getVisibleBounds());
    if (pathAssistRef.current === "full") {
      if (changed) preview.current = [];
      previewDirty.current = true;
    } else preview.current = engine.predict(1.6);
  };
  const restoreTutorialFocus = useRef(false);
  useEffect(() => {
    if (!help && restoreTutorialFocus.current) {
      restoreTutorialFocus.current = false;
      const target = paused
        ? scene.current?.querySelector<HTMLButtonElement>(".pause-resume")
        : canvas.current;
      target?.focus();
    }
  }, [help, paused]);
  const clearTutorialFocus = useCallback(
    () => renderer.current?.setWalkthroughFocus?.(null),
    [],
  );
  const readTutorialTarget = useCallback(
    (id: string, area: FocusArea) => {
      const r = renderer.current;
      if (!r) return null;
      if (id === "controls") {
        r.setWalkthroughFocus?.(null);
        return elementHighlight(scene.current?.querySelector(".scene-actions"));
      }
      const sector = engine.getSnapshot().sector;
      const body = sector.bodies.find((item) => item.kind === id);
      const target =
        id === "launcher"
          ? { position: sector.launch, radius: 0 }
          : id === "goal"
            ? sector.checkpoint
            : body;
      return target
        ? worldHighlight(
            r,
            target.position,
            target.radius,
            area,
            () => r.getViewport().scale,
            id === "launcher" ? 26 : undefined,
          )
        : null;
    },
    [engine],
  );
  const closeTutorial = (result: TutorialResult) => {
    restoreTutorialFocus.current = true;
    finishTutorial("zen", result);
    clearTutorialFocus();
    helpRef.current = false;
    setHelp(false);
    if (
      (result === "skipped" && returnToPause.current) ||
      tutorialInterrupted.current ||
      document.hidden
    )
      openPause();
    else resume();
    returnToPause.current = false;
    tutorialInterrupted.current = false;
  };
  const livePieces = snapshot.particles.filter((particle) => particle.alive);
  const offscreenRemaining =
    snapshot.status === "flying" &&
    livePieces.length > 0 &&
    livePieces.every((particle) => particle.offscreenRemaining !== undefined)
      ? Math.max(...livePieces.map((particle) => particle.offscreenRemaining!))
      : null;
  const announcement = paused
    ? "Paused"
    : snapshot.status === "aiming"
      ? "Ready to pull"
      : snapshot.status === "flying"
        ? offscreenRemaining !== null
          ? "Offscreen. Six seconds to return."
          : "In flight"
        : snapshot.status === "docked"
          ? "Docked"
          : "Preparing another shot.";
  return (
    <main ref={scene} className="orbit-scene">
      <div
        className="game-surface"
        inert={help}
        aria-hidden={help || undefined}
      >
        <canvas
          ref={canvas}
          className="scene-canvas"
          aria-label="Slingshot flight field"
          tabIndex={0}
          onPointerDown={(e) => {
            if (zoom.down(e)) return;
            if (
              !e.isPrimary ||
              gesture.current.active ||
              flightTap.current.active
            ) {
              taps.current.reset();
              tapInterrupted.current = true;
            }
            const current = engine.getSnapshot();
            if (current.status === "flying") {
              if (
                !e.isPrimary ||
                e.button !== 0 ||
                pauseRef.current ||
                helpRef.current ||
                !current.canBranch ||
                flightTap.current.active
              )
                return;
              taps.current.reset();
              tapInterrupted.current = false;
              flightTap.current.begin(e.pointerId, {
                x: e.clientX,
                y: e.clientY,
              });
              tappedFlight.current = current.event?.id ?? null;
              const frame = e.currentTarget.getBoundingClientRect();
              gestureFrame.current = {
                width: frame.width,
                height: frame.height,
                dpr: window.devicePixelRatio,
              };
              e.currentTarget.setPointerCapture(e.pointerId);
              e.preventDefault();
              return;
            }
            if (
              !e.isPrimary ||
              e.button !== 0 ||
              pauseRef.current ||
              helpRef.current ||
              engine.getSnapshot().status !== "aiming" ||
              renderer.current?.getViewport().transitioning ||
              gesture.current.active ||
              flightTap.current.active
            )
              return;
            gesture.current = new PullGesture(
              pullDistance(
                e.pointerType,
                window.innerWidth,
                window.innerHeight,
              ),
            );
            if (
              !gesture.current.begin(e.pointerId, {
                x: e.clientX,
                y: e.clientY,
              })
            )
              return;
            tapInterrupted.current = false;
            gestureScale.current = renderer.current?.getViewport().scale ?? 1;
            const frame = e.currentTarget.getBoundingClientRect();
            gestureFrame.current = {
              width: frame.width,
              height: frame.height,
              dpr: window.devicePixelRatio,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
            const s = engine.getSnapshot();
            engine.setAim(s.aim.angle, 0);
            sling.current = {
              anchor: s.sector.launch,
              pull: s.sector.launch,
              power: 0,
            };
            if (renderer.current)
              engine.setFlightBounds(renderer.current.getVisibleBounds());
            if (pathAssistRef.current === "full") previewDirty.current = true;
            else preview.current = engine.predict(1.6);
            e.preventDefault();
          }}
          onPointerMove={(e) => {
            if (zoom.move(e)) return;
            if (e.pointerId === flightTap.current.pointerId) {
              flightTap.current.move(e.pointerId, {
                x: e.clientX,
                y: e.clientY,
              });
              return;
            }
            updatePull(e.pointerId, e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            if (zoom.end(e)) return;
            if (e.pointerId === flightTap.current.pointerId) {
              flightTap.current.move(e.pointerId, {
                x: e.clientX,
                y: e.clientY,
              });
              const frame = e.currentTarget.getBoundingClientRect();
              const tinyTap =
                flightTap.current.tapEligible &&
                !tapInterrupted.current &&
                Math.abs(frame.width - gestureFrame.current.width) <= 0.5 &&
                Math.abs(frame.height - gestureFrame.current.height) <= 0.5 &&
                window.devicePixelRatio === gestureFrame.current.dpr;
              const flight = tappedFlight.current;
              flightTap.current.cancel();
              tappedFlight.current = null;
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                e.currentTarget.releasePointerCapture(e.pointerId);
              const current = engine.getSnapshot();
              if (
                tinyTap &&
                !pauseRef.current &&
                !helpRef.current &&
                current.status === "flying" &&
                current.canBranch &&
                current.event?.id === flight
              ) {
                engine.branch();
                setModeFeedback("Shot split");
                refresh();
              }
              return;
            }
            if (e.pointerId !== gesture.current.pointerId) return;
            const frame = e.currentTarget.getBoundingClientRect();
            if (
              Math.abs(frame.width - gestureFrame.current.width) > 0.5 ||
              Math.abs(frame.height - gestureFrame.current.height) > 0.5 ||
              window.devicePixelRatio !== gestureFrame.current.dpr
            ) {
              cancel();
              return;
            }
            gesture.current.move(e.pointerId, { x: e.clientX, y: e.clientY });
            const tinyTap =
              gesture.current.tapEligible && !tapInterrupted.current;
            const shot = gesture.current.end(e.pointerId, {
              x: e.clientX,
              y: e.clientY,
            });
            sling.current = null;
            preview.current = [];
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
            const canAct =
              !pauseRef.current &&
              !helpRef.current &&
              engine.getSnapshot().status === "aiming" &&
              !renderer.current?.getViewport().transitioning;
            if (tinyTap && canAct) {
              if (
                taps.current.tap(
                  { x: e.clientX, y: e.clientY },
                  performance.now(),
                )
              ) {
                engine.toggleShotCount();
                setModeFeedback(
                  engine.getSnapshot().shotCount === 3
                    ? "Split mode"
                    : "Single shooter",
                );
                refresh();
              }
            } else taps.current.reset();
            if (
              shot &&
              !pauseRef.current &&
              !helpRef.current &&
              engine.getSnapshot().status === "aiming"
            ) {
              engine.setAim(shot.angle, shot.power);
              if (renderer.current)
                engine.setFlightBounds(renderer.current.getVisibleBounds());
              engine.launch();
              setHint(false);
              refresh();
            }
          }}
          onPointerCancel={(e) => {
            if (zoom.end(e)) return;
            taps.current.reset();
            tapInterrupted.current = true;
            if (
              e.pointerId === gesture.current.pointerId ||
              e.pointerId === flightTap.current.pointerId
            )
              cancel();
          }}
          onLostPointerCapture={(e) => {
            if (
              e.pointerId === gesture.current.pointerId ||
              e.pointerId === flightTap.current.pointerId
            )
              cancel();
          }}
        />
        <GameHeader title="Zen" label="Journey status">
          <span>Checkpoint </span>
          <span
            className="journey-progress"
            aria-label={`Checkpoint ${snapshot.checkpointCount}`}
          >
            {snapshot.checkpointCount}
          </span>
          {debug.enabled && (
            <small className="game-header-debug">
              Debug level {snapshot.sector.index + 1}
            </small>
          )}
        </GameHeader>
        <div className="scene-actions">
          <button
            className="pause-button"
            aria-label="Reset level (R)"
            title="Reset level (R)"
            disabled={snapshot.status === "docked"}
            onClick={resetLevel}
          >
            <Icon name="reset" />
          </button>
          <button
            className="pause-button"
            aria-label="Pause"
            onClick={openPause}
          >
            <Icon name="pause" />
          </button>
        </div>
        {hint && !paused && snapshot.status === "aiming" && (
          <p className="gesture-hint">
            Pull back. Release to fly. Double tap to change shoot modes.
          </p>
        )}
        {offscreenRemaining !== null && !paused && !help && (
          <p className="gesture-hint offscreen-countdown" aria-hidden="true">
            Offscreen · {Math.ceil(offscreenRemaining)}s
          </p>
        )}
        <p className="visually-hidden" aria-live="polite" aria-atomic="true">
          {modeFeedback}
        </p>
        <p className="scene-announcement visually-hidden" role="status">
          {announcement}
        </p>
      </div>
      {help ? (
        <Walkthrough
          mode="zen"
          steps={tutorialSteps(
            "zen",
            snapshot.sector.bodies.map((body) => body.kind),
          )}
          readTarget={readTutorialTarget}
          clearFocus={clearTutorialFocus}
          onFinish={closeTutorial}
        />
      ) : paused ? (
        <PauseMenu
          onModes={onExit}
          onResume={resume}
          onHelp={() => {
            returnToPause.current = true;
            cancel();
            helpRef.current = true;
            setHelp(true);
          }}
          onRestart={restart}
          onResetShot={resetLevel}
          onSound={() => {
            if (muted) sound.current.unlock();
            setMuted((m) => !m);
          }}
          muted={muted}
          flying={snapshot.status === "flying"}
        />
      ) : null}
    </main>
  );
}

export default function App() {
  const [mode, setMode] = useState<OrbitMode | null>(() => {
    const value = new URLSearchParams(window.location.search).get("mode");
    if (value === null && zenDebugStart(window.location.search).enabled)
      return "zen";
    return value === "zen" || value === "gravity" || value === "creator"
      ? value
      : null;
  });
  const [startTutorial, setStartTutorial] = useState(false);
  const exitMode = () => {
    setStartTutorial(false);
    setMode(null);
  };
  useEffect(() => {
    const url = new URL(window.location.href);
    if (mode) url.searchParams.set("mode", mode);
    else url.searchParams.delete("mode");
    window.history.replaceState(window.history.state, "", url);
  }, [mode]);
  if (mode === "zen")
    return <ZenGame onExit={exitMode} startTutorial={startTutorial} />;
  if (mode === "gravity")
    return <GravityGame onExit={exitMode} startTutorial={startTutorial} />;
  if (mode === "creator") return <GravityCreator onExit={exitMode} />;
  return (
    <ModeChooser
      onSelect={(selected) => {
        setStartTutorial(false);
        setMode(selected);
      }}
      onHelp={(selected) => {
        setStartTutorial(true);
        setMode(selected);
      }}
    />
  );
}
