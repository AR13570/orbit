import { MAX_GRAVITY_PREDICTION_SECONDS } from "./prediction-settings";
import { GRAVITY_FIXED_STEP } from "./physics";
import type { GravityPredictionJob } from "./prediction";
import type { Vec2 } from "./types";

type PreviewAim = { angle: number; power: number };
type Capture = {
  job: GravityPredictionJob;
  generation: number;
  aim?: PreviewAim;
};
function sameHeading(
  captured: PreviewAim | undefined,
  current: PreviewAim | undefined,
): boolean {
  if (!captured || !current) return true;
  const difference = current.angle - captured.angle;
  return (
    Math.abs(Math.atan2(Math.sin(difference), Math.cos(difference))) <= 0.2 &&
    Math.abs(current.power - captured.power) <= 0.06
  );
}
const PREFIX_SECONDS = 0.5;

/**
 * Two exact-physics lanes: a short, fresh prefix and a persistent full horizon.
 * Pointer moves only change the next capture, so neither lane can starve.
 * Jobs always own coherent worlds. Only the displayed polyline is eased.
 */
export class LiveGravityPreview {
  path: Vec2[] = [];
  private far: Capture | null = null;
  private near: Capture | null = null;
  private nearResult: Capture | null = null;
  private terminal: {
    path: Vec2[];
    generation: number;
    aim?: PreviewAim;
  } | null = null;
  private target: Vec2[] = [];
  private generation = 0;
  private horizon = 0;
  private displayedAim: PreviewAim | undefined;

  update(
    create: (seconds: number) => GravityPredictionJob | null,
    seconds: number,
    dt: number,
    aim?: PreviewAim,
  ): Vec2[] {
    if (seconds !== this.horizon) {
      this.cancel();
      this.horizon = seconds;
    }
    if (!sameHeading(this.displayedAim, aim)) {
      // A changed launch must never keep a distant trajectory in the old
      // direction. Finish that job in the background rather than restart it.
      this.path = [];
      this.target = [];
    }
    this.displayedAim = aim ? { ...aim } : undefined;
    if (this.terminal && !sameHeading(this.terminal.aim, aim))
      this.terminal = null;
    const capture = (horizon: number): Capture | null => {
      const job = create(horizon);
      return job
        ? {
            job,
            generation: ++this.generation,
            aim: aim ? { ...aim } : undefined,
          }
        : null;
    };
    if (!this.far || this.far.job.done) this.far = capture(seconds);
    // Partial assist already has a short horizon and needs no second lane.
    if (
      seconds >= MAX_GRAVITY_PREDICTION_SECONDS &&
      (!this.near || this.near.job.done)
    ) {
      if (this.near) this.nearResult = this.near;
      this.near = capture(PREFIX_SECONDS);
    }
    // Keep total physics work at four milliseconds per frame. Check the budget
    // per fixed step inside each job, including dense particle systems.
    this.near?.job.advance(1);
    this.far?.job.advance(this.near ? 3 : 4);
    const far = this.far;
    const usableFar = far && sameHeading(far.aim, aim);
    if (!usableFar) this.target = [];
    if (usableFar) {
      for (let i = 0; i < far.job.path.length; i++)
        this.target[i] = { ...far.job.path[i] };
      if (far.job.done) this.target.length = far.job.path.length;
    }
    const nearCandidate =
      this.near && this.near.job.path.length > 1 ? this.near : this.nearResult;
    const near =
      nearCandidate && sameHeading(nearCandidate.aim, aim)
        ? nearCandidate
        : null;
    if (near && far && (!usableFar || near.generation >= far.generation)) {
      const points = near.job.path;
      const expected = Math.floor(PREFIX_SECONDS / GRAVITY_FIXED_STEP / 4) + 1;
      const endedEarly =
        near.job.terminated ?? (near.job.done && points.length < expected);
      if (
        endedEarly &&
        (!this.terminal || near.generation >= this.terminal.generation)
      ) {
        this.terminal = {
          path: points.map((point) => ({ ...point })),
          generation: near.generation,
          aim: near.aim,
        };
      } else if (
        this.terminal &&
        near.generation > this.terminal.generation &&
        (points.length > this.terminal.path.length ||
          (near.job.done &&
            !endedEarly &&
            points.length >= this.terminal.path.length))
      ) {
        // Only newer simulated continuation can refute the previous collision.
        this.terminal = null;
      }
      for (let i = 0; i < points.length; i++) {
        // Feather the overlap in physical-time sample order, avoiding a seam
        // where the more recent prefix meets the still-computing distant tail.
        const weight =
          !usableFar || endedEarly || this.terminal || !this.target[i]
            ? 1
            : Math.min(1, (points.length - i) / 5);
        const old = this.target[i] ?? points[i];
        this.target[i] = {
          x: old.x + (points[i].x - old.x) * weight,
          y: old.y + (points[i].y - old.y) * weight,
        };
      }
      if (endedEarly) this.target.length = points.length;
    }
    if (this.terminal) {
      const prefixLength =
        near && near.generation >= this.terminal.generation
          ? near.job.path.length
          : 0;
      for (let i = prefixLength; i < this.terminal.path.length; i++)
        this.target[i] = { ...this.terminal.path[i] };
      this.target.length = Math.min(
        this.target.length,
        this.terminal.path.length,
      );
    }
    const frameSeconds = Math.max(0, Math.min(dt, 0.05));
    const prefixSamples = PREFIX_SECONDS / GRAVITY_FIXED_STEP / 4;
    const blends: number[] = [];
    this.path = this.target.map((point, index) => {
      const previous = this.path[index];
      if (!previous || index === 0) return { ...point };
      // Keep the launch responsive while gently animating distant deflections
      // caused by the moving sky, including when the pointer is held still.
      const farWeight = Math.max(0, Math.min(1, (index - prefixSamples) / 5));
      const blend = (blends[farWeight * 5] ??=
        1 - Math.exp(-frameSeconds / (0.045 + 0.035 * farWeight)));
      return {
        x: previous.x + (point.x - previous.x) * blend,
        y: previous.y + (point.y - previous.y) * blend,
      };
    });
    return this.path;
  }
  cancel(): void {
    this.far?.job.cancel();
    this.near?.job.cancel();
    this.far = null;
    this.near = null;
    this.nearResult = null;
    this.terminal = null;
    this.path = [];
    this.target = [];
    this.horizon = 0;
    this.displayedAim = undefined;
  }
}
