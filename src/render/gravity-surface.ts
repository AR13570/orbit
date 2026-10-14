import { createWaveRenderer, type WaveRenderer } from "gravity-wave";
import type { Vec2 } from "../game/types";

export { sampleGravityWave } from "gravity-wave";
export type { WaveSample } from "gravity-wave";
export const createGravitySurface = createWaveRenderer;

/** Adapts Orbit's physical body radius and active clock to the reusable effect. */
export function drawGravitySurface(
  _ctx: CanvasRenderingContext2D,
  position: Vec2,
  radius: number,
  repels: boolean,
  scale: number,
  motionTime: number,
  reducedMotion: boolean,
  color: string,
  surface: WaveRenderer,
): void {
  surface.draw(
    [
      {
        center: position,
        innerRadius: radius,
        radius: radius + 140,
        direction: repels ? "outward" : "inward",
        color,
        shadowColor: color,
      },
    ],
    motionTime,
    { scale, reducedMotion },
  );
}
