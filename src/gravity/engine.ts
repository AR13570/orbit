import {
  createGravityPrediction,
  type GravityPredictionJob,
} from "./prediction";
import type { Aim, Vec2, WorldBounds } from "../game/types";
import { generateGravityLevel } from "./generator";
import {
  GRAVITY_FIXED_STEP,
  GRAVITY_SPEED_SCALE,
  gravityLaunchSpeed,
  physicsSettings,
} from "./physics";
import { createState, fireFrom, goalProgress, step } from "./simulation";
import {
  DEFAULT_PROJECTILE_SIZE,
  normalizeProjectileSize,
  projectileProfile,
} from "./projectile-size";
import type {
  GravityLevel,
  GravityLevelProvider,
  GravityPhysicsOptions,
  GravitySnapshot,
  GravityState,
} from "./types";
export class GravityEngine {
  private state: GravityState;
  private aim: Aim = { angle: -Math.PI / 2, power: 0.25 };
  private launchPosition: Vec2;
  private accumulator = 0;
  private complete = false;
  private completedCount = 0;
  private paused = false;
  private timeScale = GRAVITY_SPEED_SCALE;
  private customLevel: GravityLevel | undefined;
  private particleInteractionOverride: boolean | undefined;
  private particleGroupingOverride: boolean | undefined;
  private projectileSize = DEFAULT_PROJECTILE_SIZE;
  private projectileBaseRadius: number;
  private projectileBaseMass: number;
  private defaultViewScale: number | undefined;
  private flightBounds: WorldBounds | undefined;
  constructor(
    private seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0,
    customLevel?: GravityLevel,
    private levelProvider: GravityLevelProvider = generateGravityLevel,
  ) {
    this.customLevel = customLevel ? structuredClone(customLevel) : undefined;
    this.state = createState(this.customLevel ?? levelProvider(seed, 0));
    this.state.groupSpin = { groups: {} };
    this.projectileBaseRadius = this.state.physics.planetRadius;
    this.projectileBaseMass = this.state.physics.planetMass;
    this.applyProjectileSize();
    this.launchPosition = { ...this.state.level.launch };
  }
  getSnapshot(): GravitySnapshot {
    return structuredClone(this.getRenderSnapshot());
  }
  /** Ephemeral render view. Never mutate or retain nested references between updates. */
  getRenderSnapshot(): GravitySnapshot {
    return {
      ...this.state,
      projectileSize: this.projectileSize,
      aim: this.aim,
      launchPosition: this.launchPosition,
      paused: this.paused,
      timeScale: this.timeScale,
      complete: this.complete,
      completedCount: this.completedCount,
      progress: goalProgress(this.state),
    };
  }
  setAim(angle: number, power: number): void {
    if (Number.isFinite(angle) && Number.isFinite(power))
      this.aim = { angle, power: Math.max(0, Math.min(1, power)) };
  }
  setLaunch(position: Vec2, aim: Aim): void {
    if (Number.isFinite(position.x) && Number.isFinite(position.y))
      this.launchPosition = { ...position };
    this.setAim(aim.angle, aim.power);
  }
  setPaused(paused: boolean): void {
    this.paused = paused;
  }
  /** The outermost allowed camera view, independent of the player's current zoom. */
  setFlightBounds(bounds: WorldBounds): void {
    const valid = (rect: WorldBounds) =>
      [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) &&
      rect.width > 0 &&
      rect.height > 0;
    if (!valid(bounds)) return;
    this.flightBounds = { ...bounds };
    this.state.flightBounds = { ...bounds };
  }
  setTimeScale(scale: number): void {
    if (Number.isFinite(scale))
      this.timeScale = Math.max(0.25, Math.min(2, scale));
  }
  setPhysics(options: GravityPhysicsOptions): void {
    this.state.groupSpin = { groups: {} };
    this.state.physics = physicsSettings({
      ...this.state.physics,
      planetRadius: this.projectileBaseRadius,
      planetMass: this.projectileBaseMass,
      ...options,
    });
    this.state.level.physics = { ...this.state.physics };
    this.captureProjectileBaseline();
    this.applyProjectileSize();
  }
  /** A launch preference, separate from authored physics and already flying planets. */
  setProjectileSize(factor: number): void {
    this.projectileSize = normalizeProjectileSize(factor);
    this.applyProjectileSize();
  }
  /** Calibrate only the next launch against the level's unzoomed fitted view. */
  setDefaultViewScale(scale: number): void {
    if (this.customLevel || !Number.isFinite(scale) || scale <= 0) return;
    if (scale === this.defaultViewScale) return;
    this.defaultViewScale = scale;
    this.applyProjectileSize();
  }
  getProjectileSize(): number {
    return this.projectileSize;
  }
  private captureProjectileBaseline(): void {
    this.projectileBaseRadius = this.state.physics.planetRadius;
    this.projectileBaseMass = this.state.physics.planetMass;
  }
  private applyProjectileSize(): void {
    this.state.projectileSize = this.projectileSize;
    const profile = projectileProfile(
      this.defaultViewScale === undefined
        ? this.projectileBaseRadius
        : Math.max(4, Math.min(16, 6 / this.defaultViewScale)),
      this.projectileBaseMass,
      this.projectileSize,
    );
    this.state.physics.planetRadius = profile.radius;
    this.state.physics.planetMass = profile.mass;
  }
  /** Applies a user preference immediately and keeps it across level navigation. */
  setParticleInteraction(enabled: boolean): void {
    this.state.groupSpin = { groups: {} };
    this.particleInteractionOverride = enabled;
    this.state.physics.planetGravity = enabled;
  }
  /** Surface contact is independent from the mutual gravitational force. */
  setParticleGrouping(enabled: boolean): void {
    this.state.groupSpin = { groups: {} };
    this.particleGroupingOverride = enabled;
    this.state.physics.planetCollisions = enabled ? "soft" : "none";
  }
  private applyParticleOverrides(): void {
    if (this.particleGroupingOverride !== undefined)
      this.state.physics.planetCollisions = this.particleGroupingOverride
        ? "soft"
        : "none";
    if (this.particleInteractionOverride !== undefined)
      this.state.physics.planetGravity = this.particleInteractionOverride;
  }
  clearTrails(): void {
    for (const p of this.state.particles) p.trail = [];
    this.state.sampleClock = 0;
  }
  launchFrom(position: Vec2, velocity: Vec2): boolean {
    return fireFrom(this.state, position, velocity);
  }
  launch(): boolean {
    if (this.aim.power <= 0) return false;
    const speed = gravityLaunchSpeed(this.aim.power);
    return this.launchFrom(this.launchPosition, {
      x: Math.cos(this.aim.angle) * speed,
      y: Math.sin(this.aim.angle) * speed,
    });
  }
  update(dt: number): void {
    if (this.paused || !Number.isFinite(dt) || dt <= 0) return;
    this.accumulator += Math.min(dt, 0.25) * this.timeScale;
    while (this.accumulator + 1e-9 >= GRAVITY_FIXED_STEP) {
      this.accumulator = Math.max(0, this.accumulator - GRAVITY_FIXED_STEP);
      step(this.state, GRAVITY_FIXED_STEP);
      if (!this.complete && goalProgress(this.state).complete) {
        this.complete = true;
        this.completedCount++;
      }
    }
  }
  retry(): void {
    this.complete = false;
    this.state = createState(this.state.level);
    this.state.groupSpin = { groups: {} };
    if (this.flightBounds) this.state.flightBounds = { ...this.flightBounds };
    this.captureProjectileBaseline();
    this.applyProjectileSize();
    this.applyParticleOverrides();
    this.accumulator = 0;
    this.launchPosition = { ...this.state.level.launch };
  }
  advance(): void {
    if (this.complete && !this.customLevel) this.next();
  }
  skip(): void {
    if (!this.customLevel) this.next();
  }
  beginPrediction(seconds = 10): GravityPredictionJob | null {
    if (this.aim.power <= 0) return null;
    const speed = gravityLaunchSpeed(this.aim.power);
    return createGravityPrediction(
      this.state,
      this.launchPosition,
      {
        x: Math.cos(this.aim.angle) * speed,
        y: Math.sin(this.aim.angle) * speed,
      },
      seconds,
    );
  }
  predict(seconds = 1.6): Vec2[] {
    const speed = gravityLaunchSpeed(this.aim.power);
    return this.aim.power > 0
      ? this.predictFrom(
          this.launchPosition,
          {
            x: Math.cos(this.aim.angle) * speed,
            y: Math.sin(this.aim.angle) * speed,
          },
          seconds,
        )
      : [];
  }
  predictFrom(position: Vec2, velocity: Vec2, seconds = 1.6): Vec2[] {
    if (!Number.isFinite(seconds) || seconds < 0) return [];
    const state = structuredClone({
      ...this.state,
      particles: this.state.particles.map((p) => ({ ...p, trail: [] })),
    });
    if (!fireFrom(state, position, velocity)) return [];
    const id = state.nextId - 1,
      path = [{ ...position }],
      steps = Math.floor(Math.min(10, seconds) / GRAVITY_FIXED_STEP + 1e-9);
    for (let n = 0; n < steps; n++) {
      step(state, GRAVITY_FIXED_STEP);
      const p = state.particles.find((p) => p.id === id);
      if (!p) break;
      if ((n + 1) % 4 === 0 || n === steps - 1 || !p.alive)
        path.push({ ...p.position });
      if (!p.alive) break;
    }
    return path;
  }
  goTo(index: number): void {
    if (this.customLevel || !Number.isFinite(index)) return;
    this.state = createState(
      this.levelProvider(this.seed, Math.max(0, Math.floor(index))),
    );
    this.state.groupSpin = { groups: {} };
    this.defaultViewScale = undefined;
    if (this.flightBounds) this.state.flightBounds = { ...this.flightBounds };
    this.captureProjectileBaseline();
    this.applyProjectileSize();
    this.applyParticleOverrides();
    this.launchPosition = { ...this.state.level.launch };
    this.complete = false;
    this.accumulator = 0;
  }
  private next(): void {
    this.goTo(this.state.level.index + 1);
  }
}
