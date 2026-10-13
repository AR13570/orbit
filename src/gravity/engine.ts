import { FIXED_STEP } from "../game/physics";
import type { Aim, Vec2 } from "../game/types";
import { generateGravityLevel } from "./generator";
import { createState, fire, goalProgress, step } from "./simulation";
import type { GravityLevel, GravitySnapshot, GravityState } from "./types";
export class GravityEngine {
  private state: GravityState;
  private aim: Aim = { angle: -Math.PI / 2, power: 0.25 };
  private accumulator = 0;
  private complete = false;
  private completedCount = 0;
  private customLevel: GravityLevel | undefined;
  constructor(
    private seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0,
    customLevel?: GravityLevel,
  ) {
    this.customLevel = customLevel ? structuredClone(customLevel) : undefined;
    this.state = createState(this.customLevel ?? generateGravityLevel(seed, 0));
  }
  getSnapshot(): GravitySnapshot {
    return structuredClone({
      ...this.state,
      aim: this.aim,
      complete: this.complete,
      completedCount: this.completedCount,
      progress: goalProgress(this.state),
    });
  }
  setAim(angle: number, power: number): void {
    if (Number.isFinite(angle) && Number.isFinite(power))
      this.aim = { angle, power: Math.max(0, Math.min(1, power)) };
  }
  launch(): boolean {
    return !this.complete && fire(this.state, this.aim);
  }
  update(dt: number): void {
    if (this.complete || !Number.isFinite(dt) || dt <= 0) return;
    this.accumulator += Math.min(dt, 0.25);
    while (this.accumulator + 1e-9 >= FIXED_STEP && !this.complete) {
      this.accumulator = Math.max(0, this.accumulator - FIXED_STEP);
      step(this.state, FIXED_STEP);
      if (goalProgress(this.state).complete) {
        this.complete = true;
        this.completedCount++;
      }
    }
  }
  retry(): void {
    if (this.complete && !this.customLevel) return;
    this.complete = false;
    this.state = createState(this.state.level);
    this.accumulator = 0;
  }
  advance(): void {
    if (!this.complete || this.customLevel) return;
    this.next();
  }
  skip(): void {
    if (!this.complete && !this.customLevel) this.next();
  }
  predict(seconds = 1.6): Vec2[] {
    if (this.complete || !Number.isFinite(seconds)) return [];
    const state = structuredClone(this.state);
    if (!fire(state, this.aim)) return [];
    const id = state.nextId - 1,
      path: Vec2[] = [{ ...state.level.launch }];
    for (let n = 0; n < Math.min(3, Math.max(0, seconds)) / FIXED_STEP; n++) {
      step(state, FIXED_STEP);
      const p = state.particles.find((p) => p.id === id);
      if (!p) break;
      if (n % 4 === 0 || !p.alive) path.push({ ...p.position });
      if (!p.alive) break;
    }
    return path;
  }
  private next(): void {
    this.state = createState(
      generateGravityLevel(this.seed, this.state.level.index + 1),
    );
    this.complete = false;
    this.accumulator = 0;
  }
}
