import { segmentCircleIntersection } from "../game/physics";
import type { Vec2 } from "../game/types";
import type { GravityParticle, GravityState } from "./types";
import { initialOrbits } from "./orbits";
import {
  contactKey,
  separateSurfaces,
  surfaceContacts,
  supportSurfaces,
} from "./surface-support";

const ORIGIN = { x: 0, y: 0 };
const CONTACT_EPSILON = 1e-9;
type ContactEvent =
  | { time: number; kind: "well"; planet: GravityParticle }
  | { time: number; kind: "planet"; a: GravityParticle; b: GravityParticle };

function advance(particles: GravityParticle[], seconds: number): void {
  for (const p of particles)
    if (p.alive) {
      p.position.x += p.velocity.x * seconds;
      p.position.y += p.velocity.y * seconds;
    }
}
function planetContact(
  a: GravityParticle,
  b: GravityParticle,
  remaining: number,
  merge: boolean,
): number | null {
  const dx = b.position.x - a.position.x,
    dy = b.position.y - a.position.y;
  const vx = b.velocity.x - a.velocity.x,
    vy = b.velocity.y - a.velocity.y;
  const radius = a.radius + b.radius,
    distance = Math.hypot(dx, dy);
  // A separating/tangent surface contact cannot cause another impact at t=0.
  // True initial penetration still receives a center of mass preserving correction.
  if (
    !merge &&
    distance >= radius - CONTACT_EPSILON &&
    dx * vx + dy * vy >= -CONTACT_EPSILON
  )
    return null;
  if (distance <= radius + CONTACT_EPSILON) return 0;
  const fraction = segmentCircleIntersection(
    { x: dx, y: dy },
    { x: dx + vx * remaining, y: dy + vy * remaining },
    ORIGIN,
    radius,
  );
  return fraction === null ? null : fraction * remaining;
}
function resolvePlanet(
  state: GravityState,
  a: GravityParticle,
  b: GravityParticle,
): void {
  if (state.physics.planetCollisions === "merge") {
    const mass = a.mass + b.mass;
    a.position = {
      x: (a.position.x * a.mass + b.position.x * b.mass) / mass,
      y: (a.position.y * a.mass + b.position.y * b.mass) / mass,
    };
    a.velocity = {
      x: (a.velocity.x * a.mass + b.velocity.x * b.mass) / mass,
      y: (a.velocity.y * a.mass + b.velocity.y * b.mass) / mass,
    };
    a.radius = Math.cbrt(a.radius ** 3 + b.radius ** 3);
    a.mass = mass;
    b.alive = false;
    a.orbits = initialOrbits(state.level, a.position);
    return;
  }
  const dx = b.position.x - a.position.x,
    dy = b.position.y - a.position.y,
    length = Math.hypot(dx, dy);
  const nx = length > CONTACT_EPSILON ? dx / length : 1,
    ny = length > CONTACT_EPSILON ? dy / length : 0;
  const relative =
    (b.velocity.x - a.velocity.x) * nx + (b.velocity.y - a.velocity.y) * ny;
  if (relative < 0) {
    // Soft contacts transfer approaching normal momentum without rebound.
    // Tangential motion remains free, so sliding and separation are possible.
    const restitution = state.physics.planetCollisions === "soft" ? 0 : 1;
    const impulse = (-(1 + restitution) * relative) / (1 / a.mass + 1 / b.mass);
    a.velocity.x -= (impulse * nx) / a.mass;
    a.velocity.y -= (impulse * ny) / a.mass;
    b.velocity.x += (impulse * nx) / b.mass;
    b.velocity.y += (impulse * ny) / b.mass;
  }
  if (state.physics.planetCollisions === "soft") {
    separateSurfaces(a, b);
    return;
  }
  const penetration = Math.max(0, a.radius + b.radius - length),
    mass = a.mass + b.mass;
  a.position.x -= (nx * penetration * b.mass) / mass;
  a.position.y -= (ny * penetration * b.mass) / mass;
  b.position.x += (nx * penetration * a.mass) / mass;
  b.position.y += (ny * penetration * a.mass) / mass;
}

/**
 * Drift all planets together, resolving the earliest competing contact first.
 * Each subsequent sweep starts at the event pose with only the remaining time.
 * Wells move linearly between their kinematic poses for this fixed step.
 */
