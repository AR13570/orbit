import type { Body, Vec2 } from "../game/types";
import type { Camera } from "../render/coordinates";
import type { TutorialMode } from "./state";

export interface TutorialCameraTargetOptions {
  overview: Camera;
  area: { width: number; height: number };
  step: string;
  mode: TutorialMode;
  launcher: Vec2;
  bodies: readonly Body[];
  checkpoint: { position: Vec2; radius: number };
  shotMode: 1 | 3;
  forcePhase?: "pull" | "push";
}

type FocusCircle = { position: Vec2; radius: number };
const copyCamera = (camera: Camera): Camera => ({
  center: { ...camera.center },
  scale: camera.scale,
});

/** World-space framing only. The caller owns flight locks and viewport offsets. */
export function getTutorialCameraTarget(
  options: TutorialCameraTargetOptions,
): Camera {
  const { overview, area, step, bodies, launcher, checkpoint, forcePhase } =
    options;
  let circles: FocusCircle[];
  let zoom = 2;
  switch (step) {
    case "intro":
    case "split":
    case "multiple":
      circles = [{ position: launcher, radius: 64 }];
      zoom = 2.2;
      break;
    case "practice-split":
      if (options.shotMode === 3) return copyCamera(overview);
      circles = [{ position: launcher, radius: 64 }];
      zoom = 2.2;
      break;
    case "forces": {
      const kind = forcePhase === "pull" ? "attractor" : "repellent";
      const selected = forcePhase
        ? bodies.filter((body) => body.kind === kind).slice(0, 1)
        : bodies;
      circles = selected.map((body) => ({
        position: body.position,
        radius: body.radius * 2.6,
      }));
      break;
    }
    case "checkpoint":
      circles = [
        {
          position: checkpoint.position,
          radius: Math.max(64, checkpoint.radius * 1.6),
        },
      ];
      break;
    case "orbit": {
      const body = bodies.find((candidate) => candidate.kind === "attractor");
      circles = body
        ? [{ position: body.position, radius: body.radius * 3.2 }]
        : [];
      break;
    }
    default:
      return copyCamera(overview);
  }
  if (circles.length === 0) return copyCamera(overview);
  const left = Math.min(
    ...circles.map((circle) => circle.position.x - circle.radius),
  );
  const right = Math.max(
    ...circles.map((circle) => circle.position.x + circle.radius),
  );
  const top = Math.min(
    ...circles.map((circle) => circle.position.y - circle.radius),
  );
  const bottom = Math.max(
    ...circles.map((circle) => circle.position.y + circle.radius),
  );
  const width = Number.isFinite(area.width) ? Math.max(1, area.width) : 1;
  const height = Number.isFinite(area.height) ? Math.max(1, area.height) : 1;
  const padding = Math.min(24, (Math.min(width, height) - 0.5) / 2);
  return {
    center: { x: (left + right) / 2, y: (top + bottom) / 2 },
    scale: Math.max(
      0.000001,
      Math.min(
        overview.scale * zoom,
        (width - 2 * padding) / Math.max(1, right - left),
        (height - 2 * padding) / Math.max(1, bottom - top),
      ),
    ),
  };
}

function sameCamera(a: Camera, b: Camera): boolean {
  return (
    a.center.x === b.center.x &&
    a.center.y === b.center.y &&
    a.scale === b.scale
  );
}

/** A deterministic view rig. Time is in seconds; suspended frames advance at most 50ms. */
export class TutorialCameraRig {
  private current: Camera;
  private from: Camera;
  private target: Camera;
  private elapsed = 0;
  private readonly duration: number;

  constructor(initial: Camera, durationSeconds = 0.72) {
    this.current = copyCamera(initial);
    this.from = copyCamera(initial);
    this.target = copyCamera(initial);
    this.duration = Number.isFinite(durationSeconds)
      ? Math.max(0.001, durationSeconds)
      : 0.72;
  }

  get camera(): Camera {
    return copyCamera(this.current);
  }
  get transitioning(): boolean {
    return !sameCamera(this.current, this.target);
  }

  setTarget(target: Camera, reducedMotion = false): void {
    if (reducedMotion) {
      this.snap(target);
      return;
    }
    if (sameCamera(target, this.target)) return;
    this.from = copyCamera(this.current);
    this.target = copyCamera(target);
    this.elapsed = 0;
  }

  snap(camera: Camera): void {
    this.current = copyCamera(camera);
    this.from = copyCamera(camera);
    this.target = copyCamera(camera);
    this.elapsed = 0;
  }

  update(dtSeconds: number): Camera {
    if (!this.transitioning || !Number.isFinite(dtSeconds) || dtSeconds <= 0)
      return this.camera;
    this.elapsed = Math.min(
      this.duration,
      this.elapsed + Math.min(dtSeconds, 0.05),
    );
    if (this.elapsed >= this.duration - 1e-9) {
      this.current = copyCamera(this.target);
      return this.camera;
    }
    const progress = this.elapsed / this.duration;
    const eased = progress * progress * (3 - 2 * progress);
    this.current = {
      center: {
        x:
          this.from.center.x +
          (this.target.center.x - this.from.center.x) * eased,
        y:
          this.from.center.y +
          (this.target.center.y - this.from.center.y) * eased,
      },
      scale: this.from.scale + (this.target.scale - this.from.scale) * eased,
    };
    return this.camera;
  }
}
