import { useCallback, useEffect, useRef, useState } from "react";
import { useGameplayZoom } from "../useGameplayZoom";
import { useSoundPreference } from "../soundPreference";
import ThemeControl from "../components/ThemeControl";
import { MIN_GRAVITY_ZOOM } from "../zoom";
import { LiveGravityPreview } from "./live-preview";
import { gravityHudSnapshot } from "./hud";
import { useTheme } from "../theme";
import { AimHaptics } from "../haptics";
import AdvancedToggle from "../components/AdvancedToggle";
import AdvancedSettings from "../components/AdvancedSettings";
import ProjectileSizeControl from "./ProjectileSizeControl";
import { PullGesture } from "../controls";
import { gravityAim, gravityLaunchIsClear, gravityPullDistance } from "./input";
import { gravityAimPredictionSeconds } from "./aim-preview";
import { gravityLaunchSpeed } from "./physics";
import Icon from "../components/Icon";
import GameHeader from "../components/GameHeader";
import GravityLevelAction from "./GravityLevelAction";
import ResetViewControl from "../components/ResetViewControl";
import { resolveGravitySeed } from "./seed";
import { useAmbientMusic } from "../audio/useAmbientMusic";
import {
  getGravityLevel,
  getCampaignCatalog,
  CAMPAIGN_LEVEL_COUNT,
} from "./campaign";
import {
  loadGravityProgress,
  saveGravityProgress,
  recordGravityCompletion,
  setGravityCurrentIndex,
} from "./progress";
import {
  readParticleGrouping,
  saveParticleGrouping,
  readParticleInteraction,
  saveParticleInteraction,
  readProjectileSize,
  saveProjectileSize,
} from "./preferences";
import { GravityEngine } from "./engine";
import { createGravityRenderer } from "./renderer";
import GravityMenu from "./GravityMenu";
import GravityGuide, {
  gravityGuideSeen,
  finishGravityGuide,
} from "./GravityGuide";
import type { Vec2, GravityLevel, GravitySnapshot } from "./types";

