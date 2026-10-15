import { useId, type CSSProperties } from "react";
import {
  MAX_PROJECTILE_SIZE,
  MIN_PROJECTILE_SIZE,
  PROJECTILE_SIZE_STEP,
} from "./projectile-size";
import "./projectile-size-control.css";

export default function ProjectileSizeControl({
  value,
  baseRadius,
  scale,
  onChange,
  onInteract,
}: {
  value: number;
  baseRadius: number;
  scale: number;
  onChange: (value: number) => void;
  onInteract: () => void;
}) {
  const id = useId();
  const description = `${id}-description`;
  // Match the renderer's 4.5px minimum visible radius. Cap the UI baseline
  // before scaling so even enormous custom planets retain the 1:2 comparison.
  const diameter = Math.min(18, Math.max(9, baseRadius * scale * 2));
  return (
    <div
      className="projectile-size-control"
      onPointerDownCapture={onInteract}
      style={
        {
          "--projectile-size-min": `${diameter}px`,
          "--projectile-size-max": `${diameter * MAX_PROJECTILE_SIZE}px`,
          "--projectile-size-thumb": `${diameter * value}px`,
          "--projectile-size-factor": value,
        } as CSSProperties
      }
    >
      <label htmlFor={id}>Size</label>
      <span
        className="projectile-size-circle projectile-size-large"
        aria-hidden="true"
      />
      <input
        id={id}
        type="range"
        min={MIN_PROJECTILE_SIZE}
        max={MAX_PROJECTILE_SIZE}
        step={PROJECTILE_SIZE_STEP}
        value={value}
        aria-label="Projectile size"
        aria-orientation="vertical"
        aria-valuetext={
          value === 1
            ? "Default size"
            : value === 2
              ? "Double size"
              : `${value} times default size`
        }
        aria-describedby={description}
        title="Larger projectiles pull others more strongly"
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      <span
        className="projectile-size-circle projectile-size-small"
        aria-hidden="true"
      />
      <span id={description} className="sr-only">
        Larger projectiles pull others more strongly.
      </span>
    </div>
  );
}
