import { drawBody, drawGravitySurface } from "../render/renderer";
import { TRAIL_SECONDS, orbitFraction } from "./simulation";
import type { GravitySnapshot, TrailPoint, GravityLevel } from "./types";
import {
  contentBounds,
  fitPlayableCamera,
  type Camera,
} from "../render/coordinates";
import type { Vec2 } from "../game/types";
import { usesTouchLayout } from "../controls";
interface DrawOptions {
  paused: boolean;
  reducedMotion: boolean;
  pull?: Vec2 | null;
}
const TAU = Math.PI * 2;
export function fitGravityFrame(
  level: GravityLevel,
  width: number,
  height: number,
  touchLayout = usesTouchLayout(width, height),
) {
  if (!touchLayout)
    return {
      camera: {
        center: { x: 450, y: 450 },
        scale: Math.max(
          0.01,
          Math.min((width - 24) / 900, (height - 240) / 900),
        ),
      },
      area: { x: 0, y: 15, width, height },
    };
  const landscape = width >= height && height <= 500;
  const left = landscape ? Math.min(190, width * 0.25) : 16;
  const top = landscape ? 18 : 128;
  const bottom = landscape ? 18 : 104;
  const area = {
    x: left,
    y: top,
    width: Math.max(1, width - left - 16),
    height: Math.max(1, height - top - bottom),
  };
  const bounds = contentBounds([
    { position: level.launch, radius: 0 },
    ...level.bodies.map((body) => ({
      position: body.position,
      // Preserve space for practical orbits, not just the solid surfaces.
      radius:
        body.kind === "attractor"
          ? Math.max(
              body.radius + 60,
              Math.min(
                240,
                Math.hypot(
                  level.launch.x - body.position.x,
                  level.launch.y - body.position.y,
                ),
              ),
            ) + 24
          : body.radius + 24,
    })),
  ]);
  return {
    camera: fitPlayableCamera(bounds, level.launch, area.width, area.height),
    area,
  };
}
function trailOpacity(point: TrailPoint, elapsed: number): number {
  return (
    0.55 *
    Math.pow(Math.max(0, 1 - (elapsed - point.time) / TRAIL_SECONDS), 1.6)
  );
}
function rgba(color: string, alpha: number): string {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
  if (!match) return `rgba(82, 124, 154, ${alpha})`;
  return `rgba(${parseInt(match[1], 16)}, ${parseInt(match[2], 16)}, ${parseInt(match[3], 16)}, ${alpha})`;
}
function drawTrail(
  ctx: CanvasRenderingContext2D,
  points: TrailPoint[],
  elapsed: number,
  width: number,
  color: string,
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
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1],
      to = points[index],
      fromEdge = edges[index - 1],
      toEdge = edges[index];
    if (!fromEdge || !toEdge || Math.hypot(to.x - from.x, to.y - from.y) < 1e-6)
      continue;
    const startAlpha = trailOpacity(from, elapsed),
      endAlpha = trailOpacity(to, elapsed);
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
export function createGravityRenderer(canvas: HTMLCanvasElement) {
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
  function frame(level: GravityLevel) {
    ({ camera, area } = fitGravityFrame(level, width, height));
    scale = camera.scale;
    lastLevel = level;
  }
  const scratch = {
    points: new Float32Array(73 * 73 * 4),
    wave: { crest: 0, slope: 0 },
  };
  function circle(p: Vec2, r: number) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0, r), 0, TAU);
  }
  function ship(p: Vec2, angle: number, color: string) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    const r = 6 / scale;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.7, -r * 0.6);
    ctx.lineTo(-r * 0.35, 0);
    ctx.lineTo(-r * 0.7, r * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  return {
    resize(w: number, h: number, pixelRatio = 1) {
      width = Math.max(1, w);
      height = Math.max(1, h);
      dpr = Math.min(2, Math.max(1, pixelRatio));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      if (lastLevel) frame(lastLevel);
    },
    getScale() {
      return scale;
    },
    render(
      snapshot: GravitySnapshot,
      preview: Vec2[],
      time: number,
      options: DrawOptions,
    ) {
      if (destroyed) return;
      const key = `${snapshot.level.seed}:${snapshot.level.index}`;
      if (!lastLevel || key !== levelKey) {
        frame(snapshot.level);
        levelKey = key;
      }
      if (lastTime !== null && !options.paused && !options.reducedMotion)
        motion += Math.min(0.05, Math.max(0, time - lastTime));
      lastTime = time;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#e9ecef";
      ctx.fillRect(0, 0, width, height);
      const centerX = area.x + area.width / 2;
      const centerY = area.y + area.height / 2;
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(scale, scale);
      ctx.translate(-camera.center.x, -camera.center.y);
      for (const body of snapshot.level.bodies)
        drawGravitySurface(
          ctx,
          body.position,
          body.radius,
          body.kind === "repellent",
          scale,
          motion,
          options.reducedMotion,
          body.kind === "repellent" ? "#b76550" : "#527c9a",
          scratch,
        );
      for (const particle of snapshot.particles) {
        drawTrail(
          ctx,
          particle.trail,
          snapshot.elapsed,
          1.5 / scale,
          particle.color,
        );
        ctx.globalAlpha = 1;
        if (particle.alive)
          ship(
            particle.position,
            Math.atan2(particle.velocity.y, particle.velocity.x),
            particle.color,
          );
      }
      const showBodyLabels =
        snapshot.level.bodies.filter((b) => b.kind === "attractor").length > 1;
      snapshot.level.bodies.forEach((body, index) => {
        drawBody(ctx, body, scale, showBodyLabels ? 7 / scale : 0);
        if (body.kind === "repellent") return;
        const best = Math.max(
          0,
          ...snapshot.particles
            .filter((p) => p.alive)
            .map((p) => orbitFraction(snapshot, p, body.id)),
        );
        ctx.strokeStyle = "#527c9a";
        ctx.globalAlpha = 0.22;
        ctx.lineWidth = 1 / scale;
        circle(body.position, body.radius + 8 / scale);
        ctx.stroke();
        if (best > 0) {
          ctx.globalAlpha = 0.8;
          ctx.lineWidth = 2 / scale;
          ctx.beginPath();
          ctx.arc(
            body.position.x,
            body.position.y,
            body.radius + 8 / scale,
            -Math.PI / 2,
            -Math.PI / 2 + best * TAU,
          );
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        if (showBodyLabels) {
          ctx.fillStyle = "#e9ecef";
          ctx.font = `700 ${11 / scale}px "Avenir Next",sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "alphabetic";
          const label = String.fromCharCode(65 + index);
          const metrics = ctx.measureText(label);
          const ascent = metrics?.actualBoundingBoxAscent ?? 8 / scale;
          const descent = metrics?.actualBoundingBoxDescent ?? 0;
          ctx.fillText(
            label,
            body.position.x,
            body.position.y + (ascent - descent) / 2,
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
        ctx.lineWidth = 1.5 / scale;
        ctx.setLineDash([2 / scale, 5 / scale]);
        circle(
          center,
          Math.hypot(
            bodies[0].position.x - center.x,
            bodies[0].position.y - center.y,
          ) +
            bodies[0].radius +
            20 / scale,
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
      const anchor = snapshot.level.launch;
      ctx.strokeStyle = "#626d78";
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1 / scale;
      ctx.setLineDash([1 / scale, 4 / scale]);
      circle(anchor, 20 / scale);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      if (!snapshot.complete) {
        ship(anchor, snapshot.aim.angle, "#303943");
        if (options.pull) {
          const dx = options.pull.x / scale,
            dy = options.pull.y / scale;
          // Clamp the visual handle to the usable screen while preserving shot power.
          const px = centerX + (anchor.x - camera.center.x) * scale,
            py = centerY + (anchor.y - camera.center.y) * scale;
          let fraction = 1;
          for (const [delta, start, limit] of [
            [dx * scale, px, width],
            [dy * scale, py, height],
          ])
            if (delta)
              fraction = Math.min(
                fraction,
                Math.max(0, ((delta > 0 ? limit - 16 : 16) - start) / delta),
              );
          const ghost = {
            x: anchor.x + dx * fraction,
            y: anchor.y + dy * fraction,
          };
          ctx.strokeStyle = "#626d78";
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.moveTo(anchor.x, anchor.y);
          ctx.lineTo(ghost.x, ghost.y);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ship(ghost, snapshot.aim.angle, "#303943");
          ctx.strokeStyle = "#527c9a";
          ctx.lineWidth = 2 / scale;
          ctx.beginPath();
          ctx.arc(
            anchor.x,
            anchor.y,
            20 / scale,
            -Math.PI / 2,
            -Math.PI / 2 + snapshot.aim.power * TAU,
          );
          ctx.stroke();
        }
      }
      ctx.fillStyle = "#8a0f4b";
      for (let n = 3; n < preview.length; n += 3) {
        ctx.globalAlpha = Math.pow(1 - n / preview.length, 2) * 0.9;
        circle(preview[n], 2 / scale);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    },
    destroy() {
      destroyed = true;
    },
  };
}
