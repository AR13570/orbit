import { launchSpeed } from "../game/physics";
import type { Body, Vec2 } from "../game/types";
import type {
  GravityParticle,
  GravityPhysicsOptions,
  GravityPhysicsSettings,
} from "./types";

/** Playback default, never multiplied into physical velocity or acceleration. */
export const GRAVITY_SPEED_SCALE = 1.4;
export const GRAVITY_FORCE_SCALE = 1;
export const GRAVITY_FIXED_STEP = 1 / 120;
export const WELL_SOFTENING = 40;
export const PARTICLE_GRAVITY_STRENGTH = 96000;
/** Broaden only the near field; distant attraction retains the authored strength. */
export function particleSoftening(
  a: Pick<GravityParticle, "radius">,
  b: Pick<GravityParticle, "radius">,
): number {
  return Math.max(60, (a.radius + b.radius) * 1.5);
}

/** Pair potential matching the Plummer force, zero at infinity. */
export function particlePairPotential(
  a: GravityParticle,
  b: GravityParticle,
  strength: number,
): number {
  const dx = b.position.x - a.position.x,
    dy = b.position.y - a.position.y;
  return (
    -(strength * a.mass * b.mass) /
    Math.sqrt(dx * dx + dy * dy + particleSoftening(a, b) ** 2)
  );
}
const finitePositive = (value: number | undefined, fallback: number) =>
  value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
export const wellSoftening = (body: Pick<Body, "softening">): number =>
  finitePositive(body.softening, WELL_SOFTENING);
export function physicsSettings(
  options: GravityPhysicsOptions = {},
): GravityPhysicsSettings {
  return {
    planetGravity: options.planetGravity ?? true,
    planetCollisions: ["none", "soft", "elastic", "merge"].includes(
      options.planetCollisions ?? "",
    )
      ? options.planetCollisions!
      : "soft",
    bodyCollisions: options.bodyCollisions ?? true,
    planetMass: finitePositive(options.planetMass, 1),
    planetRadius: finitePositive(options.planetRadius, 8),
    planetGravityStrength: finitePositive(
      options.planetGravityStrength,
      PARTICLE_GRAVITY_STRENGTH,
    ),
    trailSeconds: Math.min(60, finitePositive(options.trailSeconds, 24)),
    escapeDistance: finitePositive(options.escapeDistance, 20000),
  };
}
export function gravityLaunchSpeed(power: number): number {
  const speed = launchSpeed(power);
  // Preserve authored low-power shots; only deliberate near-full pulls gain speed.
  const boost = Math.max(0, Math.min(1, (power - 0.8) / 0.2));
  return speed + 40 * boost * boost * (3 - 2 * boost);
}
/** Invert the launch response without changing the power of authored gentle shots. */
export function gravityLaunchPower(speed: number): number {
  if (Number.isNaN(speed) || speed <= 0) return 0;
  if (speed <= launchSpeed(0.8)) return speed / launchSpeed(1);
  if (speed >= gravityLaunchSpeed(1)) return 1;
  let low = 0.8,
    high = 1;
  for (let n = 0; n < 42; n++) {
    const middle = (low + high) / 2;
    if (gravityLaunchSpeed(middle) < speed) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}
export function gravityForceAt(position: Vec2, bodies: readonly Body[]): Vec2 {
  let x = 0,
    y = 0;
  for (const body of bodies) {
    const dx = body.position.x - position.x,
      dy = body.position.y - position.y;
    const square = dx * dx + dy * dy;
    if (square < 1e-12) continue;
    const softening = wellSoftening(body);
    const scale =
      ((body.kind === "attractor" ? 1 : -1) * body.strength) /
      ((square + softening ** 2) * Math.sqrt(square));
    x += dx * scale;
    y += dy * scale;
  }
  return { x, y };
}
/** Potential matching the softened static well force, zero at infinity. */
export function wellPotential(position: Vec2, bodies: readonly Body[]): number {
  return bodies.reduce((sum, body) => {
    const softening = wellSoftening(body);
    const radius = Math.hypot(
      position.x - body.position.x,
      position.y - body.position.y,
    );
    return (
      sum -
      (((body.kind === "attractor" ? 1 : -1) * body.strength) / softening) *
        Math.atan2(softening, radius)
    );
  }, 0);
}
/** Equal and opposite pair forces preserve momentum for arbitrary masses. */
export function planetAccelerations(
  particles: readonly GravityParticle[],
  bodies: readonly Body[],
  settings: GravityPhysicsSettings,
): Vec2[] {
  const forces = particles.map((p) => gravityForceAt(p.position, bodies));
  if (!settings.planetGravity) return forces;
  for (let i = 0; i < particles.length; i++)
    for (let j = i + 1; j < particles.length; j++) {
      const a = particles[i],
        b = particles[j];
      const dx = b.position.x - a.position.x,
        dy = b.position.y - a.position.y;
      const softening = particleSoftening(a, b);
      const factor =
        settings.planetGravityStrength /
        (dx * dx + dy * dy + softening * softening) ** 1.5;
      forces[i].x += dx * factor * b.mass;
      forces[i].y += dy * factor * b.mass;
      forces[j].x -= dx * factor * a.mass;
      forces[j].y -= dy * factor * a.mass;
    }
  return forces;
}
