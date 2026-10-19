import type { Body } from "../game/types";
import { FORCE_PALETTE } from "../render/force-palette";
import { drawBody } from "../render/renderer";

/** CSS-pixel label dimensions, scaled down only when the physical face needs it. */
export function gravityCoreLabelStyle(
  radius: number,
  scale: number,
  count: number,
) {
  const digits = String(Math.max(0, Math.floor(count))).length;
  const idealWidth = 14 * 0.65 * digits + 14;
  const fit = Math.min(1, Math.max(0, radius * scale * 1.25) / idealWidth);
  return {
    fontSize: 14 * fit,
    symbolHeight: 6 * fit,
    strokeWidth: fit,
    symbolOpacity: 0.65,
    gap: 4 * fit,
    estimatedContentWidth: idealWidth * fit,
  };
}

/** Counters occupy the existing physical face, never a larger invisible solid. */
export function drawGravityCore(
  ctx: CanvasRenderingContext2D,
  body: Readonly<Body>,
  scale: number,
  count: number,
): void {
  drawBody(ctx, body, scale, 0, false);
  if (!Number.isFinite(scale) || scale <= 0) return;
  const repel = body.kind === "repellent";
  const label = String(Math.max(0, Math.floor(count)));
  const style = gravityCoreLabelStyle(body.radius, scale, repel ? 0 : count);
  const { x, y } = body.position;
  ctx.save();
  ctx.fillStyle = FORCE_PALETTE[body.kind].glyph;
  ctx.strokeStyle = FORCE_PALETTE[body.kind].glyph;
  ctx.font = `600 ${style.fontSize / scale}px "Avenir Next",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const metrics = repel ? undefined : ctx.measureText(label);
  const width = repel
    ? 0
    : (metrics?.width ?? (style.fontSize * 0.65 * label.length) / scale);
  if (!repel) {
    const ascent =
      metrics?.actualBoundingBoxAscent ?? (style.fontSize * 0.72) / scale;
    const descent = metrics?.actualBoundingBoxDescent ?? 0;
    const left = metrics?.actualBoundingBoxLeft ?? width / 2;
    const right = metrics?.actualBoundingBoxRight ?? width / 2;
    ctx.fillText(label, x + (left - right) / 2, y + (ascent - descent) / 2);
  }
  ctx.globalAlpha *= style.symbolOpacity;
  ctx.lineWidth = style.strokeWidth / scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const halfHeight = style.symbolHeight / scale / 2;
  for (const side of [-1, 1]) {
    const near = width / 2 + style.gap / scale;
    const inner = near * side;
    const outer = (near + halfHeight) * side;
    ctx.beginPath();
    ctx.moveTo(x + (repel ? inner : outer), y - halfHeight);
    ctx.lineTo(x + (repel ? outer : inner), y);
    ctx.lineTo(x + (repel ? inner : outer), y + halfHeight);
    ctx.stroke();
  }
  ctx.restore();
}
