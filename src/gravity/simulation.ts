import type { Aim, Vec2 } from "../game/types";
import { corePositionLabel } from "./core-position-label";
import { assistGroupSpin } from "./group-spin";
import { moveWells } from "./motion";
import { driftWithContacts } from "./contacts";
import {
  recoverSurfaceOverlaps,
  surfaceContacts,
  supportSurfaces,
} from "./surface-support";
import { goalProgress, initialOrbits, updateOrbits } from "./orbits";
import {
  GRAVITY_FIXED_STEP,
  gravityLaunchSpeed,
  physicsSettings,
  planetAccelerations,
} from "./physics";
import type {
  GravityLevel,
  GravityParticle,
  GravityState,
  WorldBounds,
} from "./types";
export { goalProgress, orbitFraction } from "./orbits";
export const TRAIL_SECONDS = 24;
/** Legacy export retained without enforcing an active planet cap. */
export const MAX_PROJECTILES = Infinity;
const COLORS = [
  "#cf315c",
  "#007c9e",
  "#a66b00",
  "#7250b5",
  "#218451",
  "#bb5826",
  "#a8469b",
  "#147f78",
  "#4869ad",
  "#7a821b",
  "#b44357",
  "#66519e",
];
/** Shared by the held projectile and launch so the preview uses the next planet's color. */
export function nextProjectileColor(
  state: Pick<GravityState, "particles" | "nextId">,
): string {
  return (
    COLORS.find(
      (color) =>
        !state.particles.some(
          (particle) => particle.alive && particle.color === color,
        ),
    ) ?? `hsl(${(state.nextId * 137.507764) % 360} 72% 28%)`
  );
}
export function createState(level: GravityLevel): GravityState {
  const copy = structuredClone(level);
  copy.objective = { ...copy.objective, hold: 0 };
  moveWells(copy, 0);
  return {
    level: copy,
    physics: physicsSettings(level.physics),
    particles: [],
    elapsed: 0,
    held: 0,
    nextId: 0,
    sampleClock: 0,
  };
}
const finiteVector = (p: Vec2) => Number.isFinite(p.x) && Number.isFinite(p.y);
export function fireFrom(
  state: GravityState,
  position: Vec2,
  velocity: Vec2,
): boolean {
  if (!finiteVector(position) || !finiteVector(velocity)) return false;
  const color = nextProjectileColor(state);
  const id = state.nextId++;
  state.particles.push({
    id,
    position: { ...position },
    velocity: { ...velocity },
    mass: state.physics.planetMass,
    radius: state.physics.planetRadius,
    projectileSize: state.projectileSize ?? 1,
    alive: true,
    color,
    born: state.elapsed,
    outside: 0,
    trail: [{ ...position, time: state.elapsed }],
    orbits: initialOrbits(state.level, position),
  });
  return true;
}
export function fire(state: GravityState, aim: Aim): boolean {
  if (
    !Number.isFinite(aim.angle) ||
    !Number.isFinite(aim.power) ||
    aim.power <= 0
  )
    return false;
  const speed = gravityLaunchSpeed(aim.power);
  return fireFrom(state, state.level.launch, {
    x: Math.cos(aim.angle) * speed,
    y: Math.sin(aim.angle) * speed,
  });
}
function outsideView(p: GravityParticle, bounds: WorldBounds): boolean {
  return (
    p.position.x + p.radius < bounds.x ||
    p.position.x - p.radius > bounds.x + bounds.width ||
    p.position.y + p.radius < bounds.y ||
    p.position.y - p.radius > bounds.y + bounds.height
  );
}
/** Offscreen removal uses only the outermost permitted view, never escape estimates. */
function escaped(state: GravityState, p: GravityParticle): boolean {
  return state.flightBounds ? outsideView(p, state.flightBounds) : false;
}
/** One physical step. Callers use the exported fixed step, not playback time. */
export function step(state: GravityState, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, GRAVITY_FIXED_STEP);
  const live = state.particles.filter((p) => p.alive);
  assistGroupSpin(state, live, dt);
  recoverSurfaceOverlaps(state, live, dt);
  const before = planetAccelerations(live, state.level.bodies, state.physics);
  const previousBodies = new Map(
    state.level.bodies.map((body) => [body.id, { ...body.position }]),
  );
  moveWells(state.level, state.elapsed + dt);
  const surfaces = surfaceContacts(state, live);
  live.forEach((p, i) => {
    p.velocity.x += before[i].x * dt * 0.5;
    p.velocity.y += before[i].y * dt * 0.5;

    if (!finiteVector(p.position) || !finiteVector(p.velocity)) p.alive = false;
  });
  const supported = supportSurfaces(surfaces, dt);
  driftWithContacts(state, live, previousBodies, dt, supported);
  const survivors = live.filter((p) => p.alive),
    after = planetAccelerations(survivors, state.level.bodies, state.physics);
  const finalSurfaces = surfaceContacts(state, survivors, supported);
  survivors.forEach((p, i) => {
    p.velocity.x += after[i].x * dt * 0.5;
    p.velocity.y += after[i].y * dt * 0.5;
  });
  supportSurfaces(finalSurfaces, 0);
  state.elapsed += dt;
  state.sampleClock += dt;
  const sampleInterval = Math.max(1 / 30, state.physics.trailSeconds / 511);
  const sample = state.sampleClock + 1e-9 >= sampleInterval;
  if (sample)
    state.sampleClock = Math.max(0, state.sampleClock - sampleInterval);
  for (const p of live) {
    if (p.alive && escaped(state, p)) p.alive = false;
    updateOrbits(state.level, p);
    if (sample || !p.alive)
      p.trail.push({ ...p.position, time: state.elapsed });
  }
  const oldest = state.elapsed - state.physics.trailSeconds;
  const maxPoints = Math.min(
    512,
    Math.ceil(state.physics.trailSeconds * 30) + 1,
  );
  for (const p of state.particles) {
    let remove = 0;
    while (remove < p.trail.length && p.trail[remove].time < oldest - 1e-9)
      remove++;
    remove = Math.max(remove, p.trail.length - maxPoints);
    if (remove > 0) p.trail.splice(0, remove);
  }
  const living = state.particles.filter((p) => p.alive);
  const fading = state.particles
    .filter((p) => !p.alive && p.trail.length)
    .slice(-96);
  state.particles = [...living, ...fading].sort((a, b) => a.id - b.id);
  // Legacy snapshots keep this compatibility field at zero.
  state.held = 0;
}
export function objectiveText(level: GravityLevel): string {
  const planetLabel =
    level.objective.count === 1
      ? "one planet"
      : `${level.objective.count} planets`;
  const coreLabel = (id: string) => corePositionLabel(level, id);
  if (level.journey) {
    const route = level.journey.legs
      .map((leg) => coreLabel(leg.bodyId))
      .join(" → ");
    const capture = level.journey.legs.at(-1)!.sweep >= Math.PI * 2;
    return `Curve past ${route} with ${planetLabel}.${capture ? ` Finish a full orbit at ${coreLabel(level.journey.legs.at(-1)!.bodyId)}.` : " Keep the same planet."}`;
  }
  if (level.sharedOrbit)
    return `Loop ${planetLabel} around ${level.sharedOrbit.length === 2 ? "both cores" : `all ${level.sharedOrbit.length} cores`}${level.sharedCounter ? ", in opposite directions" : " in one shared orbit"} for ${level.objective.turns} ${level.objective.turns === 1 ? "revolution" : "revolutions"}.`;
  if (
    level.source === "campaign" &&
    level.requirements?.every(
      (goal) =>
        goal.count === 1 && goal.direction && goal.direction !== "either",
    )
  )
    return "Orbit each core in its marked direction.";
  if (level.source === "procedural") {
    const { turns, count, kind } = level.objective;
    const duration = ` for ${turns} ${turns === 1 ? "revolution" : "revolutions"}`;
    if (kind === "tour")
      return `Keep ${count} planets orbiting both cores${duration}.`;
    if (
      level.requirements &&
      level.requirements.length > 2 &&
      level.requirements.every(
        (goal) =>
          (goal.turns ?? turns) === turns &&
          (!goal.direction || goal.direction === "either"),
      )
    ) {
      const population = level.requirements.reduce(
        (sum, goal) => sum + goal.count,
        0,
      );
      return `Keep ${population} planets across ${level.requirements.length} cores${duration}.`;
    }
  }
  const targetLabel = coreLabel;
  if (level.requirements?.length) {
    const requirements = level.requirements,
      attractors = level.bodies.filter((body) => body.kind === "attractor");
    const first = requirements[0],
      turns = first.turns ?? level.objective.turns,
      direction = first.direction ?? "either";
    const uniform =
      requirements.length === attractors.length &&
      attractors.every((body) =>
        requirements.some((goal) => goal.bodyId === body.id),
      ) &&
      requirements.every(
        (goal) =>
          goal.count === first.count &&
          (goal.turns ?? level.objective.turns) === turns &&
          (goal.direction ?? "either") === direction,
      );
    const duration = (value: number) =>
      value > 1 ? ` for ${value} revolutions` : "";
    const rotation = (value: string | undefined) =>
      value && value !== "either" ? ` ${value}` : "";
    const text = uniform
      ? `Keep ${first.count} ${first.count === 1 ? "planet" : "planets"} orbiting ${attractors.length === 1 ? "the core" : "each core"}${rotation(direction)}${duration(turns)}`
      : requirements
          .map(
            (goal) =>
              `${goal.count} ${goal.count === 1 ? "planet" : "planets"} around ${targetLabel(goal.bodyId)}${rotation(goal.direction)}${duration(goal.turns ?? level.objective.turns)}`,
          )
          .join(" · ");
    return `${text}.`;
  }
  if (level.objective.kind === "none") return "Free play";
  const { kind, count, turns } = level.objective,
    loops = turns === 1 ? "one revolution" : `${turns} revolutions`;
  const text =
    kind === "loop"
      ? `Complete ${loops} around a body`
      : kind === "crowd"
        ? `Keep ${count} planets orbiting one body`
        : kind === "counter"
          ? "Orbit one body in both directions"
          : kind === "paired"
            ? "Keep an orbit around each body"
            : "Loop around both bodies together";
  return `${text}.`;
}
