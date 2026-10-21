import { GRAVITY_FIXED_STEP } from "./physics";
import type { GravityPredictionJob } from "./prediction";
import type { Vec2 } from "./types";

type PreviewAim = { angle: number; power: number };
type Capture = { job: GravityPredictionJob; aim?: PreviewAim };
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
/** One short coherent prediction, spread across frames and eased for display. */
export class LiveGravityPreview {
  path: Vec2[] = [];
  private capture: Capture | null = null;
  private target: Vec2[] = [];
  private horizon = 0;
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
    if (this.capture && !sameHeading(this.capture.aim, aim)) {
      // Discard an obsolete short capture rather than spend frames finishing it.
      this.capture?.job.cancel();
      this.capture = null;
      this.path = [];
      this.target = [];
    }
    if (!this.capture || this.capture.job.done) {
      const job = create(seconds);
      this.capture = job ? { job, aim: aim ? { ...aim } : undefined } : null;
    }
    const captured = this.capture;
    captured?.job.advance(4);
    if (!captured || !sameHeading(captured.aim, aim)) this.target = [];
    else {
      for (let i = 0; i < captured.job.path.length; i++)
        this.target[i] = { ...captured.job.path[i] };
      if (captured.job.done) this.target.length = captured.job.path.length;
    }
    const frameSeconds = Math.max(0, Math.min(dt, 0.05));
    const prefixSamples = 0.5 / GRAVITY_FIXED_STEP / 4;
    const blends: number[] = [];
    this.path = this.target.map((point, index) => {
      const previous = this.path[index];
      if (!previous || index === 0) return { ...point };
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
    this.capture?.job.cancel();
    this.capture = null;
    this.path = [];
    this.target = [];
    this.horizon = 0;
  }
}
