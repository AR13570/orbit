import { MAX_GRAVITY_PREDICTION_SECONDS } from "./prediction-settings";
import { GRAVITY_FIXED_STEP } from "./physics";
import { fireFrom, step } from "./simulation";
import type { GravityState, Vec2 } from "./types";
export interface GravityPredictionJob {
  readonly path: Vec2[];
  readonly done: boolean;
  /** True when the launched body was lost, including on the horizon boundary. */
  readonly terminated?: boolean;
  advance(budgetMs?: number): void;
  cancel(): void;
}
/** A captured world advances with the same fixed physics as play, spread across render frames. */
export function createGravityPrediction(
  source: GravityState,
  position: Vec2,
  velocity: Vec2,
  seconds: number,
): GravityPredictionJob {
  let state: GravityState | null = structuredClone({
    ...source,
    particles: source.particles.map((planet) => ({ ...planet, trail: [] })),
  });
  const valid =
    Number.isFinite(seconds) &&
    seconds >= 0 &&
    fireFrom(state, position, velocity);
  const id = state.nextId - 1,
    path: Vec2[] = valid ? [{ ...position }] : [];
  const steps = valid
    ? Math.floor(
        Math.min(MAX_GRAVITY_PREDICTION_SECONDS, seconds) / GRAVITY_FIXED_STEP +
          1e-9,
      )
    : 0;
  let count = 0,
    terminated = false,
    done = steps === 0;
  return {
    path,
    get done() {
      return done;
    },
    get terminated() {
      return terminated;
    },
    advance(budgetMs = 5) {
      if (done || !state || !Number.isFinite(budgetMs) || budgetMs <= 0) return;
      const deadline = performance.now() + Math.min(8, budgetMs);
      while (count < steps) {
        if (performance.now() >= deadline) break;
        step(state, GRAVITY_FIXED_STEP, false);
        count++;
        const planet = state.particles.find((planet) => planet.id === id);
        if (!planet) {
          terminated = true;
          done = true;
          break;
        }
        if (count % 4 === 0 || count === steps || !planet.alive)
          path.push({ ...planet.position });
        if (!planet.alive) {
          terminated = true;
          done = true;
          break;
        }
      }
      if (count >= steps) done = true;
      if (done) state = null;
    },
    cancel() {
      done = true;
      state = null;
    },
  };
}
