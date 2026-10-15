import type { Body, Vec2 } from "../game/types";
import {
  gravityForceAt,
  gravityLaunchPower,
  PARTICLE_GRAVITY_STRENGTH,
} from "./physics";
import { moveWells, wellVelocity } from "./motion";
import { createState, fireFrom, step } from "./simulation";
import fixtureData from "./witness-fixtures.json";
import interactionFixtures from "./interaction-fixtures.json";
import type {
  GravityLevel,
  GravityPhysicsOptions,
  PuzzleFamily,
  WitnessShot,
} from "./types";

const TAU = Math.PI * 2;
type Anchor = [number, number, number?];
export interface LayoutDefinition {
  id: string;
  anchors: Anchor[];
  repellers?: Anchor[];
  count?: number;
  wide?: boolean;
  counter?: boolean;
  physics?: GravityPhysicsOptions;
  motion?: "circle" | "oscillate";
  centralOnly?: boolean;
}
const ring = (count: number, radius: number, start = -Math.PI / 2): Anchor[] =>
  Array.from({ length: count }, (_, i) => [
    Math.cos(start + (i * TAU) / count) * radius,
    Math.sin(start + (i * TAU) / count) * radius,
  ]);
/** Authored coordinates describe different arrangements, populations and mass ratios. */
export const GRAVITY_LAYOUTS: readonly LayoutDefinition[] = [
  { id: "single-well", anchors: [[0, 0]] },
  { id: "compact-swarm", anchors: [[0, 0]], count: 5 },
  { id: "concentric-shells", anchors: [[0, 0]], count: 8 },
  { id: "counterflow", anchors: [[0, 0]], count: 2, counter: true },
  {
    id: "binary-wide",
    anchors: [
      [-42, 0],
      [42, 0],
    ],
    wide: true,
  },
  {
    id: "separated-twins",
    anchors: [
      [-190, 0],
      [190, 0],
    ],
  },
  {
    id: "unequal-binary",
    anchors: [
      [-180, -40, 1.8],
      [190, 60, 0.75],
    ],
  },
  {
    id: "triple-line",
    anchors: [
      [-240, 0],
      [0, 0],
      [240, 0],
    ],
  },
  { id: "triangle", anchors: ring(3, 240) },
  {
    id: "unequal-triangle",
    anchors: [
      [-220, 150, 0.8],
      [220, 150, 1.6],
      [0, -210, 1.1],
    ],
  },
  {
    id: "square",
    anchors: [
      [-190, -190],
      [190, -190],
      [190, 190],
      [-190, 190],
    ],
  },
  {
    id: "diamond",
    anchors: [
      [0, -280],
      [280, 0],
      [0, 280],
      [-280, 0],
    ],
  },
  {
    id: "cross",
    anchors: [
      [0, 0],
      [0, -270],
      [270, 0],
      [0, 270],
      [-270, 0],
    ],
  },
  {
    id: "staggered-ladder",
    anchors: [
      [-170, -260],
      [170, -170],
      [-170, 0],
      [170, 90],
      [-170, 260],
    ],
  },
  {
    id: "open-v",
    anchors: [
      [-280, -190],
      [-140, 30],
      [0, 250],
      [140, 30],
      [280, -190],
    ],
  },
  {
    id: "zigzag",
    anchors: [
      [-290, -170],
      [-100, 150],
      [100, -150],
      [290, 170],
    ],
  },
  { id: "five-star", anchors: [[0, 0], ...ring(5, 300)] },
  { id: "pentagon", anchors: ring(5, 275) },
  { id: "hexagon", anchors: ring(6, 290) },
  {
    id: "eight-well-enclosure",
    anchors: [
      [0, 0, 0.7],
      ...ring(8, 310).map(([x, y]) => [x, y, 1.5] as Anchor),
    ],
    centralOnly: true,
    count: 5,
  },
  {
    id: "broken-ring",
    anchors: ring(7, 290).filter((_, i) => i !== 1 && i !== 2),
  },
  {
    id: "double-ring",
    anchors: [...ring(3, 125), ...ring(6, 315, 0)],
    centralOnly: true,
  },
  {
    id: "three-clusters",
    anchors: [
      [-270, -190],
      [-150, -280],
      [230, -160],
      [300, -30],
      [-60, 240],
      [90, 290],
    ],
    centralOnly: true,
  },
  {
    id: "offset-crescent",
    anchors: [
      [-210, -260],
      [40, -270],
      [240, -90],
      [180, 160],
      [-20, 280],
    ],
  },
  {
    id: "repeller-gate",
    anchors: [[0, 80]],
    repellers: [
      [-160, -150],
      [160, -150],
    ],
  },
  {
    id: "repeller-channel",
    anchors: [
      [-200, 0],
      [200, 0],
    ],
    repellers: [
      [0, -240],
      [0, 240],
    ],
  },
  {
    id: "repeller-triangle",
    anchors: [[0, 0]],
    repellers: ring(3, 280),
    count: 3,
  },
  { id: "repeller-island", anchors: ring(4, 290), repellers: [[0, 0, 1.6]] },
  {
    id: "unequal-chain",
    anchors: [
      [-280, 100, 0.7],
      [-90, -130, 1.2],
      [110, 130, 2],
      [300, -100, 0.9],
    ],
  },
  { id: "moving-pendulum", anchors: [[0, 0]], motion: "oscillate", count: 2 },
  {
    id: "moving-carousel",
    anchors: [
      [-200, 0],
      [200, 0],
    ],
    motion: "circle",
  },
  {
    id: "elastic-pair",
    anchors: [
      [-210, 0],
      [210, 0],
    ],
    count: 2,
    physics: {
      planetGravity: true,
      planetCollisions: "elastic",
      planetMass: 2,
    },
  },
  {
    id: "merging-swarm",
    anchors: [[0, 0]],
    count: 7,
    physics: { planetGravity: true, planetCollisions: "elastic", planetMass: 3 },
  },
  {
    id: "self-gravitating-constellation",
    anchors: ring(5, 275),
    physics: { planetGravity: true, planetMass: 1 },
    count: 2,
  },
];

