import { canvasColors, visibleParticleColor } from "../theme";
import {
  clampGameplayZoom,
  MIN_GRAVITY_ZOOM,
  zoomCamera,
  type ZoomFocus,
} from "../zoom";
import { createGravitySurface } from "../render/gravity-surface";
import { FORCE_PALETTE } from "../render/force-palette";
import { drawGravitySurface } from "../render/renderer";
import { drawGravityCore } from "./core-label";
import { nextProjectileColor, orbitFraction } from "./simulation";
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
  const top = landscape
    ? 18
    : level.orbitPadding !== undefined
      ? level.journey
        ? 180
        : touchLayout
          ? 150
          : 156
      : touchLayout
        ? 128
        : 136;
  const bottom = landscape ? 18 : touchLayout ? 104 : 128;
  const area = {
    x: left,
    y: top,
    width: Math.max(1, width - left - right),
    height: Math.max(1, height - top - bottom),
  };
  const orbitRadius = (body: GravityLevel["bodies"][number]) =>
    body.radius + (body.kind === "attractor" ? (level.orbitPadding ?? 84) : 48);
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
  const ground = [1, 3, 5].map((index) =>
    parseInt(canvasColors().ground.slice(index, index + 2), 16),
  );
  const channels = match.slice(1).map((channel, index) => {
    const value = parseInt(channel, 16);
    return Math.round(value + (ground[index] - value) * 0.28);
  });
  return `rgba(${channels.join(", ")}, ${alpha})`;
}
function drawTrail(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  points: TrailPoint[],
  elapsed: number,
  width: number,
  color: string,
  seconds: number,
  dense = false,
) {
  if (points.length < 2) return;
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
  // Preserve every curve sample while bounding gradients in long, busy skies.
  const stride = Math.max(
    1,
    Math.ceil((points.length - 1) / (dense ? 32 : 96)),
  );
  for (let start = 0; start < points.length - 1; start += stride) {
    const index = Math.min(points.length - 1, start + stride);
    const from = points[start],
      to = points[index];
    const fromEdge = edges[start],
      toEdge = edges[index];
    if (!fromEdge || !toEdge) continue;
    const startAlpha = trailOpacity(
        from,
        elapsed,
        seconds,
        start / (points.length - 1),
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
    for (let i = start + 1; i <= index; i++) {
      const edge = edges[i];
      if (edge)
        ctx.lineTo(points[i].x + edge.left.x, points[i].y + edge.left.y);
    }
    for (let i = index; i >= start; i--) {
      const edge = edges[i];
      if (edge)
        ctx.lineTo(points[i].x + edge.right.x, points[i].y + edge.right.y);
    }
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
  const trailCanvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(1, 1)
      : canvas.ownerDocument.createElement("canvas");
  const trailContext = trailCanvas.getContext("2d") as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
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
  let viewOffset = { x: 0, y: 0 };
  let walkthroughFocus: WalkthroughFocus | null = null;
  const displayCamera = () => {
    if (walkthroughFocus)
      return walkthroughCamera(camera, walkthroughFocus, width, height);
    const displayed = zoomCamera(camera, gameplayZoom, MIN_GRAVITY_ZOOM);
    displayed.center.x += viewOffset.x;
    displayed.center.y += viewOffset.y;
    return displayed;
  };
  const clientPoint = (point: Vec2) => {
    const rect = canvas.getBoundingClientRect();
    const viewport = walkthroughFocus ? { x: 0, y: 0, width, height } : area;
    return clientToWorld(
      point.x,
      point.y,
      {
        left: rect.left + viewport.x,
        top: rect.top + viewport.y,
        width: viewport.width,
        height: viewport.height,
      },
      displayCamera(),
    );
  };
  function frame(level: GravityLevel) {
    viewOffset = { x: 0, y: 0 };
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
    setZoom(value: number, focus?: ZoomFocus) {
      const selected =
        focus && !walkthroughFocus ? clientPoint(focus.from) : undefined;
      gameplayZoom = clampGameplayZoom(value, MIN_GRAVITY_ZOOM);
      if (
        focus &&
        selected &&
        Number.isFinite(selected.x) &&
        Number.isFinite(selected.y)
      ) {
        const after = clientPoint(focus.to);
        if (Number.isFinite(after.x) && Number.isFinite(after.y)) {
          viewOffset.x += selected.x - after.x;
          viewOffset.y += selected.y - after.y;
        }
      }
      return gameplayZoom;
    },
    getZoom() {
      return gameplayZoom;
    },
    panBy(x: number, y: number) {
      if (walkthroughFocus || !Number.isFinite(x) || !Number.isFinite(y))
        return;
      const current = displayCamera();
      viewOffset.x -= x / current.scale;
      viewOffset.y -= y / current.scale;
    },
    resetPan(fraction = 1) {
      const remaining = 1 - Math.max(0, Math.min(1, fraction));
      viewOffset = { x: viewOffset.x * remaining, y: viewOffset.y * remaining };
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
      trailCanvas.width = canvas.width;
      trailCanvas.height = canvas.height;
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
      ctx.fillStyle = canvasColors().ground;
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
      if (trailContext) {
        trailContext.setTransform(1, 0, 0, 1, 0, 0);
        trailContext.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
        trailContext.setTransform(
          dpr * renderScale,
          0,
          0,
          dpr * renderScale,
          dpr * (centerX - renderCamera.center.x * renderScale),
          dpr * (centerY - renderCamera.center.y * renderScale),
        );
        // Add adjacent coverage on a transparent layer, then composite once.
        // Source-over per piece leaves antialiased gaps at shared ribbon edges.
        trailContext.globalCompositeOperation = "lighter";
        trailContext.globalAlpha = 1;
      }
      for (const particle of snapshot.particles)
        drawTrail(
          trailContext ?? ctx,
          particle.trail,
          snapshot.elapsed,
          2.4 / renderScale,
          visibleParticleColor(particle.color),
          snapshot.physics.trailSeconds,
          snapshot.particles.length > 12,
        );
      if (trailContext) {
        trailContext.globalCompositeOperation = "source-over";
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(trailCanvas, 0, 0);
        ctx.restore();
      }
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
        planet(particle.position, radius, visibleParticleColor(particle.color));
      }
      const journey = snapshot.level.journey;
      if (journey) {
        const best = snapshot.particles
          .filter((p) => p.alive)
          .sort(
            (a, b) =>
              (b.journey?.leg ?? 0) - (a.journey?.leg ?? 0) ||
              Math.abs(b.journey?.sweep ?? 0) - Math.abs(a.journey?.sweep ?? 0),
          )[0];
        const legIndex = best?.journey?.leg ?? 0;
        const leg = journey.legs[legIndex];
        const body = snapshot.level.bodies.find(
          (body) => body.id === leg?.bodyId,
        );
        if (leg && body) {
          ctx.strokeStyle = canvasColors().blue;
          ctx.lineWidth = 1 / renderScale;
          ctx.globalAlpha = 0.25;
          ctx.setLineDash([3 / renderScale, 6 / renderScale]);
          circle(body.position, leg.radius);
          ctx.stroke();
          ctx.setLineDash([]);
          const fraction = Math.min(
            1,
            Math.abs(best?.journey?.sweep ?? 0) / leg.sweep,
          );
          if (fraction > 0) {
            ctx.globalAlpha = 0.65;
            ctx.lineWidth = 1.5 / renderScale;
            ctx.beginPath();
            ctx.arc(
              body.position.x,
              body.position.y,
              leg.radius,
              -Math.PI / 2,
              -Math.PI / 2 + fraction * TAU,
            );
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }
      snapshot.level.bodies.forEach((body) => {
        const goal = snapshot.progress.bodies?.find(
          (item) => item.bodyId === body.id,
        );
        const count =
          goal?.current ??
          snapshot.particles.filter(
            (p) => p.alive && orbitFraction(snapshot, p, body.id) >= 1,
          ).length;
        drawGravityCore(ctx, body, renderScale, count);
        if (body.kind === "repellent") return;
        const direction = snapshot.level.requirements?.find(
          (goal) => goal.bodyId === body.id,
        )?.direction;
        if (direction && direction !== "either") {
          const sign = direction === "clockwise" ? 1 : -1;
          const x = body.position.x + 25 / renderScale,
            y = body.position.y + body.radius + 22 / renderScale;
          const r = 6 / renderScale,
            start = -Math.PI * 0.7,
            end = start + sign * Math.PI * 1.5;
          ctx.strokeStyle = canvasColors().blue;
          ctx.lineWidth = 1.3 / renderScale;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(x, y, r, start, end, sign < 0);
          ctx.stroke();
          const px = x + Math.cos(end) * r,
            py = y + Math.sin(end) * r,
            tangent = end + (sign * Math.PI) / 2;
          ctx.beginPath();
          ctx.moveTo(
            px - (Math.cos(tangent - 0.6) * 4) / renderScale,
            py - (Math.sin(tangent - 0.6) * 4) / renderScale,
          );
          ctx.lineTo(px, py);
          ctx.lineTo(
            px - (Math.cos(tangent + 0.6) * 4) / renderScale,
            py - (Math.sin(tangent + 0.6) * 4) / renderScale,
          );
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      });
      // A planet exists at the chosen position only while aiming. The field has no fixed launcher.
      const anchor = snapshot.launchPosition;
      const blockedLaunch =
        !!options.pull && !gravityLaunchIsClear(anchor, snapshot);
      if (options.pull) {
        const heldColor = blockedLaunch
          ? canvasColors().danger
          : visibleParticleColor(nextProjectileColor(snapshot));
        planet(anchor, snapshot.physics.planetRadius, heldColor);
        const ghost = {
          x: anchor.x + options.pull.x / renderScale,
          y: anchor.y + options.pull.y / renderScale,
        };
        ctx.strokeStyle = canvasColors().handle;
        ctx.globalAlpha = 0.65;
        ctx.lineWidth = 1 / renderScale;
        ctx.beginPath();
        ctx.moveTo(anchor.x, anchor.y);
        ctx.lineTo(ghost.x, ghost.y);
        ctx.stroke();
        circle(ghost, 5 / renderScale);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = heldColor;
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
          ctx.fillStyle = canvasColors().danger;
          ctx.font = `${12 / renderScale}px "Avenir Next",sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.strokeStyle = canvasColors().ground;
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
      ctx.fillStyle = canvasColors().aimPath;
      const aimPreview = sampleGravityAimPreview(
        blockedLaunch ? [] : preview,
        renderScale,
        options.pathAssist,
      );
      for (const dot of aimPreview.dots) {
        const fade = 1 - dot.distance / aimPreview.length;
        ctx.globalAlpha = fade * fade * 0.98;
        circle(dot, 1.5 / renderScale);
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
        ctx.strokeStyle = canvasColors().aimPath;
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
        ctx.fillStyle = canvasColors().handle;
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
      trailCanvas.width = trailCanvas.height = 1;
      destroyed = true;
    },
  };
}
