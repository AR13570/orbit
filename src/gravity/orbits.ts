import type { Vec2 } from "../game/types";
import { updateJourney } from "./journeys";
import { wellVelocity } from "./motion";
import { wellPotential } from "./physics";
import type {
  GoalProgress,
  GravityLevel,
  GravityOrbitRequirement,
  GravityParticle,
  GravityState,
  OrbitTrack,
} from "./types";
export const TAU = Math.PI * 2;
const FIRST_LAP_EXTRA = 0.2;
/** Validate the initial orbit, then credit each additional complete revolution. */
function creditedWinding(winding: number): number {
  return (
    Math.sign(winding) * Math.max(0, Math.abs(winding) - TAU * FIRST_LAP_EXTRA)
  );
}
function sharedOrbiter(
  state: GravityState,
  particle: GravityParticle,
  turns: number,
): boolean {
  return (
    particle.alive &&
    boundTo(state, particle, "pair") &&
    state.level.sharedOrbit!.every(
      (id) =>
        Math.abs(creditedWinding(particle.orbits[id]?.winding ?? 0)) + 1e-9 >=
        TAU * turns,
    )
  );
}
export function orbitTargets(
  level: GravityLevel,
): { id: string; position: Vec2 }[] {
  const bodies = level.bodies
    .filter((b) => b.kind === "attractor")
    .map((b) => ({ id: b.id, position: b.position }));
  if (level.objective.kind === "tour" && bodies.length > 1)
    bodies.push({
      id: "pair",
      position: {
        x: (bodies[0].position.x + bodies[1].position.x) / 2,
        y: (bodies[0].position.y + bodies[1].position.y) / 2,
      },
    });
  return bodies;
}
export function initialOrbits(
  level: GravityLevel,
  position: Vec2,
): Record<string, OrbitTrack> {
  return Object.fromEntries(
    orbitTargets(level).map((t) => [
      t.id,
      {
        angle: Math.atan2(position.y - t.position.y, position.x - t.position.x),
        winding: 0,
        localWinding: 0,
        lapStart: 0,
        lapBaseline: {},
      },
    ]),
  );
}
export function updateOrbits(
  level: GravityLevel,
  particle: GravityParticle,
): void {
  updateJourney(level, particle);
  const targets = orbitTargets(level);
  for (const target of targets) {
    const track = particle.orbits[target.id];
    if (!track) continue;
    const angle = Math.atan2(
      particle.position.y - target.position.y,
      particle.position.x - target.position.x,
    );
    track.winding += Math.atan2(
      Math.sin(angle - track.angle),
      Math.cos(angle - track.angle),
    );
    track.angle = angle;
  }
  for (const target of targets) {
    if (target.id === "pair") continue;
    const track = particle.orbits[target.id],
      lap = track.winding - track.lapStart;
    const lapLength = TAU * (track.lapStart === 0 ? 1 + FIRST_LAP_EXTRA : 1);
    if (Math.abs(lap) + 1e-9 < lapLength) continue;
    const shared = targets.some(
      (other) =>
        other.id !== target.id &&
        other.id !== "pair" &&
        Math.abs(
          particle.orbits[other.id].winding -
            (track.lapBaseline[other.id] ?? 0),
        ) >=
          TAU * 0.75,
    );
    if (!shared)
      for (const other of targets)
        if (other.id !== target.id) particle.orbits[other.id].localWinding = 0;
    track.localWinding = shared ? 0 : track.localWinding + Math.sign(lap) * TAU;
    // Keep the exact crossing so fixed-step overshoot cannot accumulate per lap.
    track.lapStart += Math.sign(lap) * lapLength;
    track.lapBaseline = Object.fromEntries(
      targets.map((other) => [other.id, particle.orbits[other.id].winding]),
    );
  }
}
function boundTo(
  state: GravityState,
  particle: GravityParticle,
  id: string,
): boolean {
  const bodies =
    id === "pair"
      ? state.level.bodies
      : state.level.bodies.filter((b) => b.id === id);
  if (!bodies.length) return false;
  const velocities = bodies.map((body) =>
    wellVelocity(state.level, body.id, state.elapsed),
  );
  const velocity = {
    x: velocities.reduce((sum, v) => sum + v.x, 0) / velocities.length,
    y: velocities.reduce((sum, v) => sum + v.y, 0) / velocities.length,
  };
  return (
    0.5 *
      ((particle.velocity.x - velocity.x) ** 2 +
        (particle.velocity.y - velocity.y) ** 2) +
      wellPotential(particle.position, bodies) <
    0
  );
}
function qualifies(
  state: GravityState,
  particle: GravityParticle,
  requirement: GravityOrbitRequirement,
  local: boolean,
): boolean {
  const track = particle.orbits[requirement.bodyId];
  if (
    !particle.alive ||
    !track ||
    !boundTo(state, particle, requirement.bodyId)
  )
    return false;
  const winding = local ? track.localWinding : creditedWinding(track.winding);
  const turns = requirement.turns ?? state.level.objective.turns;
  if (Math.abs(winding) + 1e-9 < TAU * Math.max(0.01, turns)) return false;
  return requirement.direction === "clockwise"
    ? winding > 0
    : requirement.direction === "counterclockwise"
      ? winding < 0
      : true;
}
function assign(
  state: GravityState,
  requirements: GravityOrbitRequirement[],
): { current: number; bodies: NonNullable<GoalProgress["bodies"]> } {
  const slots = requirements.flatMap((r) =>
    Array.from({ length: Math.max(0, Math.floor(r.count)) }, () => r),
  );
  const assigned = new Map<number, number>();
  function match(slot: number, seen: Set<number>): boolean {
    for (const particle of state.particles) {
      if (
        seen.has(particle.id) ||
        !qualifies(state, particle, slots[slot], true)
      )
        continue;
      seen.add(particle.id);
      const previous = assigned.get(particle.id);
      if (previous === undefined || match(previous, seen)) {
        assigned.set(particle.id, slot);
        return true;
      }
    }
    return false;
  }
  slots.forEach((_, i) => match(i, new Set()));
  return {
    current: assigned.size,
    bodies: requirements.map((r) => ({
      bodyId: r.bodyId,
      target: r.count,
      current: [...assigned.values()].filter((i) => slots[i] === r).length,
    })),
  };
}
export function goalProgress(state: GravityState): GoalProgress {
  const goal = state.level.objective;
  if (goal.kind === "none" && !state.level.requirements?.length)
    return { current: 0, target: 0, held: 0, hold: 0, complete: false };
  if (state.level.journey) {
    const legs = state.level.journey.legs;
    const living = state.particles.filter((p) => p.alive);
    const current = living.filter(
      (p) => (p.journey?.leg ?? 0) >= legs.length,
    ).length;
    const best = Math.max(0, ...living.map((p) => p.journey?.leg ?? 0));
    return {
      current: Math.min(current, goal.count),
      target: goal.count,
      complete: current >= goal.count,
      held: 0,
      hold: 0,
      bodies: [...new Set(legs.map((leg) => leg.bodyId))].map((bodyId) => ({
        bodyId,
        current: legs.slice(0, best).filter((leg) => leg.bodyId === bodyId)
          .length,
        target: legs.filter((leg) => leg.bodyId === bodyId).length,
      })),
    };
  }
  if (state.level.sharedOrbit?.length) {
    const orbiters = state.particles.filter((p) =>
      sharedOrbiter(state, p, goal.turns),
    );
    const current = state.level.sharedCounter
      ? Number(
          orbiters.some(
            (p) => p.orbits[state.level.sharedOrbit![0]].winding > 0,
          ),
        ) +
        Number(
          orbiters.some(
            (p) => p.orbits[state.level.sharedOrbit![0]].winding < 0,
          ),
        )
      : orbiters.length;
    return {
      current: Math.min(current, goal.count),
      target: goal.count,
      complete: current >= goal.count,
      held: 0,
      hold: 0,
    };
  }
  const bodies = state.level.bodies.filter((b) => b.kind === "attractor");
  let current = 0,
    target = goal.count,
    perBody: GoalProgress["bodies"];
  if (state.level.requirements?.length || goal.kind === "paired") {
    const requirements =
      state.level.requirements ??
      bodies.map((b) => ({ bodyId: b.id, count: 1 }));
    const result = assign(state, requirements);
    current = result.current;
    perBody = result.bodies;
    target = requirements.reduce(
      (sum, r) => sum + Math.max(0, Math.floor(r.count)),
      0,
    );
  } else if (goal.kind === "tour") {
    current = state.particles.filter((p) =>
      qualifies(state, p, { bodyId: "pair", count: 1 }, false),
    ).length;
  } else
    for (const body of bodies) {
      const orbiters = state.particles.filter((p) =>
        qualifies(state, p, { bodyId: body.id, count: 1 }, false),
      );
      const score =
        goal.kind === "counter"
          ? Number(orbiters.some((p) => p.orbits[body.id].winding > 0)) +
            Number(orbiters.some((p) => p.orbits[body.id].winding < 0))
          : orbiters.length;
      current = Math.max(current, score);
    }
  return {
    current: Math.min(current, target),
    target,
    held: 0,
    hold: 0,
    complete: target > 0 && current >= target,
    ...(perBody ? { bodies: perBody } : {}),
  };
}
/** Core numbers show recognized particles, independently of the level's lap target. */
export function orbitingCount(state: GravityState, id: string): number {
  if (state.level.journey)
    return (
      goalProgress(state).bodies?.find((body) => body.bodyId === id)?.current ??
      0
    );
  if (state.level.sharedOrbit?.includes(id))
    return state.particles.filter((p) => sharedOrbiter(state, p, 1)).length;
  const requirements = state.level.requirements?.filter((r) => r.bodyId === id);
  const local = Boolean(
    state.level.requirements?.length || state.level.objective.kind === "paired",
  );
  return state.particles.filter((p) =>
    (requirements?.length ? requirements : [{ bodyId: id, count: 1 }]).some(
      (r) => qualifies(state, p, { ...r, turns: 1 }, local),
    ),
  ).length;
}
export function orbitFraction(
  state: GravityState,
  particle: GravityParticle,
  id: string,
): number {
  if (state.level.journey) {
    const legs = state.level.journey.legs;
    const track = particle.journey;
    if (!track || !particle.alive) return 0;
    const indices = legs.flatMap((leg, index) =>
      leg.bodyId === id ? [index] : [],
    );
    const completed = indices.filter((index) => index < track.leg).length;
    const current =
      legs[track.leg]?.bodyId === id
        ? Math.min(1, Math.abs(track.sweep) / legs[track.leg].sweep)
        : 0;
    return indices.length ? (completed + current) / indices.length : 0;
  }
  if (state.level.sharedOrbit?.includes(id)) {
    if (!particle.alive || !boundTo(state, particle, "pair")) return 0;
    return Math.min(
      1,
      Math.abs(creditedWinding(particle.orbits[id]?.winding ?? 0)) /
        (TAU * state.level.objective.turns),
    );
  }
  const track = particle.orbits[id];
  if (!track || !particle.alive || !boundTo(state, particle, id)) return 0;
  const local =
    state.level.requirements?.length || state.level.objective.kind === "paired";
  const winding = local
    ? Math.min(
        Math.abs(track.winding),
        Math.abs(
          track.localWinding +
            (track.lapStart === 0
              ? creditedWinding(track.winding)
              : track.winding - track.lapStart),
        ),
      )
    : Math.abs(creditedWinding(track.winding));
  const turns =
    state.level.requirements?.find((r) => r.bodyId === id)?.turns ??
    state.level.objective.turns;
  const target = TAU * Math.max(0.01, turns);
  return winding + 1e-9 >= target ? 1 : winding / target;
}
