import { clampGameplayZoom, MIN_GRAVITY_ZOOM, zoomCamera } from "../zoom";
import { createGravitySurface } from "../render/gravity-surface";
import { FORCE_PALETTE } from "../render/force-palette";
import { drawBody, drawGravitySurface } from "../render/renderer";
import { orbitFraction } from "./simulation";
import type { GravitySnapshot, TrailPoint, GravityLevel } from "./types";
import {
  contentBounds,
  fitPlayableCamera,
  type Camera,
  walkthroughCamera,
  type WalkthroughFocus,
  worldToClient,
  clientToWorld,
} from "../render/coordinates";
import type { Vec2 } from "../game/types";
import { usesTouchLayout } from "../controls";
import type { PathAssist } from "../pathAssist";
import { sampleGravityAimPreview } from "./aim-preview";
import { gravityLaunchIsClear } from "./input";
interface DrawOptions {
  pathAssist?: PathAssist;
  paused: boolean;
  reducedMotion: boolean;
  pull?: Vec2 | null;
  attention?: boolean;
  ghostCue?: { position: Vec2; pull: Vec2 };
}
const TAU = Math.PI * 2;
export function fitGravityFrame(
  level: GravityLevel,
  width: number,
  height: number,
  touchLayout = usesTouchLayout(width, height),
) {
  const landscape = touchLayout && width >= height && height <= 500;
  const left = landscape ? Math.min(190, width * 0.25) : touchLayout ? 16 : 32;
  const right = touchLayout ? 16 : 80;
  const top = landscape ? 18 : touchLayout ? 128 : 136;
  const bottom = landscape ? 18 : touchLayout ? 104 : 128;
  const area = {
    x: left,
    y: top,
    width: Math.max(1, width - left - right),
    height: Math.max(1, height - top - bottom),
  };
  const orbitRadius = (body: GravityLevel["bodies"][number]) =>
    body.radius + (body.kind === "attractor" ? 84 : 48);
  const envelopes = level.bodies.map((body) => {
    const motion = level.motions?.find((path) => path.bodyId === body.id);
    const travel = motion
      ? motion.kind === "circle"
        ? Math.abs(motion.radius ?? 0)
        : Math.hypot(motion.amplitude?.x ?? 0, motion.amplitude?.y ?? 0)
      : 0;
    return {
      position: motion?.center ?? body.position,
      radius: orbitRadius(body) + travel,
    };
  });
  const bounds = envelopes.length
    ? contentBounds([{ position: level.launch, radius: 0 }, ...envelopes])
    : level.bounds;
  const camera = fitPlayableCamera(
    bounds,
    level.launch,
    area.width,
    area.height,
    touchLayout ? 90 : 36,
    touchLayout ? 18 : 24,
  );
  return { camera, area };
}
function trailOpacity(
  point: TrailPoint,
  elapsed: number,
  seconds: number,
  progress: number,
): number {
  return (
    0.52 *
    progress *
    Math.pow(Math.max(0, 1 - (elapsed - point.time) / seconds), 1.6)
  );
}
function rgba(color: string, alpha: number): string {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
  if (!match) {
    // The engine extends its finite hex palette with modern HSL colors in busy skies.
    const hsl = /^hsl\(([-+\d.]+)\s+([\d.]+)%\s+([\d.]+)%\)$/i.exec(color);
    if (hsl) {
      const lightness = Number(hsl[3]) + (93 - Number(hsl[3])) * 0.28;
      return `hsl(${hsl[1]} ${Number(hsl[2]) * 0.8}% ${lightness}% / ${alpha})`;
    }
    return `rgba(82, 124, 154, ${alpha})`;
  }
  const ground = [233, 236, 239];
  const channels = match.slice(1).map((channel, index) => {
    const value = parseInt(channel, 16);
    return Math.round(value + (ground[index] - value) * 0.28);
  });
  return `rgba(${channels.join(", ")}, ${alpha})`;
}
function drawTrail(
  ctx: CanvasRenderingContext2D,
  points: TrailPoint[],
  elapsed: number,
  width: number,
  color: string,
  seconds: number,
  dense = false,
) {
  if (points.length < 2) return;
  if (dense || points.length > 160) {
    // Long, busy skies use eight continuous opacity bands instead of a gradient per segment.
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const size = Math.max(1, Math.ceil((points.length - 1) / 8));
    for (let start = 0; start < points.length - 1; start += size) {
      const end = Math.min(points.length - 1, start + size),
        middle = points[Math.floor((start + end) / 2)];
      const alpha = trailOpacity(
        middle,
        elapsed,
        seconds,
        Math.floor((start + end) / 2) / (points.length - 1),
      );
      if (alpha <= 0) continue;
      ctx.strokeStyle = rgba(color, alpha);
      ctx.beginPath();
      ctx.moveTo(points[start].x, points[start].y);
      for (let index = start + 1; index <= end; index++)
        ctx.lineTo(points[index].x, points[index].y);
      ctx.stroke();
    }
    return;
  }
  const halfWidth = width / 2;
  const edges = points.map((point, index) => {
    const previous = points[Math.max(0, index - 1)],
      next = points[Math.min(points.length - 1, index + 1)];
    let ax = point.x - previous.x,
      ay = point.y - previous.y,
      bx = next.x - point.x,
      by = next.y - point.y;
    if (index === 0) {
      ax = bx;
      ay = by;
    }
    if (index === points.length - 1) {
      bx = ax;
      by = ay;
    }
    const al = Math.hypot(ax, ay),
      bl = Math.hypot(bx, by);
    if (al < 1e-6 && bl < 1e-6) return null;
    if (al < 1e-6) {
      ax = bx;
      ay = by;
    } else {
      ax /= al;
      ay /= al;
    }
    if (bl < 1e-6) {
      bx = ax;
      by = ay;
    } else {
      bx /= bl;
      by /= bl;
    }
    const n1 = { x: -ay, y: ax },
      n2 = { x: -by, y: bx },
      mx = n1.x + n2.x,
      my = n1.y + n2.y,
      ml = Math.hypot(mx, my);
    if (ml < 1e-6) return { left: n2, right: { x: -n2.x, y: -n2.y } };
    const ux = mx / ml,
      uy = my / ml,
      denominator = ux * n2.x + uy * n2.y,
      length = Math.min(
        halfWidth * 4,
        halfWidth / Math.max(0.25, Math.abs(denominator)),
      );
    const offset = { x: ux * length, y: uy * length };
    return { left: offset, right: { x: -offset.x, y: -offset.y } };
  });
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1],
      to = points[index],
      fromEdge = edges[index - 1],
      toEdge = edges[index];
    if (!fromEdge || !toEdge || Math.hypot(to.x - from.x, to.y - from.y) < 1e-6)
      continue;
    const startAlpha = trailOpacity(
        from,
        elapsed,
        seconds,
        (index - 1) / (points.length - 1),
      ),
      endAlpha = trailOpacity(
        to,
        elapsed,
        seconds,
        index / (points.length - 1),
      );
    if (startAlpha <= 0 && endAlpha <= 0) continue;
    ctx.beginPath();
    ctx.moveTo(from.x + fromEdge.left.x, from.y + fromEdge.left.y);
    ctx.lineTo(to.x + toEdge.left.x, to.y + toEdge.left.y);
    ctx.lineTo(to.x + toEdge.right.x, to.y + toEdge.right.y);
    ctx.lineTo(from.x + fromEdge.right.x, from.y + fromEdge.right.y);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
    gradient.addColorStop(0, rgba(color, startAlpha));
    gradient.addColorStop(1, rgba(color, endAlpha));
    ctx.fillStyle = gradient;
    ctx.fill();
  }
}
export function createGravityRenderer(
  canvas: HTMLCanvasElement,
  options: { compact?: boolean } = {},
) {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas2D is unavailable.");
  const ctx = context;
  let width = 1,
    height = 1,
    scale = 1,
    dpr = 1,
    motion = 0,
    lastTime: number | null = null,
    destroyed = false;
  let camera: Camera = { center: { x: 450, y: 450 }, scale: 1 };
  let area = { x: 0, y: 0, width: 1, height: 1 };
  let lastLevel: GravityLevel | null = null;
  let levelKey = "";
  let gameplayZoom = 1;
  let walkthroughFocus: WalkthroughFocus | null = null;
  const displayCamera = () =>
    walkthroughFocus
      ? walkthroughCamera(camera, walkthroughFocus, width, height)
      : zoomCamera(camera, gameplayZoom, MIN_GRAVITY_ZOOM);
  function frame(level: GravityLevel) {
    if (options.compact) {
      area = {
        x: 12,
        y: 12,
        width: Math.max(1, width - 24),
        height: Math.max(1, height - 24),
      };
      const bounds = contentBounds([
        { position: level.launch, radius: 70 },
        ...level.bodies.map((body) => ({
          position: body.position,
          radius: body.radius + 120,
        })),
      ]);
      camera = fitPlayableCamera(
        bounds,
        level.launch,
        area.width,
        area.height,
        30,
        12,
      );
    } else ({ camera, area } = fitGravityFrame(level, width, height));
    scale = camera.scale;
    lastLevel = level;
  }
  function prepareFrame(level: GravityLevel) {
    const key = `${level.seed}:${level.index}`;
    if (!lastLevel || key !== levelKey) {
      frame(level);
      levelKey = key;
    }
  }
  const scratch = createGravitySurface(ctx);
  function circle(p: Vec2, r: number) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0, r), 0, TAU);
  }
  function planet(p: Vec2, radius: number, color: string) {
    ctx.fillStyle = color;
    circle(p, radius);
    ctx.fill();
  }
  return {
    prepareFrame,
    setZoom(value: number) {
      gameplayZoom = clampGameplayZoom(value, MIN_GRAVITY_ZOOM);
      return gameplayZoom;
    },
    getZoom() {
      return gameplayZoom;
    },
    screenToWorld(x: number, y: number) {
      const rect = canvas.getBoundingClientRect();
      const viewport = walkthroughFocus ? { x: 0, y: 0, width, height } : area;
      return clientToWorld(
        x,
        y,
        {
          left: rect.left + viewport.x,
          top: rect.top + viewport.y,
          width: viewport.width,
          height: viewport.height,
        },
        displayCamera(),
      );
    },
    getVisibleBounds() {
      const displayed = displayCamera(),
        centerX = walkthroughFocus ? width / 2 : area.x + area.width / 2,
        centerY = walkthroughFocus ? height / 2 : area.y + area.height / 2;
      return {
        x: displayed.center.x - centerX / displayed.scale,
        y: displayed.center.y - centerY / displayed.scale,
        width: width / displayed.scale,
        height: height / displayed.scale,
      };
    },
    getFlightBounds() {
      const outerScale = camera.scale * MIN_GRAVITY_ZOOM;
      return {
        x: camera.center.x - (area.x + area.width / 2) / outerScale,
        y: camera.center.y - (area.y + area.height / 2) / outerScale,
        width: width / outerScale,
        height: height / outerScale,
      };
    },
    resize(w: number, h: number, pixelRatio = 1) {
      width = Math.max(1, w);
      height = Math.max(1, h);
      dpr = Math.min(2, Math.max(1, pixelRatio));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      if (lastLevel) frame(lastLevel);
    },
    getDefaultScale() {
      return camera.scale;
    },
    getScale() {
      return displayCamera().scale;
    },
    setWalkthroughFocus(focus: WalkthroughFocus | null) {
      walkthroughFocus = focus;
    },
    worldToScreen(point: Vec2) {
      const rect = canvas.getBoundingClientRect();
      const frame = walkthroughFocus ? { x: 0, y: 0, width, height } : area;
      return worldToClient(
        point,
        {
          left: rect.left + frame.x,
          top: rect.top + frame.y,
          width: frame.width,
          height: frame.height,
        },
        displayCamera(),
      );
    },
    render(
      snapshot: GravitySnapshot,
      preview: Vec2[],
      time: number,
      options: DrawOptions,
    ) {
      if (destroyed) return;
      prepareFrame(snapshot.level);
      if (lastTime !== null && !options.paused && !options.reducedMotion)
        motion += Math.min(0.05, Math.max(0, time - lastTime));
      lastTime = time;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#e9ecef";
      ctx.fillRect(0, 0, width, height);
      const renderCamera = displayCamera();
      const renderScale = renderCamera.scale;
      const centerX = walkthroughFocus ? width / 2 : area.x + area.width / 2;
      const centerY = walkthroughFocus ? height / 2 : area.y + area.height / 2;
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(renderScale, renderScale);
      ctx.translate(-renderCamera.center.x, -renderCamera.center.y);
      for (const body of snapshot.level.bodies)
        drawGravitySurface(
          ctx,
          body.position,
          body.radius,
          body.kind === "repellent",
          renderScale,
          motion,
          options.reducedMotion,
          FORCE_PALETTE[body.kind].wave,
          scratch,
        );
      for (const particle of snapshot.particles)
        drawTrail(
          ctx,
          particle.trail,
          snapshot.elapsed,
          2.4 / renderScale,
          particle.color,
          snapshot.physics.trailSeconds,
          snapshot.particles.length > 12,
        );
      // Opaque surfaces use the physical world radius at every camera scale.
      const visiblePlanets = snapshot.particles
        .filter((particle) => particle.alive)
        .map((particle) => ({
          particle,
          radius: particle.radius,
        }))
        .sort((a, b) => b.radius - a.radius || a.particle.id - b.particle.id);
      ctx.globalAlpha = 1;
      for (const { particle, radius } of visiblePlanets) {
        planet(particle.position, radius, particle.color);
      }
      const showBodyLabels =
        snapshot.level.bodies.filter((b) => b.kind === "attractor").length > 1;
      snapshot.level.bodies.forEach((body, index) => {
        const insideLabel = body.radius * renderScale >= 16;
        drawBody(
          ctx,
          body,
          renderScale,
          showBodyLabels && insideLabel ? 7 / renderScale : 0,
        );
        if (options.attention) {
          ctx.globalAlpha = options.reducedMotion
            ? 0.6
            : 0.35 + 0.25 * Math.sin(motion * 2.5);
          ctx.strokeStyle = FORCE_PALETTE[body.kind].body;
          ctx.lineWidth = 2 / renderScale;
          circle(body.position, body.radius + 16 / renderScale);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        if (body.kind === "repellent") return;
        const best = Math.max(
          0,
          ...snapshot.particles
            .filter((p) => p.alive)
            .map((p) => orbitFraction(snapshot, p, body.id)),
        );
        ctx.strokeStyle = "#527c9a";
        ctx.globalAlpha = 0.22;
        ctx.lineWidth = 1 / renderScale;
        circle(body.position, body.radius + 8 / renderScale);
        ctx.stroke();
        if (best > 0) {
          ctx.globalAlpha = 0.8;
          ctx.lineWidth = 2 / renderScale;
          ctx.beginPath();
          ctx.arc(
            body.position.x,
            body.position.y,
            body.radius + 8 / renderScale,
            -Math.PI / 2,
            -Math.PI / 2 + best * TAU,
          );
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        const goal = snapshot.progress.bodies?.find(
          (item) => item.bodyId === body.id,
        );
        if (goal) {
          ctx.fillStyle = "#455c70";
          ctx.font = `600 ${11 / renderScale}px "Avenir Next",sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(
            `${goal.current}/${goal.target}`,
            body.position.x,
            body.position.y + body.radius + 16 / renderScale,
          );
        }
        if (showBodyLabels) {
          ctx.fillStyle = insideLabel ? "#e9ecef" : "#455c70";
          ctx.font = `700 ${11 / renderScale}px "Avenir Next",sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "alphabetic";
          const label = String.fromCharCode(65 + index);
          const metrics = ctx.measureText(label);
          const ascent = metrics?.actualBoundingBoxAscent ?? 8 / renderScale;
          const descent = metrics?.actualBoundingBoxDescent ?? 0;
          ctx.fillText(
            label,
            body.position.x,
            insideLabel
              ? body.position.y + (ascent - descent) / 2
              : body.position.y - body.radius - 12 / renderScale,
          );
        }
      });
      if (snapshot.level.objective.kind === "tour") {
        const bodies = snapshot.level.bodies.filter(
          (b) => b.kind === "attractor",
        );
        const center = {
          x: (bodies[0].position.x + bodies[1].position.x) / 2,
          y: (bodies[0].position.y + bodies[1].position.y) / 2,
        };
        const best = Math.max(
          0,
          ...snapshot.particles
            .filter((p) => p.alive)
            .map((p) => orbitFraction(snapshot, p, "pair")),
        );
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = "#527c9a";
        ctx.lineWidth = 1.5 / renderScale;
        ctx.setLineDash([2 / renderScale, 5 / renderScale]);
        circle(
          center,
          Math.hypot(
            bodies[0].position.x - center.x,
            bodies[0].position.y - center.y,
          ) +
            bodies[0].radius +
            20 / renderScale,
        );
        ctx.stroke();
        ctx.setLineDash([]);
        if (best > 0) {
          ctx.beginPath();
          ctx.arc(
            center.x,
            center.y,
            110,
            -Math.PI / 2,
            -Math.PI / 2 + best * TAU,
          );
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      // A planet exists at the chosen position only while aiming. The field has no fixed launcher.
      const anchor = snapshot.launchPosition;
      const blockedLaunch =
        !!options.pull && !gravityLaunchIsClear(anchor, snapshot);
      if (options.pull) {
        planet(
          anchor,
          snapshot.physics.planetRadius,
          blockedLaunch ? "#c9675e" : "#7a60d6",
        );
        const ghost = {
          x: anchor.x + options.pull.x / renderScale,
          y: anchor.y + options.pull.y / renderScale,
        };
        ctx.strokeStyle = "#697783";
        ctx.globalAlpha = 0.65;
        ctx.lineWidth = 1 / renderScale;
        ctx.beginPath();
        ctx.moveTo(anchor.x, anchor.y);
        ctx.lineTo(ghost.x, ghost.y);
        ctx.stroke();
        circle(ghost, 5 / renderScale);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = blockedLaunch ? "#c9675e" : "#7a60d6";
        ctx.lineWidth = 2 / renderScale;
        ctx.beginPath();
        ctx.arc(
          anchor.x,
          anchor.y,
          13 / renderScale,
          -Math.PI / 2,
          -Math.PI / 2 + snapshot.aim.power * TAU,
        );
        ctx.stroke();
        if (blockedLaunch) {
          ctx.fillStyle = "#a34f48";
          ctx.font = `${12 / renderScale}px "Avenir Next",sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.strokeStyle = "#e9ecef";
          ctx.lineWidth = 4 / renderScale;
          ctx.lineJoin = "round";
          ctx.strokeText(
            "Start in clear space",
            anchor.x,
            anchor.y - 19 / renderScale,
          );
          ctx.fillText(
            "Start in clear space",
            anchor.x,
            anchor.y - 19 / renderScale,
          );
        }
      }
      ctx.fillStyle = "#7956cf";
      const aimPreview = sampleGravityAimPreview(
        blockedLaunch ? [] : preview,
        renderScale,
        options.pathAssist,
      );
      for (const dot of aimPreview.dots) {
        const fade = 1 - dot.distance / aimPreview.length;
        ctx.globalAlpha = fade * fade * 0.98;
        circle(dot, 2.3 / renderScale);
        ctx.fill();
      }
      if (options.ghostCue) {
        const cue = options.ghostCue,
          fraction = options.reducedMotion
            ? 1
            : (1 - Math.cos(((motion % 2.8) / 2.8) * TAU)) / 2;
        const handle = {
          x:
            cue.position.x +
            (cue.pull.x / renderScale) * (0.3 + 0.7 * fraction),
          y:
            cue.position.y +
            (cue.pull.y / renderScale) * (0.3 + 0.7 * fraction),
        };
        ctx.globalAlpha = 0.65;
        ctx.strokeStyle = "#7956cf";
        ctx.lineWidth = 1.5 / renderScale;
        ctx.setLineDash([3 / renderScale, 5 / renderScale]);
        ctx.beginPath();
        ctx.moveTo(cue.position.x, cue.position.y);
        ctx.lineTo(handle.x, handle.y);
        ctx.stroke();
        ctx.setLineDash([]);
        circle(cue.position, snapshot.physics.planetRadius);
        ctx.stroke();
        circle(handle, 10 / renderScale);
        ctx.stroke();
        ctx.fillStyle = "#697783";
        ctx.font = `${11 / renderScale}px "Avenir Next",sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(
          "Pull back, then release",
          cue.position.x - 28 / renderScale,
          cue.position.y + 22 / renderScale,
        );
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    },
    destroy() {
      scratch.destroy();
      destroyed = true;
    },
  };
}
