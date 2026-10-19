import { isDarkTheme } from "../theme";
import {
  createWaveRenderer,
  type WaveField,
  type WaveRenderer,
} from "gravity-wave";
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
  const dark = isDarkTheme();
  const shadowColor =
    dark && /^#[0-9a-f]{6}$/i.test(color)
      ? "#" +
        [1, 3, 5]
          .map((start) => {
            const channel = parseInt(color.slice(start, start + 2), 16);
            return Math.round(channel + (255 - channel) * 0.65)
              .toString(16)
              .padStart(2, "0");
          })
          .join("")
      : color;
  const fields: WaveField[] = [
    {
      center: position,
      innerRadius: radius,
      radius: radius + 230,
      wavelength: (32 + radius * 0.34) * 1.35,
      direction: repels ? "outward" : "inward",
      color,
      shadowColor,
      mode: "morphing",
      morphAmount: 0.24,
      morphSpeed: 0.18,
      ...(dark
        ? {
            pointSize: 1.08,
            opacity: 0.78,
          }
        : {}),
    },
  ];
  surface.draw(fields, motionTime, { scale, reducedMotion });
  // A bounded second pass lifts faint crests on black without a blurred halo,
  // larger footprints or more points in the lattice. Light keeps its original pass.
  if (dark) surface.draw(fields, motionTime, { scale, reducedMotion });
}
