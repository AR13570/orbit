import { planetAccelerations, WELL_SOFTENING } from "./physics";
import type { GravityParticle, GravityState } from "./types";

// Visible, gentle orientation drift: one revolution in about 52 physical seconds.
const MINIMUM_SPIN = 0.12;
const SPIN_ACCELERATION = 0.02;
const SETTLE_SECONDS = 0.35;
// Numerical surface proximity only. This does not extend collision/capture range.
const SURFACE_TOLERANCE = 1e-6;

/**
 * Optional gameplay torque, deliberately absent from pure createState reference
 * worlds. Uses real velocities in the shared step so prediction and play agree.
 * It preserves linear momentum, but intentionally adds angular momentum.
 * Qualification is disposable history, never a constraint or a contact bond.
 */
export function assistGroupSpin(
  state: GravityState,
  particles: GravityParticle[],
  dt: number,
): void {
  const history = state.groupSpin;
  if (!history) return;
  const physicsKey = JSON.stringify(state.physics);
  if (history.physicsKey !== physicsKey) {
    history.groups = {};
    history.directions = {};
    history.physicsKey = physicsKey;
  }
  if (
    !state.physics.planetGravity ||
    state.physics.planetCollisions !== "soft"
  ) {
    history.groups = {};
    history.directions = {};
    return;
  }
  const neighbors = particles.map(() => [] as number[]);
  let hasContacts = false;
  for (let a = 0; a < particles.length; a++)
    for (let b = a + 1; b < particles.length; b++) {
      const p = particles[a],
        q = particles[b];
      const dx = q.position.x - p.position.x,
        dy = q.position.y - p.position.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 1e-12) continue;
      const radius = p.radius + q.radius;
      const tangent =
        ((q.velocity.y - p.velocity.y) * dx -
          (q.velocity.x - p.velocity.x) * dy) /
        distance;
      // An unsolved tangent drift can finish a tiny chord gap above the true
      // surface. Recognize only that numerical error, capped at the gentle
      // floor so fast flybys cannot expand qualification's proximity window.
      // This does not change collision geometry or actual capture behavior.
      const sideways = Math.min(Math.abs(tangent), MINIMUM_SPIN * radius) * dt;
      const tolerance = Math.max(
        SURFACE_TOLERANCE,
        Math.hypot(radius, sideways) - radius + 1e-7,
      );
      if (
        distance < radius - SURFACE_TOLERANCE ||
        distance > radius + tolerance
      )
        continue;
      neighbors[a].push(b);
      neighbors[b].push(a);
      hasContacts = true;
    }
  const next: Record<string, number> = {};
  const nextDirections: Record<string, number> = {};
  const visited = new Set<number>();
  // Compute actual gravity, including external tides, only if contacts exist.
  const accelerations = hasContacts
    ? planetAccelerations(particles, state.level.bodies, state.physics)
    : [];
  for (let start = 0; start < particles.length; start++) {
    if (visited.has(start) || !neighbors[start].length) continue;
    const members = [start];
    visited.add(start);
    for (let i = 0; i < members.length; i++)
      for (const neighbor of neighbors[members[i]])
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          members.push(neighbor);
        }
    // Walk each component edge once, avoiding a whole-world rescan per group.
    const edges = members.flatMap((a) =>
      neighbors[a]
        .filter((b) => a < b)
        .map((b) => {
          const dx = particles[b].position.x - particles[a].position.x;
          const dy = particles[b].position.y - particles[a].position.y;
          const distance = Math.hypot(dx, dy);
          return { a, b, distance, nx: dx / distance, ny: dy / distance };
        }),
    );
    let mass = 0,
      cx = 0,
      cy = 0,
      vx = 0,
      vy = 0;
    for (const i of members) {
      const p = particles[i];
      mass += p.mass;
      cx += p.mass * p.position.x;
      cy += p.mass * p.position.y;
      vx += p.mass * p.velocity.x;
      vy += p.mass * p.velocity.y;
    }
    cx /= mass;
    cy /= mass;
    vx /= mass;
    vy /= mass;
    let inertia = 0,
      angular = 0;
    for (const i of members) {
      const p = particles[i],
        x = p.position.x - cx,
        y = p.position.y - cy;
      inertia += p.mass * (x * x + y * y);
      angular += p.mass * (x * (p.velocity.y - vy) - y * (p.velocity.x - vx));
    }
    if (inertia < 1e-12) continue;
    const omega = angular / inertia;
    const key = members
      .map((i) => particles[i].id)
      .sort((a, b) => a - b)
      .join(":");
    const slow = Math.abs(omega) < MINIMUM_SPIN;
    let ax = 0,
      ay = 0;
    for (const i of members) {
      ax += (particles[i].mass * accelerations[i].x) / mass;
      ay += (particles[i].mass * accelerations[i].y) / mass;
    }
    let residual = 0,
      beforeHalfKickResidual = 0;
    for (const i of members) {
      const p = particles[i],
        x = p.position.x - cx,
        y = p.position.y - cy;
      const rx = p.velocity.x - vx + omega * y;
      const ry = p.velocity.y - vy - omega * x;
      residual += p.mass * (rx * rx + ry * ry);
      const beforeX = rx - (accelerations[i].x - ax) * dt * 0.5;
      const beforeY = ry - (accelerations[i].y - ay) * dt * 0.5;
      beforeHalfKickResidual +=
        p.mass * (beforeX * beforeX + beforeY * beforeY);
    }
    // Reject shear, radial impacts and other internal motion before counting
    // settled time. Allow only 10% of the floor's rotational RMS speed.
    const residualLimit = Math.max(
      0.02,
      0.1 * MINIMUM_SPIN * Math.sqrt(inertia / mass),
    );
    // A numerical near-surface gap can leave the previous inward gravity
    // half-kick unsolved. For qualification only, also inspect the velocity
    // before that known kick. The contact-normal gate below bounds this
    // allowance to compression from one half-kick, never outward separation.
    // Neither candidate changes physical velocities or contact handling.
    if (Math.min(residual, beforeHalfKickResidual) / mass > residualLimit ** 2)
      continue;
    let direction = Math.sign(omega);
    if (Math.abs(omega) < 1e-6 && history.directions?.[key]) {
      direction = history.directions[key];
    } else if (Math.abs(omega) < 1e-6) {
      let strongest = 0;
      direction = 1; // Clockwise in canvas coordinates, deterministic at rest.
      for (const body of state.level.bodies) {
        if (body.kind !== "attractor") continue;
        const x = cx - body.position.x,
          y = cy - body.position.y;
        const force = body.strength / (x * x + y * y + WELL_SOFTENING ** 2);
        if (force > strongest) {
          strongest = force;
          direction = Math.sign(x * vy - y * vx) || 1;
        }
      }
    }
    let angularAcceleration = 0;
    for (const i of members) {
      const p = particles[i];
      angularAcceleration +=
        (p.mass *
          ((p.position.x - cx) * accelerations[i].y -
            (p.position.y - cy) * accelerations[i].x)) /
        inertia;
    }
    // Internal central forces cancel from this component's torque. Cancel
    // only opposing external tides below the floor, then add the gentle ramp.
    // Thus total angular injection is bounded by ramp + measured opposition,
    // not ramp alone. Existing fast rotation receives no torque or damping.
    const opposition = slow ? Math.max(0, -direction * angularAcceleration) : 0;
    const remaining = slow
      ? direction * MINIMUM_SPIN - omega + direction * opposition * dt
      : 0;
    // Check the entire component at the target spin, using the potential that
    // matches the softened mutual force. Pair checks alone do not certify the
    // energy of a larger component. No external well binding substitutes for
    // the group's own negative internal energy.
    let fullKinetic = 0,
      potential = 0;
    for (let index = 0; index < members.length; index++) {
      const p = particles[members[index]];
      const fullX = p.velocity.x - vx - remaining * (p.position.y - cy);
      const fullY = p.velocity.y - vy + remaining * (p.position.x - cx);
      fullKinetic += 0.5 * p.mass * (fullX * fullX + fullY * fullY);
      for (let other = index + 1; other < members.length; other++) {
        const q = particles[members[other]];
        const dx = q.position.x - p.position.x,
          dy = q.position.y - p.position.y;
        const softening = Math.max(2, (p.radius + q.radius) * 0.5);
        potential -=
          (state.physics.planetGravityStrength * p.mass * q.mass) /
          Math.sqrt(dx * dx + dy * dy + softening * softening);
      }
    }
    if (1.25 * fullKinetic + potential >= 0) continue;
    const safe = edges.every((c) => {
      const p = particles[c.a],
        q = particles[c.b];
      const dx = q.position.x - p.position.x,
        dy = q.position.y - p.position.y;
      const fullX = q.velocity.x - p.velocity.x - remaining * dy;
      const fullY = q.velocity.y - p.velocity.y + remaining * dx;
      const normal =
        (q.velocity.x - p.velocity.x) * c.nx +
        (q.velocity.y - p.velocity.y) * c.ny;

      const softening = Math.max(2, (p.radius + q.radius) * 0.5);
      const escapeSquared =
        (2 * state.physics.planetGravityStrength * (p.mass + q.mass)) /
        Math.sqrt(c.distance ** 2 + softening ** 2);
      const fullSpeedSquared = fullX * fullX + fullY * fullY;
      const inward = -(
        (accelerations[c.b].x - accelerations[c.a].x) * c.nx +
        (accelerations[c.b].y - accelerations[c.a].y) * c.ny
      );
      if (
        normal > residualLimit ||
        normal < -Math.max(0, inward) * dt * 0.5 - residualLimit
      )
        return false;
      // Reserve 25% force/energy margin for the FULL boost. A merely bound
      // pair may still lack centripetal support and must separate freely.
      return (
        fullSpeedSquared * 1.25 < escapeSquared &&
        (fullSpeedSquared / c.distance) * 1.25 < inward
      );
    });
    if (!safe) continue;
    const age = (history.groups[key] ?? 0) + dt;
    next[key] = age;
    if (age >= SETTLE_SECONDS) nextDirections[key] = direction;
    if (!slow) continue;
    const assistedSeconds = Math.min(dt, Math.max(0, age - SETTLE_SECONDS));
    if (assistedSeconds < 1e-12) continue;
    const change =
      direction *
      (Math.min(
        MINIMUM_SPIN - Math.abs(omega),
        SPIN_ACCELERATION * assistedSeconds,
      ) +
        opposition * assistedSeconds);
    for (const i of members) {
      const p = particles[i];
      p.velocity.x -= change * (p.position.y - cy);
      p.velocity.y += change * (p.position.x - cx);
    }
  }
  history.groups = next;
  history.directions = nextDirections;
}