export function driftWithContacts(
  state: GravityState,
  particles: GravityParticle[],
  previousBodies: Map<string, Vec2>,
  dt: number,
  supported: Set<string> = new Set(),
): void {
  let elapsed = 0;
  const wells = state.physics.bodyCollisions
    ? state.level.bodies.map((body) => {
        const start = previousBodies.get(body.id) ?? body.position;
        return {
          body,
          start,
          velocity: {
            x: (body.position.x - start.x) / dt,
            y: (body.position.y - start.y) / dt,
          },
        };
      })
    : [];
  const planetContacts = state.physics.planetCollisions !== "none";
  // Conservative bound for pathological simultaneous overlap clusters. On
  // exhaustion retain the current contact pose/velocities for the next step,
  // rather than advancing unchecked through wells or replaying elapsed time.
  const budget = Math.max(64, particles.length * 16);
  for (let events = 0; events < budget; events++) {
    // Zero drift time still permits simultaneous contacts and touching impact
    // chains at the endpoint. Separating contacts are excluded above, and the
    // same event budget bounds any zero time overlap resolution.
    const remaining = Math.max(0, dt - elapsed);
    let event: ContactEvent | undefined;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!p.alive) continue;
      for (const well of wells) {
        const from = {
          x: p.position.x - well.start.x - well.velocity.x * elapsed,
          y: p.position.y - well.start.y - well.velocity.y * elapsed,
        };
        const to = {
          x: from.x + (p.velocity.x - well.velocity.x) * remaining,
          y: from.y + (p.velocity.y - well.velocity.y) * remaining,
        };
        const radius = well.body.radius + p.radius;
        const fraction =
          Math.hypot(from.x, from.y) <= radius + CONTACT_EPSILON
            ? 0
            : segmentCircleIntersection(from, to, ORIGIN, radius);
        if (fraction !== null) {
          const time = fraction * remaining;
          if (!event || time < event.time)
            event = { time, kind: "well", planet: p };
        }
      }
      if (planetContacts)
        for (let j = i + 1; j < particles.length; j++) {
          const other = particles[j];
          if (!other.alive) continue;
          if (supported.has(contactKey(p, other))) continue;
          const time = planetContact(
            p,
            other,
            remaining,
            state.physics.planetCollisions === "merge",
          );
          if (time !== null && (!event || time < event.time))
            event = { time, kind: "planet", a: p, b: other };
        }
    }
    if (!event) {
      advance(particles, remaining);
      return;
    }
    advance(particles, event.time);
    elapsed += event.time;
    if (event.kind === "well") event.planet.alive = false;
    else resolvePlanet(state, event.a, event.b);
    // A third-body impact changes the surface trajectory. Its neighbouring
    // contacts must participate in the next sweep and propagate the impact.
    const changed = event.kind === "well" ? [event.planet] : [event.a, event.b];
    if (state.physics.planetCollisions === "soft") {
      // A simultaneous impact is a contact-island problem. Resolving touching
      // neighbours one pair at a time can create an endless sequence of zero
      // time impacts, starving the entire world's drift. Propagate compression
      // through all touching surfaces before the next continuous sweep.
      const live = particles.filter((p) => p.alive);
      const islandSupport = supportSurfaces(
        surfaceContacts(state, live, supported, true),
        Math.max(0, dt - elapsed),
      );
      supported.clear();
      for (const key of islandSupport) supported.add(key);
    } else {
      for (const p of changed)
        for (const other of particles) supported.delete(contactKey(p, other));
    }
  }
  // Held planets cannot tunnel through one another after budget exhaustion,
  // but kinematic wells still sweep their remaining motion against that pose.
  for (const p of particles)
    if (p.alive)
      for (const well of wells) {
        const from = {
          x: p.position.x - well.start.x - well.velocity.x * elapsed,
          y: p.position.y - well.start.y - well.velocity.y * elapsed,
        };
        const to = {
          x: p.position.x - well.body.position.x,
          y: p.position.y - well.body.position.y,
        };
        if (
          segmentCircleIntersection(
            from,
            to,
            ORIGIN,
            well.body.radius + p.radius,
          ) !== null
        ) {
          p.alive = false;
          break;
        }
      }
}
