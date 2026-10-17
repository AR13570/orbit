import type { Body } from "../game/types";
import type { GravityLevel, GravityOrbitRequirement } from "./types";

type Anchor = [number, number, number?];
type Design = {
  title: string;
  layout: string;
  cores: Anchor[];
  repel?: Anchor[];
  goal: "orbit" | "shared" | "relay" | "counter";
  targets?: number[];
  route?: number[];
  count?: number;
  turns?: number;
  directions?: number[];
  sweep?: number;
  reach?: number;
  moving?: number[];
  padding?: number;
  capture?: boolean;
  sharedCounter?: boolean;
};
/** Every entry changes the spatial problem, not just its population. Coordinates are authored in world space. */
export const CAMPAIGN_DESIGNS: readonly Design[] = [
  {
    title: "First curve",
    layout: "first-curve",
    cores: [[0, 0]],
    goal: "orbit",
  },
  {
    title: "Twin harbors",
    layout: "twin-harbors",
    cores: [
      [-155, 55],
      [155, -55],
    ],
    goal: "orbit",
  },
  {
    title: "One wide arc",
    layout: "one-wide-arc",
    cores: [
      [-65, -15],
      [65, 15],
    ],
    goal: "shared",
    padding: 170,
  },
  {
    title: "Against the current",
    layout: "against-current",
    cores: [[-45, 35]],
    repel: [[145, -150, 0.5]],
    goal: "counter",
  },
  {
    title: "Pass it on",
    layout: "first-handoff",
    cores: [
      [-125, 40],
      [125, -40],
    ],
    goal: "relay",
    route: [0, 1],
    reach: 135,
  },
  {
    title: "A quiet pocket",
    layout: "quiet-pocket",
    cores: [[0, 20]],
    repel: [
      [-160, -115, 0.6],
      [160, -115, 0.6],
      [0, 195, 0.5],
    ],
    goal: "orbit",
  },
  {
    title: "Three islands",
    layout: "three-islands",
    cores: [
      [-175, 100],
      [175, 100],
      [0, -185],
    ],
    goal: "orbit",
  },
  {
    title: "Thread the needle",
    layout: "needle-transfer",
    cores: [
      [0, 155],
      [0, -155],
    ],
    repel: [
      [-150, 0, 0.35],
      [150, 0, 0.35],
    ],
    goal: "relay",
    route: [0, 1],
    reach: 150,
  },
  {
    title: "Heavy and light",
    layout: "unequal-lasso",
    cores: [
      [-80, -45, 1.8],
      [80, 45, 0.4],
    ],
    goal: "shared",
    padding: 190,
  },
  {
    title: "Cross currents",
    layout: "cross-currents",
    cores: [
      [-175, -60],
      [175, 60],
    ],
    goal: "orbit",
    directions: [1, -1],
  },
  {
    title: "There and back",
    layout: "first-return",
    cores: [
      [-100, 0],
      [100, 0],
    ],
    goal: "relay",
    route: [0, 1, 0],
    reach: 125,
    sweep: 0.65,
  },
  {
    title: "Three body dance",
    layout: "triangle-lasso",
    cores: [
      [-70, 45],
      [70, 45],
      [0, -80],
    ],
    goal: "shared",
    padding: 190,
  },
  {
    title: "Corner pockets",
    layout: "corner-pockets",
    cores: [
      [-180, -140, 0.7],
      [180, 140, 0.7],
      [200, -200, 1.3],
    ],
    goal: "orbit",
    targets: [0, 1],
  },
  {
    title: "Wandering home",
    layout: "wandering-home",
    cores: [[0, 0]],
    goal: "orbit",
    moving: [0],
  },
  {
    title: "Peanut gallery",
    layout: "peanut-loop",
    cores: [
      [-20, -65],
      [20, 65],
    ],
    repel: [[195, 0, 0.35]],
    goal: "shared",
    padding: 185,
  },
  {
    title: "Three companions",
    layout: "three-companions",
    cores: [[-40, -30]],
    goal: "orbit",
    count: 3,
  },
  {
    title: "Stepping stones",
    layout: "stepping-stones",
    cores: [
      [-185, 65],
      [0, -65],
      [185, 65],
    ],
    goal: "relay",
    route: [0, 1, 2],
    reach: 145,
    sweep: 1.0,
  },
  {
    title: "Four corners",
    layout: "four-corners",
    cores: [
      [-170, -170],
      [170, -170],
      [170, 170],
      [-170, 170],
    ],
    goal: "orbit",
  },
  {
    title: "Outside lanes",
    layout: "outside-lanes",
    cores: [
      [-105, -55],
      [105, 55],
    ],
    repel: [
      [245, -70, 0.55],
      [0, 0, 0.15],
    ],
    goal: "shared",
    padding: 200,
  },
  {
    title: "Return ticket",
    layout: "unequal-return",
    cores: [
      [-115, -45, 1.2],
      [115, 45, 0.8],
    ],
    goal: "relay",
    route: [1, 0, 1],
    reach: 145,
    sweep: 0.6,
  },
  {
    title: "Opposite shores",
    layout: "opposite-shores",
    cores: [
      [-170, 0],
      [170, 0],
    ],
    repel: [
      [0, -160, 0.4],
      [0, 160, 0.4],
    ],
    goal: "orbit",
    directions: [1, -1],
  },
  {
    title: "The small sanctuary",
    layout: "small-sanctuary",
    cores: [
      [0, 0, 0.65],
      [-205, -135, 1.4],
      [200, -115, 1.3],
      [15, 235, 1.2],
    ],
    goal: "orbit",
    targets: [0],
  },
  {
    title: "Triangle relay",
    layout: "triangle-relay",
    cores: [
      [-140, 100],
      [140, 100],
      [0, -140],
    ],
    goal: "relay",
    route: [0, 1, 2],
    reach: 145,
    sweep: 1.1,
  },
  {
    title: "Braided sky",
    layout: "braided-sky",
    cores: [
      [-85, 0],
      [0, 20, 0.6],
      [85, 0],
    ],
    goal: "shared",
    padding: 210,
  },
  {
    title: "Switchback",
    layout: "switchback",
    cores: [
      [-165, -95],
      [0, 95],
      [165, -95],
    ],
    goal: "relay",
    route: [0, 1, 2],
    reach: 145,
    sweep: 1.1,
  },
  {
    title: "A turning pair",
    layout: "turning-pair",
    cores: [
      [-65, -25],
      [65, 25],
    ],
    goal: "shared",
    moving: [0, 1],
    padding: 200,
  },
  {
    title: "The open crescent",
    layout: "open-crescent",
    cores: [
      [-220, -190, 1.2],
      [0, -230, 0.6],
      [195, -80, 0.6],
      [195, 150, 1.2],
    ],
    goal: "orbit",
    targets: [0, 3],
  },
  {
    title: "Across the divide",
    layout: "divide-transfer",
    cores: [
      [-150, 50],
      [150, -50],
    ],
    repel: [[0, -190, 0.35]],
    goal: "relay",
    route: [0, 1],
    reach: 150,
    capture: true,
  },
  {
    title: "Uneven neighbors",
    layout: "uneven-neighbors",
    cores: [
      [-180, 120, 0.7],
      [180, 120, 1.3],
      [0, -175, 0.85],
    ],
    goal: "orbit",
  },
  {
    title: "Pinwheel",
    layout: "pinwheel",
    cores: [
      [-80, 50],
      [80, 50],
      [0, -90],
    ],
    repel: [
      [0, 0, 0.2],
      [-135, 205, 0.55],
    ],
    goal: "shared",
    padding: 215,
  },
  {
    title: "Boomerang",
    layout: "boomerang",
    cores: [
      [-100, 55],
      [100, -55],
    ],
    repel: [[0, -210, 0.3]],
    goal: "relay",
    route: [0, 1, 0],
    reach: 140,
    sweep: 0.6,
  },
  {
    title: "Counterbalance",
    layout: "counterbalance",
    cores: [[0, 0, 1.3]],
    repel: [[-190, 160, 0.25]],
    goal: "counter",
  },
  {
    title: "Hourglass",
    layout: "hourglass",
    cores: [
      [0, -95],
      [0, 95],
    ],
    goal: "shared",
    padding: 205,
    count: 2,
    sharedCounter: true,
  },
  {
    title: "The long way home",
    layout: "long-way-home",
    cores: [
      [-145, -100],
      [145, -100],
      [145, 145],
    ],
    goal: "relay",
    route: [0, 1, 2],
    reach: 145,
    sweep: 1.15,
  },
  {
    title: "Compass points",
    layout: "compass-points",
    cores: [
      [0, -230, 0.8],
      [210, 0, 1.2],
      [0, 210, 0.9],
      [-190, 0, 1.1],
    ],
    goal: "orbit",
    directions: [1, -1, 1, -1],
  },
  {
    title: "A quiet eddy",
    layout: "quiet-eddy",
    cores: [[30, 20, 0.7]],
    repel: [
      [-180, 0, 0.5],
      [185, -20, 0.5],
      [0, -190, 0.3],
      [20, 210, 0.3],
    ],
    goal: "orbit",
    count: 2,
  },
  {
    title: "Four body tour",
    layout: "four-body-tour",
    cores: [
      [0, -75, 0.7],
      [75, 0, 0.7],
      [0, 75, 0.7],
      [-75, 0, 0.7],
    ],
    repel: [[195, 120, 0.5]],
    goal: "shared",
    padding: 220,
  },
  {
    title: "Round the baton",
    layout: "round-baton",
    cores: [
      [-115, 75],
      [115, 75],
      [0, -125],
    ],
    goal: "relay",
    route: [0, 1, 2, 0],
    reach: 140,
    sweep: 1.15,
  },
  {
    title: "Tidal balance",
    layout: "tidal-steps",
    cores: [
      [-255, 100, 0.9],
      [0, -140, 1.1],
      [255, 100, 0.9],
    ],
    goal: "orbit",
    moving: [1],
    targets: [0, 2],
    turns: 2,
  },
  {
    title: "Star lanes",
    layout: "star-lanes",
    cores: [
      [-100, -40, 0.8],
      [0, 25, 1.2],
      [100, -40, 0.8],
    ],
    repel: [
      [-190, 50, 0.45],
      [170, -145, 0.4],
    ],
    goal: "shared",
    padding: 210,
  },
  {
    title: "Mirror pass",
    layout: "mirror-pass",
    cores: [
      [-125, -100],
      [125, 100],
    ],
    repel: [
      [-135, 165, 0.3],
      [135, -165, 0.3],
    ],
    goal: "relay",
    route: [1, 0],
    reach: 150,
    capture: true,
  },
  {
    title: "Orbital duet",
    layout: "orbital-duet",
    cores: [
      [-60, 0],
      [60, 0],
    ],
    goal: "shared",
    count: 2,
    padding: 215,
    sharedCounter: true,
  },
  {
    title: "The long relay",
    layout: "long-relay",
    cores: [
      [-190, -110],
      [-60, 95],
      [70, -95],
      [200, 110],
    ],
    goal: "relay",
    route: [0, 1, 2, 3],
    reach: 145,
    sweep: 1.2,
  },
  {
    title: "Living constellation",
    layout: "living-constellation",
    cores: [
      [-155, -100, 0.8],
      [155, -100, 0.8],
      [0, 175],
    ],
    goal: "orbit",
    moving: [0, 1],
    targets: [0, 1, 2],
  },
  {
    title: "Grand tour",
    layout: "grand-tour",
    cores: [
      [-125, 90],
      [125, 90],
      [0, -135],
    ],
    repel: [[0, 220, 0.25]],
    goal: "relay",
    route: [0, 1, 2, 0],
    reach: 140,
    sweep: 1.4,
    capture: true,
  },
];
export function campaignBlueprint(index: number): GravityLevel {
  const d = CAMPAIGN_DESIGNS[index];
  const count = d.count ?? 1;
  const bodies: Body[] = d.cores.map(([x, y, m = 1], i) => ({
    id: `well-${i + 1}`,
    kind: "attractor" as const,
    position: { x: 450 + x, y: 450 + y },
    radius: 24 * Math.sqrt(m),
    strength: 2800000 * m,
  }));
  const level: GravityLevel = {
    seed: 0x6f726269,
    index,
    source: "campaign",
    title: d.title,
    layout: d.layout,
    family:
      d.goal === "orbit"
        ? d.cores.length > 1
          ? "paired"
          : "loop"
        : d.goal === "counter"
          ? "counter"
          : "tour",
    bounds: { x: 0, y: 0, width: 900, height: 900 },
    launch: { x: 450, y: 560 },
    bodies,
    objective: {
      kind:
        d.goal === "orbit"
          ? d.cores.length > 1
            ? "paired"
            : "loop"
          : d.goal === "counter"
            ? "counter"
            : "tour",
      count: d.goal === "counter" ? 2 : count,
      turns: d.turns ?? 1,
      hold: 0,
    },
    physics: { planetGravity: true, planetCollisions: "none", planetRadius: 6 },
    witness: [],
    mechanics: [
      d.goal === "relay"
        ? "same-planet relay"
        : d.goal === "shared"
          ? "shared orbit"
          : d.goal === "counter" || d.directions
            ? "opposite directions"
            : "local orbits",
      ...(d.repel?.length ? ["repeller gaps"] : []),
      ...(d.moving?.length ? ["moving cores"] : []),
      ...(count > 1 ? ["multiple planets"] : []),
      ...(d.capture ? ["transfer and capture"] : []),
      ...(d.sharedCounter ? ["opposing shared orbits"] : []),
    ],
    orbitPadding: d.padding ?? (d.goal === "relay" ? 135 : 84),
  };
  d.repel?.forEach(([x, y, m = 1], i) =>
    level.bodies.push({
      id: `repeller-${i + 1}`,
      kind: "repellent",
      position: { x: 450 + x, y: 450 + y },
      radius: 20 * Math.sqrt(m),
      strength: 1500000 * m,
    }),
  );
  if (d.goal === "orbit")
    level.requirements = (d.targets ?? d.cores.map((_, i) => i)).map(
      (i): GravityOrbitRequirement => ({
        bodyId: `well-${i + 1}`,
        count,
        turns: d.turns ?? 1,
        ...(d.directions
          ? {
              direction: d.directions[i] > 0 ? "clockwise" : "counterclockwise",
            }
          : {}),
      }),
    );
  if (d.goal === "shared") {
    level.sharedOrbit = d.cores.map((_, i) => `well-${i + 1}`);
    if (d.sharedCounter) level.sharedCounter = true;
  }
  if (d.goal === "relay")
    level.journey = {
      legs: d.route!.map((i, index) => ({
        bodyId: `well-${i + 1}`,
        radius: d.reach ?? 140,
        sweep:
          d.capture && index === d.route!.length - 1
            ? Math.PI * 2
            : (d.sweep ?? 0.8),
      })),
    };
  if (d.moving)
    level.motions = d.moving.map((i) => ({
      bodyId: `well-${i + 1}`,
      kind: "oscillate",
      center: { ...bodies[i].position },
      amplitude: { x: index >= 38 ? 38 : 24, y: index >= 38 ? 24 : 16 },
      period: index >= 38 ? 22 : 28,
      phase: i * Math.PI,
    }));
  return level;
}
