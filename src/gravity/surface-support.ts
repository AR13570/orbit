import type { GravityParticle, GravityState } from "./types";

// Numerical contact tolerance only, never an attraction or capture distance.
const SURFACE_EPSILON = 1e-7;
export const RESTING_IMPACT_SPEED = 1;
const IMPULSE_EPSILON = 1e-11;
const solverIterations = (count: number) =>
  Math.max(64, Math.min(1024, count * count * 4));

export function contactKey(a: GravityParticle, b: GravityParticle): string {
  return `${Math.min(a.id, b.id)}:${Math.max(a.id, b.id)}`;
}

/** Numerical overlap recovery preserves the pair's center, momentum and spin. */
export function separateSurfaces(
  a: GravityParticle,
  b: GravityParticle,
): number {
  const dx = b.position.x - a.position.x,
    dy = b.position.y - a.position.y;
  const distance = Math.hypot(dx, dy),
    radius = a.radius + b.radius;
  const penetration = radius - distance;
  if (penetration <= 0) return 0;
  const nx = distance > 1e-12 ? dx / distance : 1;
  const ny = distance > 1e-12 ? dy / distance : 0;
  const mass = a.mass + b.mass;
  a.position.x -= (nx * penetration * b.mass) / mass;
  a.position.y -= (ny * penetration * b.mass) / mass;
  b.position.x += (nx * penetration * a.mass) / mass;
  b.position.y += (ny * penetration * a.mass) / mass;
  // L = reducedMass * distance * relativeTangentialSpeed. A radial position
  // repair changes distance, so transport the tangential velocity to preserve L.
  // This corrects the discretized pose, not physical friction between surfaces.
  const tangent =
    (b.velocity.x - a.velocity.x) * -ny + (b.velocity.y - a.velocity.y) * nx;
  const change = tangent * (distance / radius - 1);
  a.velocity.x -= (-ny * change * b.mass) / mass;
  a.velocity.y -= (nx * change * b.mass) / mass;
  b.velocity.x += (-ny * change * a.mass) / mass;
  b.velocity.y += (nx * change * a.mass) / mass;
  return penetration;
}

/** Resolve invalid starting overlaps without consuming the step's drift time. */
export function recoverSurfaceOverlaps(
  state: GravityState,
  particles: GravityParticle[],
): void {
  if (state.physics.planetCollisions !== "soft") return;
  // Swept core absorption has priority at t=0. Do not repair an invalid planet
  // overlap by moving a planet out of a core that already contains it.
  const recoverable = state.physics.bodyCollisions
    ? particles.filter(
        (p) =>
          !state.level.bodies.some(
            (body) =>
              Math.hypot(
                p.position.x - body.position.x,
                p.position.y - body.position.y,
              ) <=
              body.radius + p.radius,
          ),
      )
    : particles;
  for (
    let iteration = 0;
    iteration < solverIterations(recoverable.length);
    iteration++
  ) {
    let deepest = 0;
    for (let i = 0; i < recoverable.length; i++)
      for (let j = i + 1; j < recoverable.length; j++)
        deepest = Math.max(
          deepest,
          separateSurfaces(recoverable[i], recoverable[j]),
        );
    if (deepest < 1e-10) break;
  }
}

interface SurfaceContact {
  a: GravityParticle;
  b: GravityParticle;
  nx: number;
  ny: number;
  distance: number;
  radius: number;
  impulse: number;
}