export default function GravityGame({
  onExit,
  customLevel,
  customName,
  startTutorial = false,
}: {
  onExit: () => void;
  customLevel?: GravityLevel;
  customName?: string;
  startTutorial?: boolean;
}) {
  const [seed] = useState(() => resolveGravitySeed(window.location.search));
  const [savedProgress, setSavedProgress] = useState(() =>
    loadGravityProgress(seed),
  );
  const progressRef = useRef(savedProgress);
  const [engine] = useState(() => {
    const game = new GravityEngine(seed, customLevel, getGravityLevel);
    if (!customLevel) game.goTo(savedProgress.currentIndex);
    const interaction = readParticleInteraction();
    if (interaction !== null || !customLevel)
      game.setParticleInteraction(interaction ?? true);
    game.setParticleGrouping(readParticleGrouping());
    game.setProjectileSize(readProjectileSize());
    return game;
  });
  const [projectileSize, setProjectileSize] = useState(() =>
    engine.getProjectileSize(),
  );
  const [blockedLaunch, setBlockedLaunch] = useState(false);
  useEffect(() => {
    if (!blockedLaunch) return;
    const timer = window.setTimeout(() => setBlockedLaunch(false), 2400);
    return () => window.clearTimeout(timer);
  }, [blockedLaunch]);
  const [projectileScale, setProjectileScale] = useState(1);
  const [snapshot, setSnapshot] = useState(() =>
    gravityHudSnapshot(engine.getRenderSnapshot()),
  );
  const lastHudSnapshot = useRef(snapshot);
  const renderRevision = useRef(0);
  const invalidateRender = useCallback(() => {
    renderRevision.current++;
  }, []);
  const publishHud = useCallback((state: GravitySnapshot) => {
    const next = gravityHudSnapshot(state, lastHudSnapshot.current);
    if (next !== lastHudSnapshot.current) {
      lastHudSnapshot.current = next;
      setSnapshot(next);
    }
  }, []);
  const [theme] = useTheme();
  useEffect(invalidateRender, [theme, invalidateRender]);
  const [levels, setLevels] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const completionElapsed = useRef(0);
  const autoNextCancelledRef = useRef(false);
  const [autoNextCancelled, setAutoNextCancelled] = useState(false);
  const nextBorder = useRef<SVGPathElement>(null);
  const [paused, setPaused] = useState(false);
  const [help, setHelp] = useState(
    () => !customLevel && (startTutorial || !gravityGuideSeen()),
  );
  const [muted, setMuted] = useSoundPreference();
  const pauseMusic = useAmbientMusic(!muted && !paused && !help);
  const livePreview = useRef(new LiveGravityPreview()),
    haptics = useRef(new AimHaptics());
  const canvas = useRef<HTMLCanvasElement>(null),
    scene = useRef<HTMLElement>(null);
  const renderer = useRef<ReturnType<typeof createGravityRenderer> | null>(
    null,
  );
  const gesture = useRef(new PullGesture(160)),
    origin = useRef<Vec2 | null>(null),
    pull = useRef<Vec2 | null>(null),
    preview = useRef<Vec2[]>([]);
  const pause = useRef(false),
    helpRef = useRef(help);
  const saveCurrent = useCallback(
    (index: number, complete = false) => {
      if (customLevel) return;
      const next = complete
        ? recordGravityCompletion(progressRef.current, index)
        : setGravityCurrentIndex(progressRef.current, index);
      progressRef.current = next;
      setSavedProgress(next);
      saveGravityProgress(next);
    },
    [customLevel],
  );
  const lastComplete = useRef(false),
    returnToPause = useRef(false);
  const frameSize = useRef({ width: 0, height: 0, dpr: 1 });
  helpRef.current = help;
  const syncWorldFrame = useCallback(() => {
    const r = renderer.current;
    if (!r) return;
    r.prepareFrame?.(engine.getLevel());
    const bounds = r.getFlightBounds?.();
    if (bounds) engine.setFlightBounds(bounds);
    const defaultScale = r.getDefaultScale?.();
    if (!customLevel && defaultScale !== undefined)
      engine.setDefaultViewScale(defaultScale);
  }, [engine, customLevel]);
  const refresh = useCallback(() => {
    syncWorldFrame();
    publishHud(engine.getRenderSnapshot());
    invalidateRender();
  }, [engine, syncWorldFrame, publishHud, invalidateRender]);
  const cancel = useCallback(() => {
    invalidateRender();
    const id = gesture.current.pointerId;
    gesture.current.cancel();
    origin.current = null;
    pull.current = null;
    preview.current = [];
    livePreview.current.cancel();
    haptics.current.cancel();
    engine.setAiming(false);
    if (id !== null && canvas.current?.hasPointerCapture?.(id))
      canvas.current.releasePointerCapture(id);
  }, [engine, invalidateRender]);
  const zoom = useGameplayZoom({
    canvas,
    minimum: MIN_GRAVITY_ZOOM,
    restoreView: (fraction) => renderer.current?.resetPan?.(fraction),
    pan: (x, y) => renderer.current?.panBy?.(x, y),
    blocked: () => helpRef.current || pause.current || document.hidden,
    cancel,
    apply: (value, focus) => renderer.current?.setZoom(value, focus),
  });
  const openPause = useCallback(() => {
    pauseMusic();
    cancel();
    pause.current = true;
    engine.setPaused(true);
    setPaused(true);
  }, [cancel, engine, pauseMusic]);
  const resume = () => {
    pause.current = false;
    engine.setPaused(false);
    setPaused(false);
    canvas.current?.focus();
    invalidateRender();
  };
  const retry = useCallback(() => {
    if (helpRef.current) return;
    cancel();
    engine.retry();
    saveCurrent(engine.getRenderSnapshot().level.index);
    lastComplete.current = false;
    refresh();
  }, [cancel, engine, refresh, saveCurrent]);
  const nextLevel = useCallback(() => {
    if (!engine.getRenderSnapshot().complete || customLevel) return;
    cancel();
    engine.advance();
    completionElapsed.current = 0;
    saveCurrent(engine.getRenderSnapshot().level.index);
    lastComplete.current = false;
    refresh();
  }, [cancel, customLevel, engine, refresh, saveCurrent]);
  const cancelSkip = () => {
    setConfirmSkip(false);
    resume();
  };
  const skipLevel = () => {
    cancel();
    engine.skip();
    completionElapsed.current = 0;
    saveCurrent(engine.getRenderSnapshot().level.index);
    lastComplete.current = false;
    setConfirmSkip(false);
    refresh();
    resume();
  };
  useEffect(() => {
    const r = createGravityRenderer(canvas.current!);
    renderer.current = r;
    const resize = () => {
      cancel();
      const rect = scene.current!.getBoundingClientRect();
      r.resize(rect.width, rect.height, window.devicePixelRatio);
      invalidateRender();
      syncWorldFrame();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(scene.current!);
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    let frame = 0,
      last: number | null = null,
      lastHud = 0,
      lastScale = 1,
      lastPaintedRevision = -1,
      lastActive: boolean | undefined,
      renderTime = 0;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const tick = (time: number) => {
      const wallMilliseconds = last === null ? 0 : Math.max(0, time - last);
      const dt = wallMilliseconds / 1000;
      last = time;
      const active = !pause.current && !helpRef.current && !document.hidden;
      const dirty =
        lastPaintedRevision !== renderRevision.current || active !== lastActive;
      lastActive = active;
      // Keep the wall clock current while frozen, without rebuilding snapshots or painting.
      if (document.hidden || (!active && !dirty)) {
        frame = requestAnimationFrame(tick);
        return;
      }
      if (active) renderTime += dt;
      syncWorldFrame();
      if (active) engine.update(dt);
      let state = engine.getRenderSnapshot();
      if (
        active &&
        gesture.current.active &&
        origin.current &&
        gravityLaunchIsClear(origin.current, state)
      ) {
        engine.setAiming(true);
        preview.current = livePreview.current.update(
          (seconds) => engine.beginPrediction(seconds),
          gravityAimPredictionSeconds(
            r.getScale(),
            gravityLaunchSpeed(state.aim.power),
            state.particles.length,
          ),
          dt,
          state.aim,
        );
      } else if (origin.current) {
        livePreview.current.cancel();
        preview.current = [];
        engine.setAiming(false);
      }
      if (!state.complete || !lastComplete.current) {
        completionElapsed.current = 0;
        if (autoNextCancelledRef.current) {
          autoNextCancelledRef.current = false;
          setAutoNextCancelled(false);
        }
        if (state.complete) saveCurrent(state.level.index, true);
      } else if (active && !customLevel && !autoNextCancelledRef.current) {
        completionElapsed.current += wallMilliseconds;
        if (nextBorder.current)
          nextBorder.current.style.strokeDashoffset = String(
            Math.max(0, 1 - completionElapsed.current / 10000),
          );
        if (completionElapsed.current >= 10000) {
          nextLevel();
          state = engine.getRenderSnapshot();
        }
      }
      lastComplete.current = state.complete;
      r.render(state, preview.current, renderTime, {
        paused: !active,
        reducedMotion: reduced,
        pull: pull.current,
      });
      lastPaintedRevision = renderRevision.current;
      const scale = r.getScale();
      if (scale !== lastScale) {
        setProjectileScale(scale);
        lastScale = scale;
      }
      if (dirty || time - lastHud >= 80) {
        publishHud(state);
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
  }, [
    engine,
    cancel,
    customLevel,
    nextLevel,
    openPause,
    saveCurrent,
    syncWorldFrame,
    publishHud,
    invalidateRender,
  ]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        helpRef.current ||
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
      if (e.key.toLowerCase() === "r") {
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
  }, [retry, openPause]);
  const updatePull = (id: number, x: number, y: number) => {
    const rawAim = gesture.current.move(id, { x, y });
    if (!rawAim || !origin.current) return;
    const aim = gravityAim(rawAim);
    const clear = gravityLaunchIsClear(
      origin.current,
      engine.getRenderSnapshot(),
    );
    engine.setAiming(
      clear && !pause.current && !helpRef.current && !document.hidden,
    );
    haptics.current.aim(rawAim.distance, clear);
    engine.setLaunch(origin.current, aim);
    pull.current = aim.pull;
  };
  const openHelp = (fromPause = false) => {
    pauseMusic();
    cancel();
    returnToPause.current = fromPause;
    helpRef.current = true;
    setHelp(true);
  };
  const closeGuide = (result: "complete" | "skipped") => {
    finishGravityGuide(result);
    helpRef.current = false;
    setHelp(false);
    if (returnToPause.current || document.hidden || pause.current) openPause();
    else resume();
    returnToPause.current = false;
  };
  const alive = snapshot.alive;
  return (
    <main ref={scene} className="orbit-scene gravity-scene">
      <div
        className="game-surface"
        inert={help || paused}
        aria-hidden={help || paused || undefined}
      >
        <canvas
          ref={canvas}
          className="scene-canvas"
          style={{
            cursor: zoom.panning
              ? "grabbing"
              : zoom.panReady
                ? "grab"
                : undefined,
          }}
          tabIndex={0}
          aria-label="Gravity orbital field"
          onBlur={cancel}
          onPointerDown={(e) => {
            if (zoom.down(e)) return;
            if (!e.isPrimary || gesture.current.active) {
              cancel();
              return;
            }
            if (e.button !== 0 || pause.current || helpRef.current) return;
            syncWorldFrame();
            setBlockedLaunch(false);
            gesture.current = new PullGesture(
              gravityPullDistance(
                e.pointerType,
                window.innerWidth,
                window.innerHeight,
                zoom.zoom,
              ),
              { unlimitedPull: true },
            );
            origin.current = renderer.current?.screenToWorld(
              e.clientX,
              e.clientY,
            ) ?? { x: e.clientX, y: e.clientY };
            gesture.current.begin(e.pointerId, { x: e.clientX, y: e.clientY });
            haptics.current.begin(e.pointerType);
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
          onPointerMove={(e) => {
            if (!zoom.move(e)) updatePull(e.pointerId, e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            if (zoom.end(e) || e.pointerId !== gesture.current.pointerId)
              return;
            const rect = e.currentTarget.getBoundingClientRect();
            if (
              Math.abs(rect.width - frameSize.current.width) > 0.5 ||
              Math.abs(rect.height - frameSize.current.height) > 0.5 ||
              window.devicePixelRatio !== frameSize.current.dpr
            ) {
              cancel();
              return;
            }
            const position = origin.current,
              shot = gesture.current.end(
                e.pointerId,
                {
                  x: e.clientX,
                  y: e.clientY,
                },
                { allowTap: true },
              );
            pull.current = null;
            preview.current = [];
            livePreview.current.cancel();
            engine.setAiming(false);
            origin.current = null;
            if (e.currentTarget.hasPointerCapture?.(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
            let launched = false;
            if (
              shot &&
              position &&
              !pause.current &&
              !helpRef.current &&
              !document.hidden
            ) {
              syncWorldFrame();
              if (gravityLaunchIsClear(position, engine.getRenderSnapshot())) {
                engine.setLaunch(position, gravityAim(shot));
                launched =
                  shot.power === 0
                    ? engine.launchFrom(position, { x: 0, y: 0 })
                    : engine.launch();
              } else setBlockedLaunch(true);
              refresh();
            }
            haptics.current.release(launched);
          }}
          onPointerCancel={(e) => {
            zoom.end(e);
            cancel();
          }}
          onLostPointerCapture={(e) => {
            if (gesture.current.pointerId === e.pointerId) cancel();
          }}
        />
        <GameHeader
          title={customLevel ? customName || "Custom level" : "Gravity"}
          onHome={
            customLevel
              ? undefined
              : () => {
                  cancel();
                  onExit();
                }
          }
        >
          <span className="gravity-level">
            {customLevel ? "Playtest" : `Level ${snapshot.levelIndex + 1}`}
          </span>
        </GameHeader>
        <ProjectileSizeControl
          value={projectileSize}
          baseRadius={snapshot.planetRadius / snapshot.projectileSize}
          scale={projectileScale}
          onInteract={cancel}
          onChange={(value) => {
            cancel();
            engine.setProjectileSize(value);
            const size = engine.getProjectileSize();
            setProjectileSize(size);
            saveProjectileSize(size);
          }}
        />
        <div className="scene-actions">
          <button
            className="pause-button"
            aria-label="How to play"
            title="How to play"
            onClick={() => openHelp()}
          >
            <Icon name="help" />
          </button>
          <button
            className="pause-button"
            aria-label="Reset level (R)"
            title="Reset level (R)"
            onClick={retry}
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
        <div className="gravity-objective">
          {snapshot.title && (
            <h1 className="gravity-stage-title">{snapshot.title}</h1>
          )}
          {snapshot.directionText && (
            <span className="visually-hidden">{snapshot.directionText}</span>
          )}
          <p>{snapshot.objective}</p>
          {snapshot.journeyLabels ? (
            <div className="gravity-journey" aria-label="Route progress">
              <span>Same planet</span>
              <ol>
                {snapshot.journeyLabels.map((name, index) => (
                  <li
                    key={index}
                    data-complete={index < snapshot.bestJourneyLeg}
                    data-active={index === snapshot.bestJourneyLeg}
                    aria-label={`${name}${index < snapshot.bestJourneyLeg ? ": passed" : index === snapshot.bestJourneyLeg ? ": next" : ""}`}
                  >
                    {name}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            snapshot.hasObjective && (
              <span>
                {snapshot.current} / {snapshot.target}{" "}
                {snapshot.sharedOrbit ? "shared orbits" : "orbits"}
              </span>
            )
          )}
          {customLevel ? (
            <button
              className="gravity-skip"
              onClick={() => {
                cancel();
                onExit();
              }}
            >
              Back to editor
              <Icon name="back" />
            </button>
          ) : null}
        </div>
        <div className="gravity-footer">
          <p className="gravity-feedback" role="status">
            {blockedLaunch
              ? "Start in clear space"
              : snapshot.complete
                ? "Orbits aligned"
                : `${alive} ${alive === 1 ? "planet" : "planets"} in motion`}
          </p>
          {!customLevel && (
            <GravityLevelAction
              complete={snapshot.complete}
              borderRef={nextBorder}
              autoNextCancelled={autoNextCancelled}
              onCancelAutoNext={() => {
                autoNextCancelledRef.current = true;
                setAutoNextCancelled(true);
              }}
              onNext={nextLevel}
              onSkip={() => {
                openPause();
                setConfirmSkip(true);
              }}
            />
          )}
        </div>
        {!paused && !help && (
          <ResetViewControl
            zoom={zoom.zoom}
            panned={zoom.panned}
            onReset={zoom.reset}
          />
        )}
      </div>
      {help ? (
        <GravityGuide onFinish={closeGuide} />
      ) : confirmSkip ? (
        <GravityMenu
          title="Skip this level?"
          onClose={cancelSkip}
          dismissOnBackdrop
        >
          <p>
            You can return to this level later. Skipping won't mark it as
            completed.
          </p>
          <div className="gravity-skip-confirm-actions">
            <button onClick={cancelSkip}>
              <span>Keep playing</span>
            </button>
            <button onClick={skipLevel}>
              <span className="gravity-confirm-primary">Skip level</span>
            </button>
          </div>
        </GravityMenu>
      ) : paused && levels ? (
        <GravityMenu title="Choose a level" onClose={() => setLevels(false)}>
          <button className="pause-option" onClick={() => setLevels(false)}>
            Back to pause
          </button>
          <p>45 authored skies, then an endless universe.</p>
          <div
            className="gravity-level-grid"
            role="group"
            aria-label="Campaign levels"
          >
            {getCampaignCatalog().map((level) => (
              <button
                key={level.index}
                aria-label={`Level ${level.index + 1}: ${level.title}`}
                title={level.title}

                aria-current={
                  snapshot.levelIndex === level.index ? "step" : undefined
                }
                onClick={() => {
                  cancel();
                  engine.goTo(level.index);
                  saveCurrent(level.index);
                  lastComplete.current = false;
                  setLevels(false);
                  refresh();
                  resume();
                }}
              >
                {level.index + 1}
                {savedProgress.completedIndices.includes(level.index) && (
                  <span aria-label="completed">
                    <Icon name="check" />
                  </span>
                )}
              </button>
            ))}
          </div>
          <button
            className="pause-resume"
            onClick={() => {
              engine.goTo(
                Math.max(CAMPAIGN_LEVEL_COUNT, savedProgress.currentIndex),
              );
              saveCurrent(engine.getRenderSnapshot().level.index);
              lastComplete.current = false;
              setLevels(false);
              refresh();
              resume();
            }}
          >
            Explore infinite skies
          </button>
        </GravityMenu>
      ) : paused ? (
        <GravityMenu
          title="Paused"
          onClose={resume}
          dismissOnBackdrop
          showAttribution
        >
          <button className="pause-resume" onClick={resume}>
            Resume <Icon name="play" />
          </button>
          <AdvancedSettings>
            <AdvancedToggle
              label="Particle Interaction"
              description="On lets each planet attract other planets. Larger planets exert a stronger pull. Off removes this mutual pull; fixed cores still affect every planet."
              enabled={snapshot.planetGravity}
              onToggle={() => {
                cancel();
                const enabled =
                  !engine.getRenderSnapshot().physics.planetGravity;
                engine.setParticleInteraction(enabled);
                saveParticleInteraction(enabled);
                refresh();
              }}
              icon={
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="12" r="3" />
                  <path d="m10 9 2 3-2 3m4-6-2 3 2 3" />
                </svg>
              }
            />
            <AdvancedToggle
              label="Particle grouping"
              description="On lets slow bound encounters settle together. Fast or glancing encounters transfer momentum and can separate. Off lets planets pass through each other. Particle Interaction controls their mutual pull separately."
              enabled={snapshot.planetCollisions === "soft"}
              onToggle={() => {
                cancel();
                const enabled =
                  engine.getRenderSnapshot().physics.planetCollisions !==
                  "soft";
                engine.setParticleGrouping(enabled);
                saveParticleGrouping(enabled);
                refresh();
              }}
              icon={
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <circle cx="8" cy="10" r="5" />
                  <circle cx="16" cy="14" r="4" />
                </svg>
              }
            />
          </AdvancedSettings>
          <div className="pause-options">
            <ThemeControl />
            <button
              className="pause-option"
              aria-pressed={!muted}
              onClick={() => {
                setMuted((m) => !m);
              }}
            >
              <Icon name={muted ? "muted" : "sound"} />
              <span>{muted ? "Sound off" : "Sound on"}</span>
              <span className="pause-switch" aria-hidden="true" />
            </button>
            <button className="pause-option" onClick={() => openHelp(true)}>
              <Icon name="help" />
              <span>How to play</span>
              <span className="pause-chevron" aria-hidden="true" />
            </button>
            <button
              className="pause-option"
              onClick={() => {
                retry();
                resume();
              }}
            >
              <Icon name="reset" />
              <span>Restart level</span>
              <span className="pause-chevron" aria-hidden="true" />
            </button>
            {!customLevel && (
              <button className="pause-option" onClick={() => setLevels(true)}>
                <Icon name="grid" />
                <span>Choose a level</span>
                <span className="pause-chevron" aria-hidden="true" />
              </button>
            )}
          </div>
          <button
            className="pause-option pause-new-seed"
            onClick={() => {
              cancel();
              onExit();
            }}
          >
            <Icon name="swap" />
            <span>{customLevel ? "Back to editor" : "Choose mode"}</span>
            <span className="pause-chevron" aria-hidden="true" />
          </button>
        </GravityMenu>
      ) : null}
    </main>
  );
}
