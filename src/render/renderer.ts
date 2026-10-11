import type { Body, GameSnapshot, Vec2 } from "../game/types";
import { sampleGravityWave, type WaveSample } from "./gravity-surface";
import {
  clientToWorld,
  fitCamera,
  fitFieldCamera,
  interpolateCamera,
  worldToClient,
  visibleWorldBounds,
  visiblePullPoint,
  type Camera,
  type FieldBounds,
} from "./coordinates";

const TAU = Math.PI * 2;
const COLOR = {
  ground: "#e9ecef",
  charcoal: "#303943",
  slate: "#626d78",
  blue: "#527c9a",
  checkpoint: "#168dff",
  rust: "#b76550",
  aim: "#8a0f4b",
};

type Sector = GameSnapshot["sector"];
export interface SlingshotVisual {
  anchor: Vec2;
  /** Virtual point: anchor + client drag delta / displayed camera scale. */
  pull: Vec2;
  power: number;
}
export interface RenderOptions {
  reducedMotion?: boolean;
  paused?: boolean;
  cameraLocked?: boolean;
  slingshot?: SlingshotVisual | null;
}
export interface OrbitRenderer {
  resize(width: number, height: number, dpr?: number): void;
  prepareFrame(
    snapshot: GameSnapshot,
    timeSeconds: number,
    options?: RenderOptions,
  ): void;
  getVisibleBounds(): FieldBounds;
  render(
    snapshot: GameSnapshot,
    preview: Vec2[][],
    timeSeconds: number,
    options?: RenderOptions,
  ): void;
  screenToWorld(clientX: number, clientY: number): Vec2;
  worldToScreen(worldPoint: Vec2): Vec2;
  getViewport(): Camera & { transitioning: boolean; bounds: FieldBounds };
  destroy(): void;
}
interface Effect {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  color: string;
}

function circle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, TAU);
}
function line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function fieldBounds(sector: Sector): FieldBounds {
  return sector.bounds;
}

// A regular XY lattice samples a local height field. Symmetric radial relief
// keeps every circular crest concentric with its unchanged physical object.
interface SurfaceScratch {
  points: Float32Array;
  wave: WaveSample;
}
function drawGravitySurface(
  ctx: CanvasRenderingContext2D,
  position: Vec2,
  radius: number,
  repels: boolean,
  scale: number,
  motionTime: number,
  reducedMotion: boolean,
  color: string,
  scratch: SurfaceScratch,
) {
  const opacity = ctx.globalAlpha;
  const points = scratch.points;
  const outer = radius + 140;
  // At most 73 x 73 candidates per desktop patch, 49 x 49 on phones.
  // Reuse one fixed scratch buffer for every patch and frame.
  const halfCells = scale < 0.55 ? 24 : 36;
  const step = Math.max(4, 3 / scale, outer / halfCells);
  const cells = Math.min(halfCells, Math.floor(outer / step));
  const clock = reducedMotion ? 0 : motionTime;
  let count = 0;
  for (let row = -cells; row <= cells; row++) {
    for (let column = -cells; column <= cells; column++) {
      const dx = column * step;
      const dy = row * step;
      const x = position.x + dx;
      const y = position.y + dy;
      const distance = Math.hypot(dx, dy);
      const fromEdge = distance - radius;
      if (fromEdge <= 3 || distance >= outer) continue;
      const innerFade = Math.min(1, (fromEdge - 3) / 18);
      const edgeFade = Math.min(1, (outer - distance) / 35);
      const fade = Math.exp(-fromEdge / 82) * innerFade * edgeFade * edgeFade;
      sampleGravityWave(fromEdge, radius, clock, repels, scratch.wave);
      const { crest, slope } = scratch.wave;
      const height = 28 * fade * crest * crest;
      const lit = Math.max(0, (slope * (-dx - dy)) / (distance * Math.SQRT2));
      const size = Math.min(
        step * 0.65,
        (1.3 + crest * 1.2 + lit * 0.3) / scale,
      );
      const alpha = fade * (0.28 + 0.3 * crest + 0.22 * lit);
      const shade =
        Math.min(7, Math.floor(alpha / 0.09)) + (lit > 0.08 ? 8 : 0);
      const slot = count++ * 4;
      points[slot] = x + (dx / distance) * height * 0.45 - size * 0.5;
      points[slot + 1] = y + (dy / distance) * height * 0.45 - size * 0.36;
      points[slot + 2] = size;
      points[slot + 3] = shade;
    }
  }
  // Sixteen flat shade paths replace thousands of individual fill calls.
  // The lowest shade is barely visible, preserving rows between raised crests.
  for (let shade = 0; shade < 16; shade++) {
    ctx.beginPath();
    ctx.globalAlpha = opacity * 0.7 * (0.02 + (shade % 8) * 0.09);
    ctx.fillStyle = shade >= 8 ? color : COLOR.charcoal;
    for (let i = 0; i < count; i++) {
      const slot = i * 4;
      if (points[slot + 3] !== shade) continue;
      const size = points[slot + 2];
      ctx.rect(points[slot], points[slot + 1], size, size * 0.72);
    }
    ctx.fill();
  }
  ctx.globalAlpha = opacity;
}

