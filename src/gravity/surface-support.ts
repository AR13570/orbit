import type { GravityParticle, GravityState } from "./types";
import { GRAVITY_FIXED_STEP, particlePairPotential } from "./physics";

// Numerical contact tolerance only, never an attraction or capture distance.
const SURFACE_EPSILON = 1e-7;
export const RESTING_IMPACT_SPEED = 1;
const IMPULSE_EPSILON = 1e-11;
const solverIterations = (count: number) =>
  Math.max(64, Math.min(1024, count * count * 4));

export function contactKey(a: GravityParticle, b: GravityParticle): string {
  return `${Math.min(a.id, b.id)}:${Math.max(a.id, b.id)}`;
}

/** Only deeply bound, gentle motion can dissipate into a resting surface. */
export function canSettle(
  state: GravityState,
  a: GravityParticle,
  b: GravityParticle,
): boolean {
  if (!state.physics.planetGravity || state.passingContacts?.[contactKey(a, b)])
    return false;
  return boundMotion(state, a, b, 0.5);
}

function boundMotion(
  state: GravityState,
  a: GravityParticle,
  b: GravityParticle,
  fraction: number,
): boolean {
  if (!state.physics.planetGravity) return false;
  const reducedMass = (a.mass * b.mass) / (a.mass + b.mass);
  const speedSquared =
    (b.velocity.x - a.velocity.x) ** 2 + (b.velocity.y - a.velocity.y) ** 2;
  const binding = -particlePairPotential(
    a,
    b,
    state.physics.planetGravityStrength,
  );
  // Merely negative energy is insufficient; each caller reserves a binding
  // margin appropriate for either fresh capture or recovery qualification.
  return 0.5 * reducedMass * speedSquared <= fraction * binding;
}

/** Clear completed passages and qualify trapped, slow ones for gradual recovery. */
export function clearPassingContacts(state: GravityState): void {
  if (!state.passingContacts) return;
  const live = new Map(
    state.particles.filter((p) => p.alive).map((p) => [p.id, p]),
  );
  for (const key of Object.keys(state.passingContacts)) {
    const [aId, bId] = key.split(":").map(Number),
      a = live.get(aId),
      b = live.get(bId);
    const passage = state.passingContacts[key];
    const distance =
      a && b
        ? Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y)
        : Infinity;
    if (
      state.physics.planetCollisions !== "soft" ||
      !a ||
      !b ||
      distance > a.radius + b.radius + SURFACE_EPSILON ||
      (passage.recovering && distance >= a.radius + b.radius - SURFACE_EPSILON)
    ) {
      delete state.passingContacts[key];
      continue;
    }
    // A third-body impact can stop a transit inside another surface. Wait for
    // genuinely slow, deeply bound motion before changing its contact policy.
    // No age alone can capture an energetic passage.
    if (passage.recovering) {
      if (!boundMotion(state, a, b, 0.5)) {
        delete passage.recovering;
        delete passage.slowSince;
      }
    } else if (boundMotion(state, a, b, 0.01)) {
      passage.slowSince ??= state.elapsed;
      if (state.elapsed - passage.slowSince >= 0.35) passage.recovering = true;
    } else delete passage.slowSince;
  }
  if (!Object.keys(state.passingContacts).length) delete state.passingContacts;
}

/** Numerical overlap recovery preserves the pair's center, momentum and spin. */
export function separateSurfaces(
  a: GravityParticle,
  b: GravityParticle,
  maximumCorrection = Infinity,
): number {
  const dx = b.position.x - a.position.x,
    dy = b.position.y - a.position.y;
  const distance = Math.hypot(dx, dy),
    radius = a.radius + b.radius;
  const penetration = Math.min(radius - distance, maximumCorrection);
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
  const change = tangent * (distance / (distance + penetration) - 1);
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
  dt = GRAVITY_FIXED_STEP,
): void {
  clearPassingContacts(state);
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
  const budgets = new Map<string, number>();
  for (
    let iteration = 0;
    iteration < solverIterations(recoverable.length);
    iteration++
  ) {
    let deepest = 0;
    for (let i = 0; i < recoverable.length; i++)
      for (let j = i + 1; j < recoverable.length; j++) {
        const a = recoverable[i],
          b = recoverable[j];
        const key = contactKey(a, b),
          passage = state.passingContacts?.[key];
        if (passage) {
          if (!passage.recovering) continue;
          // Recover the pair's pose at no more than two summed radii/second.
          // Per-step budgets prevent solver iterations from turning this into
          // a projection snap. The central mass-weighted correction preserves
          // COM and transports tangent velocity to conserve angular momentum.
          const remaining = budgets.get(key) ?? (a.radius + b.radius) * 2 * dt;
          const corrected = separateSurfaces(a, b, remaining);
          budgets.set(key, remaining - corrected);
          deepest = Math.max(deepest, corrected);
          continue;
        }
        if (
          !state.passingContacts?.[contactKey(a, b)] &&
          Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y) <
            a.radius + b.radius &&
          (canSettle(state, a, b) ||
            Math.hypot(
              a.velocity.x - b.velocity.x,
              a.velocity.y - b.velocity.y,
            ) <= RESTING_IMPACT_SPEED)
        )
          deepest = Math.max(deepest, separateSurfaces(a, b));
      }
    if (deepest < 1e-10) break;
  }
  clearPassingContacts(state);
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
      const recovering = state.passingContacts?.[contactKey(a, b)]?.recovering;
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
        (!recovering &&
          distance < radius - SURFACE_EPSILON &&
          !(includeImpacts && supported.has(contactKey(a, b)))) ||
        distance > radius + SURFACE_EPSILON
      )
        continue;
      if (
        !(recovering ? boundMotion(state, a, b, 0.5) : canSettle(state, a, b))
      )
        continue;
      const nx = dx / distance,
        ny = dy / distance;
      const normal =
        (b.velocity.x - a.velocity.x) * nx + (b.velocity.y - a.velocity.y) * ny;
      // A supported drift ends with the outward half of its curved path. It
      // may be supported again after the second gravity kick, never pulled back.
      if (
        !recovering &&
        !includeImpacts &&
        !supported.has(contactKey(a, b)) &&
        (normal > IMPULSE_EPSILON || normal < -RESTING_IMPACT_SPEED)
      )
        continue;
      // During gentle pose recovery, support only the current separation.
      // Using the final radius here would inject an outward launch velocity.
      // This cancels compression from subsequent gravity kicks, allowing the
      // bounded positional recovery to progress instead of collapsing again.
      contacts.push({
        a,
        b,
        nx,
        ny,
        distance,
        radius: recovering ? distance : radius,
        impulse: 0,
      });
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
