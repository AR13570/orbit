import { useCallback, useEffect, useRef, useState } from "react";
import { useGameplayZoom } from "../useGameplayZoom";
import { usePathAssist } from "../pathAssist";
import { useSoundPreference } from "../soundPreference";
import ThemeControl from "../components/ThemeControl";
import { MIN_GRAVITY_ZOOM } from "../zoom";
import { LiveGravityPreview } from "./live-preview";
import { corePositionLabel } from "./core-position-label";
import { AimHaptics } from "../haptics";
import AdvancedToggle from "../components/AdvancedToggle";
import AdvancedSettings from "../components/AdvancedSettings";
import PathAssistControl from "../components/PathAssistControl";
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
import { objectiveText } from "./simulation";
import GravityMenu from "./GravityMenu";
import GravityGuide, {
  gravityGuideSeen,
  finishGravityGuide,
} from "./GravityGuide";
import type { Vec2, GravityLevel, GravitySnapshot } from "./types";

function hudSnapshot(engine: GravityEngine): GravitySnapshot {
  const state = engine.getRenderSnapshot();
  return {
    ...state,
    level: structuredClone(state.level),
    physics: { ...state.physics },
    progress: structuredClone(state.progress),
    particles: state.particles.map((planet) => ({
      ...planet,
      trail: [],
      orbits: {},
    })),
  };
}
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
  const [snapshot, setSnapshot] = useState(() => hudSnapshot(engine));
  const [levels, setLevels] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const completionElapsed = useRef(0);
  const nextBorder = useRef<SVGPathElement>(null);
  const [paused, setPaused] = useState(false);
  const [help, setHelp] = useState(
    () => !customLevel && (startTutorial || !gravityGuideSeen()),
  );
  const [muted, setMuted] = useSoundPreference();
  const pauseMusic = useAmbientMusic(!muted && !paused && !help);
  const pathAssist = usePathAssist(),
    pathAssistRef = useRef(pathAssist);
  pathAssistRef.current = pathAssist;
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
    r.prepareFrame?.(engine.getRenderSnapshot().level);
    const bounds = r.getFlightBounds?.();
    if (bounds) engine.setFlightBounds(bounds);
    const defaultScale = r.getDefaultScale?.();
    if (!customLevel && defaultScale !== undefined)
      engine.setDefaultViewScale(defaultScale);
  }, [engine, customLevel]);
  const refresh = useCallback(() => {
    syncWorldFrame();
    setSnapshot(hudSnapshot(engine));
  }, [engine, syncWorldFrame]);
  const cancel = useCallback(() => {
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
  }, [engine]);
  useEffect(() => {
    cancel();
  }, [pathAssist, cancel]);
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
      lastScale = 1;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const tick = (time: number) => {
      const wallMilliseconds = last === null ? 0 : Math.max(0, time - last);
      const dt = Math.min(0.05, wallMilliseconds / 1000);
      last = time;
      const active = !pause.current && !helpRef.current && !document.hidden;
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
            pathAssistRef.current,
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
      if (!state.complete) completionElapsed.current = 0;
      else if (!lastComplete.current) {
        completionElapsed.current = 0;
        saveCurrent(state.level.index, true);
      } else if (active && !customLevel) {
        completionElapsed.current += wallMilliseconds;
        if (nextBorder.current)
          nextBorder.current.style.strokeDashoffset = String(
            Math.max(0, 1 - completionElapsed.current / 3000),
          );
        if (completionElapsed.current >= 3000) {
          nextLevel();
          state = engine.getRenderSnapshot();
        }
      }
      lastComplete.current = state.complete;
      r.render(state, preview.current, time / 1000, {
        paused: !active,
        reducedMotion: reduced,
        pull: pull.current,
        pathAssist: pathAssistRef.current,
      });
      const scale = r.getScale();
      if (scale !== lastScale) {
        setProjectileScale(scale);
        lastScale = scale;
      }
      if (time - lastHud >= 80) {
        setSnapshot(hudSnapshot(engine));
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
  const alive = snapshot.particles.filter((p) => p.alive).length;
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
            {customLevel ? "Playtest" : `Level ${snapshot.level.index + 1}`}
          </span>
        </GameHeader>
        <ProjectileSizeControl
          value={projectileSize}
          baseRadius={
            snapshot.physics.planetRadius / (snapshot.projectileSize ?? 1)
          }
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
          {snapshot.level.orbitPadding !== undefined &&
            snapshot.level.title && (
              <h1 className="gravity-stage-title">{snapshot.level.title}</h1>
            )}
          {snapshot.level.requirements?.some(
            (goal) => goal.direction && goal.direction !== "either",
          ) && (
            <span className="visually-hidden">
              {snapshot.level.requirements
                .map(
                  (goal) =>
                    `${corePositionLabel(snapshot.level, goal.bodyId)}: ${goal.direction ?? "either direction"}`,
                )
                .join(". ")}
            </span>
          )}
          <p>{objectiveText(snapshot.level)}</p>
          {snapshot.level.journey ? (
            <div className="gravity-journey" aria-label="Route progress">
              <span>Same planet</span>
              <ol>
                {snapshot.level.journey.legs.map((leg, index) => {
                  const best = Math.max(
                    0,
                    ...snapshot.particles
                      .filter((p) => p.alive)
                      .map((p) => p.journey?.leg ?? 0),
                  );
                  const name = corePositionLabel(snapshot.level, leg.bodyId);
                  return (
                    <li
                      key={index}
                      data-complete={index < best}
                      data-active={index === best}
                      aria-label={`${name}${index < best ? ": passed" : index === best ? ": next" : ""}`}
                    >
                      {name}
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : (
            snapshot.level.objective.kind !== "none" && (
              <span>
                {snapshot.progress.current} / {snapshot.progress.target}{" "}
                {snapshot.level.sharedOrbit ? "shared orbits" : "orbits"}
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
                  snapshot.level.index === level.index ? "step" : undefined
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
            <PathAssistControl />
            <AdvancedToggle
              label="Particle Interaction"
              description="On lets each planet attract other planets. Larger planets exert a stronger pull. Off removes this mutual pull; fixed cores still affect every planet."
              enabled={snapshot.physics.planetGravity}
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
              enabled={snapshot.physics.planetCollisions === "soft"}
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