function drawGravityFields(
  ctx: CanvasRenderingContext2D,
  sector: Sector,
  scale: number,
  opacity: number,
  motionTime: number,
  reducedMotion: boolean,
  includeGoal: boolean,
  scratch: SurfaceScratch,
) {
  ctx.save();
  ctx.globalAlpha = opacity;
  for (const body of sector.bodies)
    drawGravitySurface(
      ctx,
      body.position,
      body.radius,
      body.kind === "repellent",
      scale,
      motionTime,
      reducedMotion,
      body.kind === "repellent" ? COLOR.rust : COLOR.blue,
      scratch,
    );
  if (includeGoal)
    drawGravitySurface(
      ctx,
      sector.checkpoint.position,
      sector.checkpoint.radius,
      false,
      scale,
      motionTime,
      reducedMotion,
      COLOR.checkpoint,
      scratch,
    );
  ctx.restore();
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  body: Readonly<Body>,
  scale: number,
) {
  const { x, y } = body.position,
    r = body.radius;
  const repels = body.kind === "repellent";
  const opacity = ctx.globalAlpha;
  ctx.save();
  ctx.globalAlpha = opacity * 0.065;
  ctx.fillStyle = COLOR.charcoal;
  circle(
    ctx,
    x + Math.max(2, 1 / scale),
    y + Math.max(5, 2 / scale),
    r + Math.max(2, 1 / scale),
  );
  ctx.fill();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = repels ? "#535960" : COLOR.charcoal;
  circle(ctx, x, y, r);
  ctx.fill();
  ctx.strokeStyle = repels ? "#c49080" : "#91a9bb";
  ctx.lineWidth = Math.max(1.2, 0.8 / scale);
  circle(ctx, x, y, r);
  ctx.stroke();
  // Directional chevrons add a second force cue beyond color.
  const mark = Math.min(r * 0.34, Math.max(7, 4 / scale));
  ctx.strokeStyle = repels ? "#e9cbc1" : "#b5c8d7";
  ctx.lineWidth = 1.15 / scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.translate(x, y);
  for (const side of [-1, 1]) {
    const tip = side * (repels ? mark : mark * 0.32),
      back = side * (repels ? mark * 0.35 : mark);
    ctx.beginPath();
    ctx.moveTo(back, -mark * 0.45);
    ctx.lineTo(tip, 0);
    ctx.lineTo(back, mark * 0.45);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGeometry(
  ctx: CanvasRenderingContext2D,
  sector: Sector,
  scale: number,
  opacity = 1,
) {
  ctx.save();
  ctx.globalAlpha = opacity;
  for (const body of sector.bodies) drawBody(ctx, body, scale);
  ctx.restore();
}

function drawDock(
  ctx: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  scale: number,
) {
  const {
    position: { x, y },
    radius,
  } = snapshot.sector.checkpoint;
  ctx.save();
  // Discrete blue bands give the well depth while leaving the capture aperture open.
  ctx.globalAlpha = 0.075;
  ctx.fillStyle = COLOR.blue;
  circle(ctx, x, y, radius + 8);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLOR.ground;
  circle(ctx, x, y, radius);
  ctx.fill();
  ctx.strokeStyle = COLOR.checkpoint;
  ctx.lineWidth = 1 / scale;
  for (const fraction of [0.72, 0.43]) {
    ctx.globalAlpha = fraction === 0.72 ? 0.35 : 0.55;
    circle(ctx, x, y, radius * fraction);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2.8 / scale;
  circle(ctx, x, y, radius);
  ctx.stroke();
  // A small flag identifies a checkpoint without suggesting another force-bearing solid.
  const flagHeight = Math.min(10 / scale, radius * 0.52);
  const poleX = x - flagHeight * 0.22;
  const top = y - flagHeight * 0.5;
  ctx.lineWidth = 1.2 / scale;
  ctx.lineCap = "round";
  line(ctx, poleX, top, poleX, top + flagHeight);
  ctx.fillStyle = COLOR.checkpoint;
  ctx.beginPath();
  ctx.moveTo(poleX, top);
  ctx.lineTo(poleX + flagHeight * 0.6, top + flagHeight * 0.22);
  ctx.lineTo(poleX, top + flagHeight * 0.48);
  ctx.lineTo(poleX, top);
  ctx.fill();
  if (snapshot.status === "docked") {
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 2 / scale;
    circle(ctx, x, y, radius + 5 / scale);
    ctx.stroke();
  }
  ctx.restore();
}

function drawShip(
  ctx: CanvasRenderingContext2D,
  position: Vec2,
  angle: number,
  scale: number,
  color = COLOR.charcoal,
  sizeFactor = 1,
) {
  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate(angle);
  const size = Math.max(8, 5.5 / scale) * sizeFactor;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.7, -size * 0.65);
  ctx.lineTo(-size * 0.35, 0);
  ctx.lineTo(-size * 0.7, size * 0.65);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawShooter(
  ctx: CanvasRenderingContext2D,
  position: Vec2,
  angle: number,
  scale: number,
  shotCount: 1 | 3,
) {
  drawShip(ctx, position, angle, scale);
  if (shotCount !== 3) return;
  ctx.save();
  ctx.globalAlpha *= 0.55;
  ctx.fillStyle = COLOR.charcoal;
  for (const side of [-1, 0, 1]) {
    circle(
      ctx,
      position.x + (-Math.cos(angle) * 9 - Math.sin(angle) * side * 4) / scale,
      position.y + (-Math.sin(angle) * 9 + Math.cos(angle) * side * 4) / scale,
      1.25 / scale,
    );
    ctx.fill();
  }
  ctx.restore();
}

function drawLauncher(
  ctx: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  camera: Camera,
  width: number,
  height: number,
  sling?: SlingshotVisual | null,
) {
  const scale = camera.scale;
  const p = snapshot.sector.launch;
  ctx.save();
  ctx.strokeStyle = "rgba(48,57,67,.24)";
  ctx.lineWidth = 1 / scale;
  ctx.setLineDash([1 / scale, 4 / scale]);
  circle(ctx, p.x, p.y, 22 / scale);
  ctx.stroke();
  ctx.setLineDash([]);
  if (snapshot.status === "aiming") {
    if (sling) {
      const ghost = visiblePullPoint(p, sling.pull, camera, width, height);
      ctx.strokeStyle = "rgba(48,57,67,.58)";
      ctx.lineWidth = 1 / scale;
      line(ctx, p.x, p.y, ghost.x, ghost.y);
      ctx.fillStyle = COLOR.charcoal;
      circle(ctx, p.x, p.y, 2 / scale);
      ctx.fill();
      if (snapshot.shotCount === 3) {
        for (const side of [-1, 1]) {
          circle(
            ctx,
            p.x - (Math.sin(snapshot.aim.angle) * side * 5) / scale,
            p.y + (Math.cos(snapshot.aim.angle) * side * 5) / scale,
            1.25 / scale,
          );
          ctx.fill();
        }
      }
      drawShooter(ctx, ghost, snapshot.aim.angle, scale, snapshot.shotCount);
      ctx.strokeStyle = COLOR.blue;
      ctx.lineWidth = 1.6 / scale;
      ctx.beginPath();
      ctx.arc(
        p.x,
        p.y,
        22 / scale,
        -Math.PI / 2,
        -Math.PI / 2 + TAU * Math.min(1, Math.max(0, sling.power)),
      );
      ctx.stroke();
      const a = snapshot.aim.angle;
      ctx.lineWidth = 1 / scale;
      line(
        ctx,
        p.x + (Math.cos(a) * 9) / scale,
        p.y + (Math.sin(a) * 9) / scale,
        p.x + (Math.cos(a) * 30) / scale,
        p.y + (Math.sin(a) * 30) / scale,
      );
    } else drawShooter(ctx, p, snapshot.aim.angle, scale, snapshot.shotCount);
  } else {
    ctx.fillStyle = COLOR.slate;
    circle(ctx, p.x, p.y, 2 / scale);
    ctx.fill();
  }
  ctx.restore();
}

function drawPreview(
  ctx: CanvasRenderingContext2D,
  paths: Vec2[][],
  scale: number,
) {
  const path = paths[0];
  if (!path) return;
  ctx.save();
  ctx.fillStyle = COLOR.aim;
  ctx.strokeStyle = "#f8f9fa";
  ctx.lineWidth = 1.6 / scale;
  const length = Math.min(path.length, 49);
  for (let n = 3; n < length; n += 3) {
    const fade = 1 - n / length;
    ctx.globalAlpha = 0.98 * fade * fade;
    circle(ctx, path[n].x, path[n].y, 2.1 / scale);
    ctx.stroke();
    ctx.fill();
  }
  ctx.restore();
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  scale: number,
) {
  for (const particle of snapshot.particles) {
    ctx.save();
    ctx.strokeStyle = COLOR.blue;
    ctx.lineCap = "round";
    const trail = particle.trail;
    for (let n = 1; n < trail.length; n++) {
      const f = n / trail.length;
      ctx.globalAlpha = f * f * (particle.alive ? 0.35 : 0.1);
      ctx.lineWidth = Math.max(1.5, 1.2 / scale);
      line(ctx, trail[n - 1].x, trail[n - 1].y, trail[n].x, trail[n].y);
    }
    ctx.globalAlpha = 1;
    if (particle.alive) {
      drawShip(
        ctx,
        particle.position,
        Math.atan2(particle.velocity.y, particle.velocity.x),
        scale,
      );
    }
    ctx.restore();
  }
}

function drawCheckpointEdge(
  ctx: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  camera: Camera,
  width: number,
  height: number,
) {
  const point = worldToClient(
    snapshot.sector.checkpoint.position,
    { left: 0, top: 0, width, height },
    camera,
  );
  const captureExtent = snapshot.sector.checkpoint.radius * camera.scale + 1.4;
  if (point.x + captureExtent >= 0 && point.x - captureExtent <= width) return;
  const direction = point.x < 0 ? -1 : 1,
    x = direction < 0 ? 20 : width - 20,
    y = Math.min(height - 60, Math.max(60, point.y));
  ctx.save();
  ctx.fillStyle = COLOR.ground;
  circle(ctx, x, y, 10);
  ctx.fill();
  ctx.strokeStyle = COLOR.checkpoint;
  ctx.lineWidth = 1.3;
  circle(ctx, x, y, 6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + direction * 8, y - 3);
  ctx.lineTo(x + direction * 11, y);
  ctx.lineTo(x + direction * 8, y + 3);
  ctx.stroke();
  ctx.fillStyle = COLOR.checkpoint;
  circle(ctx, x, y, 1);
  ctx.fill();
  ctx.restore();
}

export function createRenderer(canvas: HTMLCanvasElement): OrbitRenderer {
  const surfaceScratch: SurfaceScratch = {
    points: new Float32Array(73 * 73 * 4),
    wave: { crest: 0, slope: 0 },
  };
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas2D is unavailable.");
  const ctx = context;
  let width = 1,
    height = 1,
    dpr = 1,
    destroyed = false,
    sectorKey = "",
    lastTime = 0,
    lastEvent = -1;
  let lastPreparedTime = NaN,
    lastRenderedTime = NaN,
    frameDt = 0,
    lastCameraEvent = -1;
  let motionTime = 0,
    motionWasActive = false;
  let camera = fitCamera({ x: 0, y: 0, width: 1800, height: 1000 }, 1, 1),
    fromCamera = camera,
    targetCamera = camera,
    progress = 1;
  let currentSector: Sector | null = null,
    previousSector: Sector | null = null;
  let lastSnapshot: GameSnapshot | null = null;
  const effects: Effect[] = Array.from({ length: 48 }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    age: 0,
    life: 0,
    color: "",
  }));
  function burst(point: Vec2, color: string, count: number) {
    let placed = 0;
    for (const effect of effects) {
      if (effect.active) continue;
      const a = placed * 2.39996,
        velocity = (12 + (placed % 4) * 6) / camera.scale;
      Object.assign(effect, {
        active: true,
        x: point.x,
        y: point.y,
        vx: Math.cos(a) * velocity,
        vy: Math.sin(a) * velocity,
        age: 0,
        life: 0.38 + (placed % 3) * 0.08,
        color,
      });
      if (++placed >= count) break;
    }
  }
  function snap() {
    if (!currentSector) return;
    const lead =
      lastSnapshot?.status === "flying"
        ? lastSnapshot.particles.find((p) => p.alive)
        : undefined;
    camera = fitFieldCamera(
      fieldBounds(currentSector),
      currentSector.launch,
      width,
      height,
      lead?.position.x,
      currentSector.checkpoint,
    );
    fromCamera = camera;
    targetCamera = camera;
    progress = 1;
    previousSector = null;
  }
  function prepareFrame(
    snapshot: GameSnapshot,
    timeSeconds: number,
    options: RenderOptions = {},
  ) {
    if (destroyed) return;
    const time = Number.isFinite(timeSeconds) ? timeSeconds : lastTime;
    const fresh = time !== lastPreparedTime;
    const dt =
      fresh && Number.isFinite(lastPreparedTime)
        ? Math.min(0.05, Math.max(0, time - lastPreparedTime))
        : 0;
    if (fresh) {
      frameDt = dt;
      lastPreparedTime = time;
      lastTime = time;
    }
    const reduced = options.reducedMotion ?? false;
    const key = `${snapshot.sector.seed}:${snapshot.sector.index}`;
    const previousStatus = lastSnapshot?.status;
    lastSnapshot = snapshot;
    const restarted =
      snapshot.event?.kind === "restart" &&
      snapshot.event.id !== lastCameraEvent;
    if (snapshot.event) lastCameraEvent = snapshot.event.id;
    if (key !== sectorKey || restarted) {
      const first = currentSector === null,
        reset = snapshot.event?.kind === "restart";
      previousSector = !first && !reset ? currentSector : null;
      currentSector = snapshot.sector;
      sectorKey = key;
      targetCamera = fitFieldCamera(
        fieldBounds(snapshot.sector),
        snapshot.sector.launch,
        width,
        height,
        undefined,
        snapshot.sector.checkpoint,
      );
      fromCamera = camera;
      progress = first || reset || reduced ? 1 : 0;
      if (progress === 1) {
        camera = targetCamera;
        previousSector = null;
      }
      if (reset) for (const effect of effects) effect.active = false;
    } else {
      currentSector = snapshot.sector;
      if (
        width < height &&
        snapshot.status === "aiming" &&
        (previousStatus === "failed" || previousStatus === "flying")
      ) {
        fromCamera = camera;
        targetCamera = fitFieldCamera(
          fieldBounds(snapshot.sector),
          snapshot.sector.launch,
          width,
          height,
          undefined,
          snapshot.sector.checkpoint,
        );
        progress =
          reduced || Math.abs(camera.center.x - targetCamera.center.x) < 0.5
            ? 1
            : 0;
        if (progress === 1) camera = targetCamera;
      }
    }
    if (reduced && progress < 1) snap();
    if (
      progress < 1 &&
      !options.paused &&
      !options.cameraLocked &&
      !options.slingshot
    ) {
      progress = Math.min(1, progress + dt / 0.65);
      camera = interpolateCamera(fromCamera, targetCamera, progress);
      if (progress === 1) previousSector = null;
    }
    if (
      fresh &&
      width < height &&
      progress === 1 &&
      snapshot.status === "flying" &&
      !options.paused &&
      !options.cameraLocked &&
      !options.slingshot
    ) {
      const lead = snapshot.particles.find((p) => p.alive);
      if (lead) {
        const desired = fitFieldCamera(
          fieldBounds(snapshot.sector),
          snapshot.sector.launch,
          width,
          height,
          lead.position.x,
          snapshot.sector.checkpoint,
        );
        const blend = reduced ? 1 : 1 - Math.exp(-dt * 4);
        camera = {
          center: {
            x: camera.center.x + (desired.center.x - camera.center.x) * blend,
            y: desired.center.y,
          },
          scale: desired.scale,
        };
      }
    }
  }
  function visibleBounds() {
    const rect = canvas.getBoundingClientRect();
    return visibleWorldBounds(
      camera,
      rect.width || width,
      rect.height || height,
    );
  }
  return {
    prepareFrame,
    getVisibleBounds: visibleBounds,
    resize(nextWidth, nextHeight, nextDpr = window.devicePixelRatio || 1) {
      if (destroyed) return;
      width = Number.isFinite(nextWidth) ? Math.max(1, nextWidth) : 1;
      height = Number.isFinite(nextHeight) ? Math.max(1, nextHeight) : 1;
      dpr = Number.isFinite(nextDpr) ? Math.min(2, Math.max(1, nextDpr)) : 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      snap();
    },
    render(snapshot, preview, timeSeconds, options = {}) {
      if (destroyed) return;
      prepareFrame(snapshot, timeSeconds, options);
      const time = Number.isFinite(timeSeconds) ? timeSeconds : lastTime;
      const renderGap = time - lastRenderedTime;
      const dt = time !== lastRenderedTime ? frameDt : 0;
      lastRenderedTime = time;
      const reduced = options.reducedMotion ?? false;
      const motionActive = !options.paused && !reduced;
      // Hidden tabs may suspend RAF entirely. Never catch up that dormant gap.
      if (motionActive && motionWasActive && renderGap <= 0.1) motionTime += dt;
      motionWasActive = motionActive;
      if (snapshot.event && snapshot.event.id !== lastEvent) {
        if (!reduced) {
          if (snapshot.event.kind === "dock")
            burst(
              snapshot.status === "docked"
                ? snapshot.sector.checkpoint.position
                : snapshot.sector.launch,
              COLOR.checkpoint,
              14,
            );
          if (snapshot.event.kind === "fail") {
            const end = snapshot.particles[0]?.position;
            if (end) burst(end, COLOR.rust, 10);
          }
          if (snapshot.event.kind === "launch")
            burst(snapshot.sector.launch, COLOR.charcoal, 5);
        }
        lastEvent = snapshot.event.id;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = COLOR.ground;
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(camera.scale, camera.scale);
      ctx.translate(-camera.center.x, -camera.center.y);
      if (previousSector)
        drawGravityFields(
          ctx,
          previousSector,
          camera.scale,
          1 - progress,
          motionTime,
          reduced,
          false,
          surfaceScratch,
        );
      drawGravityFields(
        ctx,
        snapshot.sector,
        camera.scale,
        1,
        motionTime,
        reduced,
        true,
        surfaceScratch,
      );
      if (snapshot.status === "aiming" && options.slingshot)
        drawPreview(ctx, preview, camera.scale);
      if (previousSector)
        drawGeometry(ctx, previousSector, camera.scale, 1 - progress);
      drawGeometry(ctx, snapshot.sector, camera.scale);
      drawDock(ctx, snapshot, camera.scale);
      drawLauncher(ctx, snapshot, camera, width, height, options.slingshot);
      drawParticles(ctx, snapshot, camera.scale);
      for (const effect of effects) {
        if (!effect.active) continue;
        if (reduced) {
          effect.active = false;
          continue;
        }
        if (!options.paused) effect.age += dt;
        if (effect.age >= effect.life) {
          effect.active = false;
          continue;
        }
        const fade = 1 - effect.age / effect.life;
        ctx.fillStyle = effect.color;
        ctx.globalAlpha = fade * 0.55;
        circle(
          ctx,
          effect.x + effect.vx * effect.age,
          effect.y + effect.vy * effect.age,
          Math.max(0.8, 1.1 * fade) / camera.scale,
        );
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      if (width < height)
        drawCheckpointEdge(ctx, snapshot, camera, width, height);
    },
    screenToWorld(clientX, clientY) {
      return clientToWorld(
        clientX,
        clientY,
        canvas.getBoundingClientRect(),
        camera,
      );
    },
    worldToScreen(point) {
      return worldToClient(point, canvas.getBoundingClientRect(), camera);
    },
    getViewport() {
      return {
        center: { ...camera.center },
        scale: camera.scale,
        transitioning: progress < 1,
        bounds: visibleBounds(),
      };
    },
    destroy() {
      destroyed = true;
      currentSector = null;
      previousSector = null;
      lastSnapshot = null;
      for (const effect of effects) effect.active = false;
    },
  };
}
