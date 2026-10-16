import type { Aim, Body, Particle, Vec2 } from "../game/types";
import {
  bodyStrength,
  SHIP_RADIUS,
  ODESSEY_FIXED_STEP,
  odesseyLaunchSpeed,
  stepOdesseyParticle,
  segmentCircleIntersection,
} from "../game/physics";
import { GravityEngine } from "../gravity/engine";
import { gravityForceAt, gravityLaunchSpeed } from "../gravity/physics";
import { orbitFraction } from "../gravity/simulation";
import type { TutorialMode } from "./state";
import { ODESSEY_TUTORIAL_LEVELS, traceOdesseyTutorial } from "./levels";
export const PRACTICE_LAUNCH = { x: 140, y: 350 };
export const PRACTICE_GOAL = { position: { x: 650, y: 330 }, radius: 72 };
export const PRACTICE_BODIES: Body[] = [
  {
    id: "pull",
    kind: "attractor",
    position: { x: 350, y: 190 },
    radius: 48,
    strength: bodyStrength(48),
  },
  {
    id: "push",
    kind: "repellent",
    position: { x: 620, y: 440 },
    radius: 28,
    strength: bodyStrength(28),
  },
];
export const PRACTICE_BOUNDS = { x: 90, y: 80, width: 650, height: 430 };
/** Owns only the authored rehearsal. Live engines are never referenced here. */
export class TutorialPractice {
  readonly gravity: GravityEngine | null;
  aim: Aim = { angle: 0, power: 0.35 };
  stage = "intro";
  shotMode: 1 | 3 = 1;
  launches = 0;
  docks = 0;
  branches = 0;
  multiples = 0;
  elapsed = 0;
  flightElapsed = 0;
  private particles: Particle[] = [];
  private branched = false;
  private solutions = new Map<string, { paths: Vec2[][]; capturedBy: number | null; tapPoint?: Vec2 }>();
  private captured = false;
  private accumulator = 0;
  private nextId = 1;
  private retiredAt = new Map<number, number>();
  private visualTime = 0;
  private gravityLaunchBase = 0;
  constructor(readonly mode: TutorialMode) {
    this.gravity =
      mode === "gravity"
        ? new GravityEngine(1, {
            index: 0,
            seed: 1,
            family: "crowd",
            bounds: { x: -200, y: -200, width: 1200, height: 1000 },
            launch: { ...PRACTICE_LAUNCH },
            bodies: structuredClone(PRACTICE_BODIES),
            objective: { kind: "crowd", count: 2, turns: 1, hold: 1 },
            witness: [],
          })
        : null;
    this.aim = this.suggestedAim();
    this.gravity?.setAim(this.aim.angle, this.aim.power);
  }
  get level() {
    return ODESSEY_TUTORIAL_LEVELS[this.stage === "practice-split" ? 1 : 0];
  }
  get launcher() {
    return this.mode === "odessey" ? this.level.launch : PRACTICE_LAUNCH;
  }
  get bodies() {
    return this.mode === "odessey" ? this.level.bodies : PRACTICE_BODIES;
  }
  get checkpoint() {
    return this.mode === "odessey" ? this.level.goal : PRACTICE_GOAL;
  }
  get bounds() {
    return this.mode === "odessey" ? this.level.bounds : PRACTICE_BOUNDS;
  }
  get branchTime() {
    return this.level.splitAt ?? 0;
  }
  interactive() {
    return (
      this.stage === "launch" ||
      (this.mode === "odessey" && this.stage === "practice-split")
    );
  }
  launchAllowed() {
    return (
      this.interactive() &&
      (this.stage !== "practice-split" || this.shotMode === 3)
    );
  }
  splitOccurred() {
    return this.branched;
  }
  enterStage(id: string) {
    const changedLevel =
      (this.stage === "practice-split") !== (id === "practice-split");
    this.stage = id;
    if (changedLevel) this.reset();
    this.gravityLaunchBase = this.launches;
    if (this.interactive() && !this.getParticles().some((p) => p.alive)) {
      const aim = this.suggestedAim();
      this.setAim(aim.angle, aim.power);
    }
  }
  suggestedAim(): Aim {
    if (this.mode === "odessey") return { ...this.level.suggestedAim };
    const body = PRACTICE_BODIES[0],
      dx = body.position.x - PRACTICE_LAUNCH.x,
      dy = body.position.y - PRACTICE_LAUNCH.y;
    const distance = Math.hypot(dx, dy),
      force = gravityForceAt(PRACTICE_LAUNCH, PRACTICE_BODIES);
    return {
      angle: Math.atan2(dy, dx) + Math.PI / 2,
      power: Math.min(
        0.8,
        Math.sqrt(
          Math.max(1, (force.x * dx + force.y * dy) / distance) * distance,
        ) / gravityLaunchSpeed(1),
      ),
    };
  }
  solution(): { paths: Vec2[][]; capturedBy: number | null; tapPoint?: Vec2 } {
    if (this.mode !== "odessey") return { paths: [], capturedBy: null };
    let solution = this.solutions.get(this.level.id);
    if (!solution) {
      const witness = traceOdesseyTutorial(this.level);
      solution = {
        paths: witness.paths.map((path) => path.points),
        capturedBy: witness.capturedBy,
        tapPoint: witness.splitPoint ?? undefined,
      };
      this.solutions.set(this.level.id, solution);
    }
    return solution;
  }
  setAim(angle: number, power: number) {
    this.aim = { angle, power: Math.max(0, Math.min(1, power)) };
    this.gravity?.setAim(angle, power);
  }
  /** A visible handle magnet makes this guided rehearsal usable with a thumb. */
  guidedAim(aim: Aim, fullPullDistance: number): Aim {
    if (this.mode !== "odessey" || this.stage !== "practice-split") return aim;
    const suggested = this.suggestedAim();
    const error = Math.hypot(
      Math.cos(aim.angle) * aim.power - Math.cos(suggested.angle) * suggested.power,
      Math.sin(aim.angle) * aim.power - Math.sin(suggested.angle) * suggested.power,
    ) * fullPullDistance;
    return error <= 14 ? suggested : aim;
  }
  launch(): boolean {
    if (!this.launchAllowed() || this.aim.power <= 0) return false;
    if (this.gravity) {
      if (!this.gravity.launch()) return false;
    } else {
      this.retireShots();
      const speed = odesseyLaunchSpeed(this.aim.power);
      this.particles.push({
        id: this.nextId++,
        position: { ...this.launcher },
        velocity: {
          x: Math.cos(this.aim.angle) * speed,
          y: Math.sin(this.aim.angle) * speed,
        },
        alive: true,
        trail: [{ ...this.launcher }],
      });
      this.flightElapsed = 0;
      this.accumulator = 0;
      this.captured = false;
    }
    this.launches++;
    this.branched = false;
    return true;
  }
  toggleMode() {
    if (
      this.stage !== "practice-split" ||
      this.getParticles().some((p) => p.alive)
    )
      return;
    this.shotMode = this.shotMode === 1 ? 3 : 1;
  }
  branch(): boolean {
    const center = this.particles.find((p) => p.alive);
    if (
      this.stage !== "practice-split" ||
      this.shotMode !== 3 ||
      this.branched ||
      !center
    )
      return false;
    for (const angle of [-Math.PI / 60, Math.PI / 60]) {
      const id = this.nextId++;
      this.particles.push({
        id,
        position: { ...center.position },
        velocity: {
          x:
            center.velocity.x * Math.cos(angle) -
            center.velocity.y * Math.sin(angle),
          y:
            center.velocity.x * Math.sin(angle) +
            center.velocity.y * Math.cos(angle),
        },
        alive: true,
        trail: [{ ...center.position }],
      });
    }
    this.branched = true;
    this.branches++;
    return true;
  }
  getParticles(): readonly Particle[] {
    return this.gravity ? this.gravity.getSnapshot().particles : this.particles;
  }
  reset() {
    this.gravity?.retry();
    this.particles = [];
    this.retiredAt.clear();
    this.flightElapsed = 0;
    this.accumulator = 0;
    this.branched = false;
    this.captured = false;
    this.shotMode = 1;
    const aim = this.suggestedAim();
    this.setAim(aim.angle, aim.power);
  }
  private retireShots() {
    for (const p of this.particles)
      if (p.alive) {
        p.alive = false;
        this.retiredAt.set(p.id, this.visualTime);
      }
  }
  trailOpacity(p: Particle) {
    return p.alive
      ? 0.5
      : Math.max(
          0,
          0.5 *
            (1 - (this.visualTime - (this.retiredAt.get(p.id) ?? 0)) / 0.25),
        );
  }
  private contact(from: Vec2, to: Vec2) {
    const goal = this.checkpoint;
    let hit = segmentCircleIntersection(
        from,
        to,
        goal.position,
        goal.radius + SHIP_RADIUS,
      ),
      dock = hit !== null;
    let fraction = hit ?? Infinity;
    for (const b of this.bodies) {
      hit = segmentCircleIntersection(
        from,
        to,
        b.position,
        b.radius + SHIP_RADIUS,
      );
      if (hit !== null && hit <= fraction) {
        fraction = hit;
        dock = false;
      }
    }
    return { fraction, dock };
  }
  preview(): Vec2[] {
    if (this.gravity) return this.gravity.predict();
    let position = { ...this.launcher };
    const speed = odesseyLaunchSpeed(this.aim.power);
    let velocity = {
      x: Math.cos(this.aim.angle) * speed,
      y: Math.sin(this.aim.angle) * speed,
    };
    const path = [position];
    for (let i = 0; i < 4 / ODESSEY_FIXED_STEP; i++) {
      const next = stepOdesseyParticle(
        position,
        velocity,
        this.bodies,
        ODESSEY_FIXED_STEP,
        this.checkpoint,
      );
      const { fraction } = this.contact(position, next.position);
      if (fraction < Infinity) {
        path.push({
          x: position.x + (next.position.x - position.x) * fraction,
          y: position.y + (next.position.y - position.y) * fraction,
        });
        break;
      }
      position = next.position;
      velocity = next.velocity;
      if (i % 5 === 0) path.push(position);
    }
    return path;
  }
  update(dt: number, suspended = false) {
    if (!this.interactive() || suspended || !Number.isFinite(dt) || dt <= 0)
      return;
    this.visualTime += Math.min(0.05, dt);
    const splitWindow = this.level.splitWindow;
    const approachingTap =
      this.stage === "practice-split" &&
      !this.branched &&
      splitWindow &&
      this.flightElapsed >= Math.max(0, splitWindow[0] - 0.05) &&
      this.flightElapsed <= splitWindow[1] + 0.05;
    const elapsed =
      Math.min(0.05, dt) * (this.gravity ? 0.6 : approachingTap ? 0.12 : 0.35);
    this.elapsed += elapsed;
    if (this.gravity) {
      this.gravity.update(elapsed);
      return;
    }
    this.accumulator += elapsed;
    while (this.accumulator >= ODESSEY_FIXED_STEP) {
      this.accumulator -= ODESSEY_FIXED_STEP;
      if (this.particles.some((p) => p.alive))
        this.flightElapsed += ODESSEY_FIXED_STEP;
      for (const p of this.particles) {
        if (!p.alive) continue;
        const next = stepOdesseyParticle(
          p.position,
          p.velocity,
          this.bodies,
          ODESSEY_FIXED_STEP,
          this.checkpoint,
        );
        const { fraction, dock } = this.contact(p.position, next.position);
        if (fraction < Infinity) {
          p.position = {
            x: p.position.x + (next.position.x - p.position.x) * fraction,
            y: p.position.y + (next.position.y - p.position.y) * fraction,
          };
          p.alive = false;
          this.retiredAt.set(p.id, this.visualTime);
          if (dock) {
            this.docks++;
            this.captured = true;
          }
        } else {
          p.position = next.position;
          p.velocity = next.velocity;
        }
        p.trail.push({ ...p.position });
        if (p.trail.length > 180) p.trail.shift();
        if (
          Math.hypot(
            p.position.x - this.launcher.x,
            p.position.y - this.launcher.y,
          ) > 1300 ||
          this.flightElapsed > 10
        ) {
          p.alive = false;
          this.retiredAt.set(p.id, this.visualTime);
        }
      }
    }
  }
  orbitProgress() {
    if (!this.gravity) return 0;
    const state = this.gravity.getSnapshot();
    return Math.max(
      0,
      ...state.particles
        .filter((p) => p.alive)
        .map((p) => orbitFraction(state, p, "pull")),
    );
  }
  tapNow() {
    const window = this.level.splitWindow ?? [
      this.branchTime - 0.12,
      this.branchTime + 0.12,
    ];
    return (
      this.stage === "practice-split" &&
      !this.branched &&
      this.shotMode === 3 &&
      this.getParticles().some((p) => p.alive) &&
      this.flightElapsed >= window[0] + 0.01 &&
      this.flightElapsed <= window[1] - 0.01
    );
  }
  ready() {
    return (
      !this.interactive() ||
      (this.gravity ? this.launches > this.gravityLaunchBase : this.captured)
    );
  }
  feedback() {
    if (!this.interactive()) return "";
    if (this.ready())
      return this.mode === "odessey" ? "Checkpoint reached." : "Ready to play.";
    if (this.mode === "gravity") return "Pull back. Release.";
    const flying = this.getParticles().some((p) => p.alive);
    if (this.stage === "practice-split") {
      if (this.shotMode !== 3) return "Double-tap anywhere to select Split.";
      if (this.tapNow()) return "Tap now, anywhere.";
      if (flying)
        return this.branched
          ? "The side ship clears the body."
          : "The center route is blocked. Tap at the split point.";
      if (this.flightElapsed > 0)
        return "Reset, then try the split point again.";
      return "Follow the guide. Split to take the side route.";
    }
    return flying ? "Follow the curve to the flag." : "Pull back. Release.";
  }
}