/** Gather before the kick, so gravity cannot turn a fast impact into support. */
export function surfaceContacts(
  state: GravityState,
  particles: GravityParticle[],
  supported: ReadonlySet<string> = new Set(),
  includeImpacts = false,
): SurfaceContact[] {
  if (state.physics.planetCollisions !== "soft") return [];
  const contacts: SurfaceContact[] = [];
  for (let i = 0; i < particles.length; i++)
    for (let j = i + 1; j < particles.length; j++) {
      const a = particles[i],
        b = particles[j];
      if (!a.alive || !b.alive) continue;
      const dx = b.position.x - a.position.x,
        dy = b.position.y - a.position.y;
      const distance = Math.hypot(dx, dy),
        radius = a.radius + b.radius;
      // An intervening impact can occur partway along a supported chord, whose
      // interior lies slightly inside the curved surface. Rebuild that known
      // contact's remaining chord from its current pose instead of projecting
      // the entire island's positions and introducing new gaps/impact events.
      // Newly approaching pairs still qualify only at their actual surface.
      if (
        (distance < radius - SURFACE_EPSILON &&
          !(includeImpacts && supported.has(contactKey(a, b)))) ||
        distance > radius + SURFACE_EPSILON
      )
        continue;
      const nx = dx / distance,
        ny = dy / distance;
      const normal =
        (b.velocity.x - a.velocity.x) * nx + (b.velocity.y - a.velocity.y) * ny;
      // A supported drift ends with the outward half of its curved path. It
      // may be supported again after the second gravity kick, never pulled back.
      if (
        !includeImpacts &&
        !supported.has(contactKey(a, b)) &&
        (normal > IMPULSE_EPSILON || normal < -RESTING_IMPACT_SPEED)
      )
        continue;
      contacts.push({ a, b, nx, ny, distance, radius, impulse: 0 });
    }
  return contacts;
}

/**
 * One-sided, frictionless contact impulses after a gravity kick. During drift,
 * retain the inward velocity needed to follow a surface chord. At its endpoint
 * remove inward surface velocity. The clamped impulse cannot supply tension:
 * centrifugal separation and outward impacts release the contact naturally.
 * All impulses are central and equal/opposite, preserving linear/angular momentum.
 */
export function supportSurfaces(
  contacts: SurfaceContact[],
  driftSeconds: number,
): Set<string> {
  for (
    let iteration = 0;
    iteration < solverIterations(contacts.length);
    iteration++
  ) {
    let largestChange = 0;
    for (const c of contacts) {
      const vx = c.b.velocity.x - c.a.velocity.x,
        vy = c.b.velocity.y - c.a.velocity.y;
      const normal = vx * c.nx + vy * c.ny;
      const tangent = vx * -c.ny + vy * c.nx;
      const sideways = tangent * driftSeconds;
      // No surface-following chord exists at this speed and step size.
      if (Math.abs(sideways) >= c.radius) continue;
      const target =
        driftSeconds > 0
          ? (Math.sqrt(c.radius * c.radius - sideways * sideways) -
              c.distance) /
            driftSeconds
          : 0;
      const inverseMass = 1 / c.a.mass + 1 / c.b.mass;
      const impulse = Math.max(0, c.impulse + (target - normal) / inverseMass);
      const change = impulse - c.impulse;
      c.impulse = impulse;
      c.a.velocity.x -= (change * c.nx) / c.a.mass;
      c.a.velocity.y -= (change * c.ny) / c.a.mass;
      c.b.velocity.x += (change * c.nx) / c.b.mass;
      c.b.velocity.y += (change * c.ny) / c.b.mass;
      largestChange = Math.max(largestChange, Math.abs(change));
    }
    if (largestChange < IMPULSE_EPSILON) break;
  }
  return new Set(
    contacts
      .filter((c) => {
        const vx = c.b.velocity.x - c.a.velocity.x,
          vy = c.b.velocity.y - c.a.velocity.y;
        const normal = vx * c.nx + vy * c.ny;
        const sideways = (vx * -c.ny + vy * c.nx) * driftSeconds;
        // An already solved neighbour may need no additional impulse when an
        // island is revisited. Keep its admissible chord out of zero-time CCD
        // too; eligibility depends on this drift's endpoint, never history.
        if (driftSeconds === 0 || Math.abs(sideways) >= c.radius)
          return normal >= -IMPULSE_EPSILON;
        const target =
          (Math.sqrt(c.radius * c.radius - sideways * sideways) - c.distance) /
          driftSeconds;
        return normal >= target - IMPULSE_EPSILON;
      })
      .map((c) => contactKey(c.a, c.b)),
  );
}
