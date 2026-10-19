import type { Body } from "../game/types";
import type { GravityLevel } from "./types";

type Anchor = [number, number, number?];
export interface CampaignDesign {
  title: string;
  layout: string;
  cores: Anchor[];
  repel?: Anchor[];
  goal: "orbit" | "shared";
  population: number;
  orbitRadius: number;
  field?: "gentle" | "deep" | "broad";
}
/** Reviewed spatial structures. Populations are variants, never additional geometries. */
export const STABLE_CAMPAIGN_STRUCTURES: readonly CampaignDesign[] = [
  {
    title: "Open sky",
    layout: "open-sky",
    cores: [[0, 0]],
    goal: "orbit",
    population: 1,
    orbitRadius: 190,
  },
  {
    title: "Neighbouring systems",
    layout: "neighbouring-systems",
    cores: [
      [-500, 0],
      [500, 0],
    ],
    goal: "orbit",
    population: 1,
    orbitRadius: 190,
  },
  {
    title: "A common centre",
    layout: "common-centre",
    cores: [
      [0, -130],
      [-115, 70],
      [115, 70],
    ],
    goal: "shared",
    population: 1,
    orbitRadius: 450,
  },
  {
    title: "The shield",
    layout: "the-shield",
    cores: [[-70, 35]],
    repel: [[360, -260, 0.2]],
    goal: "orbit",
    population: 1,
    orbitRadius: 190,
  },
  {
    title: "Long channel",
    layout: "long-channel",
    cores: [[0, 0]],
    repel: [
      [-370, 0, 0.15],
      [370, 0, 0.15],
    ],
    goal: "orbit",
    population: 1,
    orbitRadius: 190,
  },
  {
    title: "The divide",
    layout: "the-divide",
    cores: [
      [-420, 0],
      [420, 0],
    ],
    repel: [
      [0, -330, 1.5],
      [0, 0, 1.5],
      [0, 330, 1.5],
    ],
    goal: "orbit",
    population: 1,
    orbitRadius: 190,
  },
  {
    title: "Open crown",
    layout: "open-crown",
    cores: [[0, 65]],
    repel: [
      [-350, 160, 0.06],
      [-330, -200, 0.06],
      [0, -350, 0.06],
      [330, -200, 0.06],
      [350, 160, 0.06],
    ],
    goal: "orbit",
    population: 1,
    orbitRadius: 190,
  },
  {
    title: "Closed garden",
    layout: "closed-garden",
    cores: [[0, 0]],
    repel: [
      [350, 0],
      [175, 303],
      [-175, 303],
      [-350, 0],
      [-175, -303],
      [175, -303],
    ],
    goal: "orbit",
    population: 1,
    orbitRadius: 190,
  },
  {
    title: "Broken necklace",
    layout: "broken-necklace",
    cores: [
      [-85, -85],
      [85, 85],
    ],
    repel: [
      [-200, 130, 0.5],
      [5, -230, 0.5],
      [230, -5, 0.5],
    ],
    goal: "shared",
    population: 1,
    orbitRadius: 450,
  },
];
const localOnly = new Set(["neighbouring-systems", "the-divide"]);
const AUTHORED_DESIGNS: readonly CampaignDesign[] = [
  ...Array.from({ length: 3 }, (_, round) =>
    (["gentle", "deep"] as const).flatMap((field) =>
      STABLE_CAMPAIGN_STRUCTURES.filter((d) =>
        localOnly.has(d.layout)
          ? round === 0 && field === "gentle"
          : round <
            (d.layout === "broken-necklace" ||
            (d.layout === "open-sky" && field === "gentle")
              ? 2
              : 3),
      ).map((d) => ({ ...d, field, population: round + 1 })),
    ),
  ).flat(),
  ...STABLE_CAMPAIGN_STRUCTURES.filter((d) =>
    ["open-sky", "the-shield", "long-channel", "closed-garden"].includes(
      d.layout,
    ),
  ).map((d) => ({ ...d, field: "broad" as const, population: 3 })),
];
/** Gameplay sequence maps to stable authored identities; no field is changed. */
export const CAMPAIGN_AUTHORED_ORDER: readonly number[] = [
  0, 1, 3, 4, 2, 6, 7, 9, 5, 11, 12, 13, 8, 14, 16, 18, 10, 19, 20, 21, 15, 23,
  25, 26, 17, 27, 28, 31, 24, 32, 33, 34, 22, 35, 37, 38, 29, 39, 40, 41, 30,
  42, 43, 44, 36,
];
export const CAMPAIGN_DESIGNS: readonly CampaignDesign[] =
  CAMPAIGN_AUTHORED_ORDER.map((index) => AUTHORED_DESIGNS[index]);
export function structureBlueprint(
  design: CampaignDesign,
  population = design.population,
): GravityLevel {
  const fieldScale =
    design.field === "broad" ? 2 : design.field === "deep" ? 1.5 : 1;
  const bodies: Body[] = design.cores.map(([x, y, m = 1], i) => ({
    id: `well-${i + 1}`,
    kind: "attractor",
    position: { x: 600 + x, y: 600 + y },
    radius: Math.max(96, 96 * Math.sqrt(m)),
    strength: 12000000 * m * fieldScale,
    softening:
      design.field === "broad" ? 240 : design.field === "deep" ? 200 : 180,
  }));
  for (const [i, [x, y, m = 1]] of (design.repel ?? []).entries())
    bodies.push({
      id: `repeller-${i + 1}`,
      kind: "repellent",
      position: { x: 600 + x, y: 600 + y },
      radius: 57,
      strength: 1500000 * m * fieldScale,
    });
  const kind =
    design.goal === "shared"
      ? "tour"
      : design.cores.length > 1
        ? "paired"
        : "loop";
  const level: GravityLevel = {
    index: 0,
    seed: 0x6f726269,
    source: "campaign",
    title: `${design.title} · ${design.field === "broad" ? "Broad" : design.field === "deep" ? "Deep" : "Gentle"} · ${population}`,
    layout: design.layout,
    family: kind,
    bounds: { x: -200, y: -200, width: 1600, height: 1600 },
    launch: { x: 600 + design.orbitRadius, y: 600 },
    bodies,
    objective: { kind, count: population, turns: 2, hold: 0 },
    physics: { planetGravity: true, planetCollisions: "none", planetRadius: 6 },
    witness: [],
    orbitPadding: design.goal === "shared" ? design.orbitRadius + 40 : 210,
    mechanics: [
      design.goal === "shared" ? "shared orbit" : "local orbits",
      ...(design.repel?.length ? ["repeller field"] : []),
      ...(population > 1 ? ["multiple planets"] : []),
    ],
  };
  if (design.goal === "shared")
    level.sharedOrbit = design.cores.map((_, i) => `well-${i + 1}`);
  else
    level.requirements = design.cores.map((_, i) => ({
      bodyId: `well-${i + 1}`,
      count: population,
      turns: 2,
    }));
  return level;
}
export function campaignBlueprint(index: number): GravityLevel {
  const level = structureBlueprint(CAMPAIGN_DESIGNS[index]);
  level.index = index;
  return level;
}
