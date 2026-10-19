import type { Vec2 } from "./game/types";
export const MOBILE_PULL_DISTANCE = 72;
export function usesTouchLayout(
  width: number,
  height: number,
  touchCapable = (typeof navigator !== "undefined" &&
    navigator.maxTouchPoints > 0) ||
    (typeof window !== "undefined" &&
      !!window.matchMedia?.("(any-pointer: coarse)").matches),
) {
  return touchCapable || Math.min(width, height) <= 500;
}
export function pullDistance(
  pointerType: string,
  width: number,
  height: number,
) {
  return pointerType === "touch" || usesTouchLayout(width, height)
    ? MOBILE_PULL_DISTANCE
    : Math.min(160, Math.max(MOBILE_PULL_DISTANCE, width * 0.18 - 18));
}
export function runSeed(search: string) {
  const raw = new URLSearchParams(search).get("seed");
  if (raw === null || raw.trim() === "") return undefined;
  const seed = Number(raw);
  return Number.isSafeInteger(seed) ? seed : undefined;
}

export class PullGesture {
  private pointer: number | null = null;
  private origin: Vec2 | null = null;
  private furthestDistance = 0;
  private startedAt = 0;
  constructor(
    private fullDistance: number,
    private options: { unlimitedPull?: boolean } = {},
  ) {}
  get active() {
    return this.pointer !== null;
  }
  get tapEligible() {
    return (
      this.active &&
      this.furthestDistance < 8 &&
      performance.now() - this.startedAt <= 250
    );
  }
  get pointerId() {
    return this.pointer;
  }
  begin(pointer: number, point: Vec2) {
    if (this.active) return false;
    this.pointer = pointer;
    this.startedAt = performance.now();
    this.origin = { ...point };
    this.furthestDistance = 0;
    return true;
  }
  move(pointer: number, point: Vec2) {
    if (pointer !== this.pointer || !this.origin) return null;
    const dx = this.origin.x - point.x,
      dy = this.origin.y - point.y;
    const distance = Math.hypot(dx, dy);
    this.furthestDistance = Math.max(this.furthestDistance, distance);
    const visualScale =
      !this.options.unlimitedPull && distance > this.fullDistance
        ? this.fullDistance / distance
        : 1;
    return {
      angle: Math.atan2(dy, dx),
      power: this.options.unlimitedPull
        ? distance / this.fullDistance
        : Math.min(1, distance / this.fullDistance),
      distance,
      pull: { x: -dx * visualScale, y: -dy * visualScale },
    };
  }
  end(pointer: number, point: Vec2, options: { allowTap?: boolean } = {}) {
    const aim = this.move(pointer, point);
    if (!aim) return null;
    const tap = options.allowTap && this.furthestDistance < 8;
    this.cancel();
    return aim.distance >= 8 ? aim : tap ? { ...aim, power: 0 } : null;
  }
  cancel() {
    this.pointer = null;
    this.origin = null;
    this.furthestDistance = 0;
  }
}

export class TapSequence {
  private previous: { point: Vec2; time: number } | null = null;
  tap(point: Vec2, time: number) {
    const previous = this.previous;
    if (
      previous &&
      time >= previous.time &&
      time - previous.time <= 300 &&
      Math.hypot(point.x - previous.point.x, point.y - previous.point.y) <= 24
    ) {
      this.reset();
      return true;
    }
    this.previous = { point: { ...point }, time };
    return false;
  }
  reset() {
    this.previous = null;
  }
}
