import {
  distance,
  segmentCircleIntersection,
  SHIP_RADIUS,
} from "../game/physics";
import {
  gravityForceAt,
  gravityLaunchSpeed,
  GRAVITY_SPEED_SCALE,
} from "./physics";
import type { Aim, Vec2 } from "../game/types";
import type {
  GravityLevel,
  GravityParticle,
  GravityState,
  GoalProgress,
  OrbitTrack,
} from "./types";
export const TRAIL_SECONDS = 3;
export const MAX_PROJECTILES = 12;
const TAU = Math.PI * 2;
const COLORS = [
  "#476f9b",
  "#a45c52",
  "#64846a",
  "#8c6796",
  "#a17c3e",
  "#448b8d",
  "#6e73ad",
  "#b26f85",
  "#727d49",
  "#966f53",
  "#567b80",
  "#7c6c89",
];
export function createState(level: GravityLevel): GravityState {
  return {
    level,
    particles: [],
    elapsed: 0,
    held: 0,
    nextId: 0,
    sampleClock: 0,
  };
}
function targets(level: GravityLevel) {
  const attractors = level.bodies.filter((b) => b.kind === "attractor");
  const bodies = attractors.map((body) => ({
    id: body.id,
    position: body.position,
  }));
  if (level.objective.kind === "tour" && bodies.length > 1) {
    const position = {
      x: (bodies[0].position.x + bodies[1].position.x) / 2,
      y: (bodies[0].position.y + bodies[1].position.y) / 2,
    };
    bodies.push({ id: "pair", position });
  }
  return bodies;
}
export function fire(state: GravityState, aim: Aim): boolean {
  if (
    !Number.isFinite(aim.angle) ||
    !Number.isFinite(aim.power) ||
    aim.power <= 0 ||
    state.particles.filter((p) => p.alive).length >= MAX_PROJECTILES
  )
    return false;
  const id = state.nextId++,
    position = { ...state.level.launch },
    speed = gravityLaunchSpeed(aim.power),
    orbits: Record<string, OrbitTrack> = {};
  for (const target of targets(state.level))
    orbits[target.id] = {
      angle: Math.atan2(
        position.y - target.position.y,
        position.x - target.position.x,
      ),
      winding: 0,
      localWinding: 0,
      lapStart: 0,
      lapBaseline: {},
    };
  state.particles.push({
    id,
    position,
    velocity: {
      x: Math.cos(aim.angle) * speed,
      y: Math.sin(aim.angle) * speed,
    },
    alive: true,
    color:
      COLORS.find(
        (color) =>
          !state.particles.some(
            (particle) => particle.alive && particle.color === color,
          ),
      ) ?? COLORS[id % COLORS.length],
    born: state.elapsed,
    outside: 0,
    trail: [{ ...position, time: state.elapsed }],
    orbits,
  });
  return true;
}
function qualifying(
  state: GravityState,
  particle: GravityParticle,
  id: string,
): boolean {
  const track = particle.orbits[id];
  return (
    particle.alive &&
    !!track &&
    Math.abs(track.winding) >= TAU * state.level.objective.turns &&
    (state.level.objective.kind !== "paired" ||
      Math.abs(track.localWinding) >= TAU * state.level.objective.turns)
  );
}
export function goalProgress(state: GravityState): GoalProgress {
  if (state.level.objective.kind === "none")
    return { current: 0, target: 0, held: 0, hold: 0, complete: false };
  const goal = state.level.objective,
    bodies = state.level.bodies.filter((b) => b.kind === "attractor"),
    live = state.particles.filter((p) => p.alive);
  let current = 0;
  if (goal.kind === "paired") {
    // Maximum matching prevents one orbit around the pair from filling both slots.
    const assigned = new Map<number, string>();
    const match = (bodyId: string, seen: Set<number>): boolean => {
      for (const particle of live) {
        if (seen.has(particle.id) || !qualifying(state, particle, bodyId))
          continue;
        seen.add(particle.id);
        const previous = assigned.get(particle.id);
        if (!previous || match(previous, seen)) {
          assigned.set(particle.id, bodyId);
          return true;
        }
      }
      return false;
    };
    current = bodies.filter((body) => match(body.id, new Set())).length;
  } else if (goal.kind === "tour")
    current = live.filter((p) => qualifying(state, p, "pair")).length;
  else
    for (const body of bodies) {
      const orbiters = live.filter((p) => qualifying(state, p, body.id));
      let score = orbiters.length;
      if (goal.kind === "counter")
        score =
          Number(orbiters.some((p) => p.orbits[body.id].winding > 0)) +
          Number(orbiters.some((p) => p.orbits[body.id].winding < 0));

      current = Math.max(current, score);
    }
  return {
    current: Math.min(current, goal.count),
    target: goal.count,
    held: state.held,
    hold: goal.hold,
    complete: current >= goal.count && state.held + 1e-9 >= goal.hold,
  };
}
/** Advances one small simulation step. Engine and generation use this same path. */
export function step(state: GravityState, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 1 / 120);
  state.elapsed += dt;
  state.sampleClock += dt;
  const sample = state.sampleClock + 1e-9 >= 1 / 30;
  if (sample) state.sampleClock = 0;
  const live = state.particles.filter((p) => p.alive),
    forces = live.map((p) => gravityForceAt(p.position, state.level.bodies));
  const orbitTargets = targets(state.level),
    bounds = state.level.bounds;
  live.forEach((particle, index) => {
    const from = particle.position,
      force = forces[index];
    // Very gentle dissipation allows eventual collapse without spoiling early revolutions.
    particle.velocity = {
      x:
        (particle.velocity.x + force.x * dt) *
        Math.exp(-0.0003 * GRAVITY_SPEED_SCALE * dt),
      y:
        (particle.velocity.y + force.y * dt) *
        Math.exp(-0.0003 * GRAVITY_SPEED_SCALE * dt),
    };
    let to = {
        x: from.x + particle.velocity.x * dt,
        y: from.y + particle.velocity.y * dt,
      },
      hit = Infinity;
    for (const body of state.level.bodies) {
      const contact = segmentCircleIntersection(
        from,
        to,
        body.position,
        body.radius + SHIP_RADIUS,
      );
      if (contact !== null) hit = Math.min(hit, contact);
    }
    if (hit !== Infinity) {
      to = {
        x: from.x + (to.x - from.x) * hit,
        y: from.y + (to.y - from.y) * hit,
      };
      particle.alive = false;
    }
    particle.position = to;
    const outside =
      to.x < bounds.x ||
      to.y < bounds.y ||
      to.x > bounds.x + bounds.width ||
      to.y > bounds.y + bounds.height;
    particle.outside = outside ? particle.outside + dt : 0;
    if (
      particle.outside >= 6 ||
      state.elapsed - particle.born > 150 ||
      !Number.isFinite(to.x) ||
      !Number.isFinite(to.y)
    )
      particle.alive = false;
    for (const target of orbitTargets) {
      const track = particle.orbits[target.id],
        angle = Math.atan2(to.y - target.position.y, to.x - target.position.x),
        radius = distance(to, target.position);
      const delta = Math.atan2(
        Math.sin(angle - track.angle),
        Math.cos(angle - track.angle),
      );
      track.angle = angle;
      track.winding += delta;
    }
    // Classify each completed lap by what it encloses, without a distance cutoff.
    // A shared lap also winds around another body; it cannot fill a local-orbit slot.
    for (const target of orbitTargets) {
      if (target.id === "pair") continue;
      const track = particle.orbits[target.id];
      const lap = track.winding - track.lapStart;
      if (Math.abs(lap) < TAU) continue;
      const shared = orbitTargets.some(
        (other) =>
          other.id !== target.id &&
          other.id !== "pair" &&
          Math.abs(
            particle.orbits[other.id].winding -
              (track.lapBaseline[other.id] ?? 0),
          ) >=
            TAU * 0.75,
      );
      if (!shared) {
        // Moving into a new local orbit replaces this projectile's previous capture.
        for (const other of orbitTargets)
          if (other.id !== target.id)
            particle.orbits[other.id].localWinding = 0;
      }
      track.localWinding = shared
        ? 0
        : track.localWinding + Math.sign(lap) * TAU;
      track.lapStart = track.winding;
      track.lapBaseline = Object.fromEntries(
        orbitTargets.map((other) => [
          other.id,
          particle.orbits[other.id].winding,
        ]),
      );
    }

    if (sample || !particle.alive)
      particle.trail.push({ ...to, time: state.elapsed });
  });
  for (const particle of state.particles)
    particle.trail = particle.trail.filter(
      (point) => state.elapsed - point.time <= TRAIL_SECONDS,
    );
  const survivors = state.particles.filter((particle) => particle.alive);
  const fading = state.particles
    .filter((particle) => !particle.alive && particle.trail.length > 0)
    .slice(-(24 - survivors.length));
  state.particles = [...survivors, ...fading].sort((a, b) => a.id - b.id);
  const progress = goalProgress(state);
  state.held =
    progress.target > 0 && progress.current >= progress.target
      ? state.held + dt
      : 0;
}
export function orbitFraction(
  state: GravityState,
  particle: GravityParticle,
  id: string,
): number {
  if (state.level.objective.kind === "none") return 0;
  const track = particle.orbits[id];
  if (!track) return 0;
  const winding =
    state.level.objective.kind === "paired"
      ? Math.min(
          Math.abs(track.winding),
          Math.abs(track.localWinding + track.winding - track.lapStart),
        )
      : Math.abs(track.winding);
  return Math.min(1, winding / (TAU * state.level.objective.turns));
}
export function objectiveText(level: GravityLevel): string {
  if (level.objective.kind === "none") return "Free play";
  const { kind, count, turns, hold } = level.objective,
    loops = turns === 1 ? "one revolution" : `${turns} revolutions`;
  const text =
    kind === "loop"
      ? `Complete ${loops} around a body`
      : kind === "crowd"
        ? `Keep ${count} projectiles orbiting one body`
        : kind === "counter"
          ? "Orbit one body in both directions"
          : kind === "paired"
            ? "Keep an orbit around each body"
            : "Loop around both bodies together";
  return hold > 0 ? `${text}. Hold for ${hold}s.` : `${text}.`;
}