export interface LayoutOptions {
  index: number;
  seed: number;
  title: string;
  source: "campaign" | "procedural";
  count?: number;
  turns?: number;
  strength?: number;
  rotation?: number;
  family?: PuzzleFamily;
}
function toWorld(anchor: Anchor, rotation: number): Vec2 {
  return {
    x: 450 + anchor[0] * Math.cos(rotation) - anchor[1] * Math.sin(rotation),
    y: 450 + anchor[0] * Math.sin(rotation) + anchor[1] * Math.cos(rotation),
  };
}
export function buildGravityLayout(
  layout: LayoutDefinition,
  options: LayoutOptions,
): GravityLevel {
  const strength = options.strength ?? 1,
    rotation = options.rotation ?? 0;
  const bodies: Body[] = layout.anchors.map((anchor, i) => ({
    id: `well-${i + 1}`,
    kind: "attractor",
    position: toWorld(anchor, rotation),
    radius: layout.wide ? 18 : 24 * Math.sqrt(anchor[2] ?? 1),
    strength: 2800000 * (anchor[2] ?? 1) * strength,
  }));
  layout.repellers?.forEach((anchor, i) =>
    bodies.push({
      id: `repeller-${i + 1}`,
      kind: "repellent",
      position: toWorld(anchor, rotation),
      radius: 20 * Math.sqrt(anchor[2] ?? 1),
      strength: 1500000 * (anchor[2] ?? 1) * strength,
    }),
  );
  const count = options.count ?? layout.count ?? 1;
  const family =
    options.family ??
    (layout.wide
      ? "tour"
      : layout.counter
        ? "counter"
        : layout.anchors.length > 1
          ? "paired"
          : count > 1
            ? "crowd"
            : "loop");
  const mechanics = [
    layout.wide ? "wide orbit" : "local orbits",
    ...(count > 1 ? ["multiple planets"] : []),
    ...(layout.counter ? ["opposite directions"] : []),
    ...(layout.repellers?.length ? ["repeller barriers"] : []),
    ...(layout.anchors.some((a) => a[2] && a[2] !== 1)
      ? ["unequal wells"]
      : []),
    ...(layout.physics?.planetGravity !== false ? ["planet gravity"] : []),
    ...(layout.physics?.planetCollisions
      ? [`${layout.physics.planetCollisions} collisions`]
      : []),
    ...(layout.motion ? ["moving wells"] : []),
  ];
  const level: GravityLevel = {
    index: options.index,
    seed: options.seed,
    source: options.source,
    layout: layout.id,
    title: options.title,
    family,
    mechanics,
    bounds: { x: 0, y: 0, width: 900, height: 900 },
    launch: { x: 450, y: 540 },
    bodies,
    objective: {
      kind: family,
      count,
      turns: options.turns ?? 1,
      hold: 0,
    },
    physics: {
      planetRadius: 3,
      planetGravityStrength: PARTICLE_GRAVITY_STRENGTH * strength,
      ...layout.physics,
    },
    witness: [],
  };
  if (layout.motion)
    level.motions = bodies
      .filter((b) => b.kind === "attractor")
      .map((b, i) => ({
        bodyId: b.id,
        kind: layout.motion!,
        center: { ...b.position },
        period: (layout.motion === "circle" ? 90 : 75) / Math.sqrt(strength),
        radius: 18,
        amplitude: {
          x: 28 * Math.cos(rotation) - 12 * Math.sin(rotation),
          y: 28 * Math.sin(rotation) + 12 * Math.cos(rotation),
        },
        phase: i * Math.PI + (layout.motion === "circle" ? rotation : 0),
      }));
  moveWells(level, 0);
  if (!layout.wide && !layout.counter)
    level.requirements = (
      layout.centralOnly
        ? bodies.slice(0, 1)
        : bodies.filter((b) => b.kind === "attractor")
    ).map((b) => ({ bodyId: b.id, count, turns: options.turns ?? 1 }));
  level.witness = createWitness(level, layout, count, rotation, strength);
  level.launch = { ...level.witness[0].position! };
  return level;
}
function createWitness(
  level: GravityLevel,
  layout: LayoutDefinition,
  count: number,
  rotation: number,
  strength: number,
): WitnessShot[] {
  const authored = (interactionFixtures as Record<string, WitnessShot[]>)[
    `${layout.id}:${count}:${level.objective.turns}`
  ];
  if (authored)
    return authored.map((shot) => {
      const cosine = Math.cos(rotation),
        sine = Math.sin(rotation);
      const x = shot.position!.x - 450,
        y = shot.position!.y - 450;
      const velocity = {
        x:
          (shot.velocity!.x * cosine - shot.velocity!.y * sine) *
          Math.sqrt(strength),
        y:
          (shot.velocity!.x * sine + shot.velocity!.y * cosine) *
          Math.sqrt(strength),
      };
      return {
        ...shot,
        time: shot.time / Math.sqrt(strength),
        position: {
          x: 450 + x * cosine - y * sine,
          y: 450 + x * sine + y * cosine,
        },
        velocity,
        angle: Math.atan2(velocity.y, velocity.x),
        power: gravityLaunchPower(Math.hypot(velocity.x, velocity.y)),
      };
    });
  if (!layout.wide && !layout.counter && layout.id !== "concentric-shells") {
    const fixtures = fixtureData as Record<string, WitnessShot[]>;
    const base = fixtures[layout.id];
    if (base) {
      const angle = rotation;
      const transform = (vector: Vec2) => ({
        x: vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
        y: vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
      });
      const shots = base.map((shot) => {
        const relative = transform({
            x: shot.position!.x - 450,
            y: shot.position!.y - 450,
          }),
          velocity = transform(shot.velocity!);
        velocity.x *= Math.sqrt(strength);
        velocity.y *= Math.sqrt(strength);
        return {
          ...shot,
          time: shot.time / Math.sqrt(strength),
          position: { x: 450 + relative.x, y: 450 + relative.y },
          velocity,
          angle: Math.atan2(velocity.y, velocity.x),
          power: gravityLaunchPower(Math.hypot(velocity.x, velocity.y)),
        };
      });
      if (count === 1) return shots.sort((a, b) => a.time - b.time);
      const state = createState(level);
      shots.forEach((shot) => fireFrom(state, shot.position!, shot.velocity!));
      const result: WitnessShot[] = [];
      for (let i = 0; i < count; i++) {
        for (let targetIndex = 0; targetIndex < shots.length; targetIndex++) {
          const particle = state.particles.find((p) => p.id === targetIndex)!;
          const position = { ...particle.position },
            velocity = { ...particle.velocity };
          result.push({
            time: shots[targetIndex].time,
            position,
            velocity,
            angle: Math.atan2(velocity.y, velocity.x),
            power: gravityLaunchPower(Math.hypot(velocity.x, velocity.y)),
          });
        }
        for (
          let n = 0;
          n < (layout.id === "self-gravitating-constellation" ? 24 : 12);
          n++
        )
          step(state, 1 / 120);
      }
      return result.sort((a, b) => a.time - b.time);
    }
  }
  const targets = layout.wide
    ? [{ id: "pair", position: { x: 450, y: 450 }, radius: 15 }]
    : layout.centralOnly
      ? level.bodies.slice(0, 1)
      : level.bodies.filter((b) => b.kind === "attractor");
  return targets.flatMap((target, targetIndex) =>
    Array.from({ length: layout.counter ? 2 : count }, (_, i) => {
      const nearest = Math.min(
        ...level.bodies
          .filter((b) => b.id !== target.id)
          .map((b) =>
            Math.hypot(
              b.position.x - target.position.x,
              b.position.y - target.position.y,
            ),
          ),
        Infinity,
      );
      const base = layout.wide
        ? 210
        : Math.min(level.bodies.length > 1 ? 42 : 75, nearest * 0.25);
      const radius = layout.id === "concentric-shells" ? 65 + i * 10 : base;
      const angle =
        -Math.PI / 2 +
        (i * TAU) / (layout.counter ? 2 : count) +
        targetIndex * 0.37;
      const radial = { x: Math.cos(angle), y: Math.sin(angle) };
      const position = {
        x: target.position.x + radial.x * radius,
        y: target.position.y + radial.y * radius,
      };
      const force = gravityForceAt(position, level.bodies),
        inward = Math.max(1, -force.x * radial.x - force.y * radial.y);
      const speed = Math.sqrt(inward * radius),
        direction = layout.counter && i === 1 ? -1 : 1;
      const moving = wellVelocity(level, target.id, 0);
      const velocity = {
        x: -radial.y * speed * direction + moving.x,
        y: radial.x * speed * direction + moving.y,
      };
      return {
        time: 0,
        position,
        velocity,
        angle: Math.atan2(velocity.y, velocity.x),
        power: gravityLaunchPower(Math.hypot(velocity.x, velocity.y)),
      };
    }),
  );
}
