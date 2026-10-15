import { buildGravityLayout, GRAVITY_LAYOUTS } from "./layouts";
import {
  generateGravityLevel,
  normalizeGravityIndex,
  normalizeGravitySeed,
} from "./generator";
import type { GravityLevel } from "./types";
export const CAMPAIGN_LEVEL_COUNT = 45;
interface AuthoredLevel {
  layout: string;
  title: string;
  count?: number;
  turns?: number;
  strength?: number;
}
/** Newly authored reference-inspired puzzles, not the undisclosed original campaign. */
const authored: readonly AuthoredLevel[] = [
  { layout: "single-well", title: "First orbit" },
  { layout: "single-well", title: "Two companions", count: 2 },
  { layout: "compact-swarm", title: "Color gathering", count: 4 },
  { layout: "concentric-shells", title: "Orbital layers", count: 5 },
  { layout: "counterflow", title: "Passing directions" },
  { layout: "compact-swarm", title: "Keep the crowd", count: 7 },
  { layout: "separated-twins", title: "A home for each" },
  { layout: "binary-wide", title: "Around the pair" },
  { layout: "unequal-binary", title: "Heavy and light" },
  { layout: "separated-twins", title: "Twin populations", count: 3 },
  { layout: "repeller-gate", title: "Through the gate" },
  { layout: "repeller-channel", title: "The quiet channel" },
  { layout: "repeller-triangle", title: "Three boundaries" },
  { layout: "repeller-island", title: "Island of pressure" },
  { layout: "triangle", title: "Three corners" },
  { layout: "triple-line", title: "Straight alignment" },
  { layout: "unequal-triangle", title: "An uneven balance" },
  { layout: "square", title: "Four neighborhoods" },
  { layout: "diamond", title: "Cardinal points" },
  { layout: "cross", title: "At the crossing" },
  { layout: "staggered-ladder", title: "Alternating steps" },
  { layout: "open-v", title: "Open arms" },
  { layout: "zigzag", title: "Changing sides" },
  { layout: "five-star", title: "A center and five" },
  { layout: "pentagon", title: "Fivefold" },
  { layout: "hexagon", title: "Sixfold" },
  { layout: "offset-crescent", title: "Following the crescent" },
  { layout: "broken-ring", title: "The opening" },
  { layout: "eight-well-enclosure", title: "Inside eight giants" },
  { layout: "double-ring", title: "Nested constellations" },
  { layout: "three-clusters", title: "Three separate skies" },
  { layout: "unequal-chain", title: "A chain of masses" },
  { layout: "concentric-shells", title: "A sky full of color", count: 12 },
  { layout: "triangle", title: "Three busy corners", count: 3 },
  { layout: "elastic-pair", title: "Elastic neighborhoods" },
  { layout: "merging-swarm", title: "A growing family" },
  { layout: "self-gravitating-constellation", title: "Pulling together" },
  { layout: "elastic-pair", title: "Mutual company", count: 4 },
  { layout: "moving-pendulum", title: "A wandering center" },
  { layout: "moving-carousel", title: "Turning twins" },
  { layout: "moving-pendulum", title: "Follow the motion", count: 4 },
  { layout: "eight-well-enclosure", title: "The inner gathering", count: 8 },
  { layout: "repeller-island", title: "Four flowing shores", count: 2 },
  {
    layout: "self-gravitating-constellation",
    title: "Constellation in company",
    count: 3,
  },
  {
    layout: "moving-carousel",
    title: "Two living skies",
    count: 3,
    turns: 2,
  },
];
const cache = new Map<number, GravityLevel>();
function campaignLevel(index: number): GravityLevel {
  const existing = cache.get(index);
  if (existing) return structuredClone(existing);
  const config = authored[index],
    layout = GRAVITY_LAYOUTS.find((item) => item.id === config.layout)!;
  const level = buildGravityLayout(layout, {
    ...config,
    index,
    seed: 0x6f726269,
    source: "campaign",
  });
  cache.set(index, structuredClone(level));
  return level;
}
export function getGravityLevel(seed: number, index: number): GravityLevel {
  seed = normalizeGravitySeed(seed);
  index = normalizeGravityIndex(index);
  return index < CAMPAIGN_LEVEL_COUNT
    ? campaignLevel(index)
    : generateGravityLevel(seed, index);
}
export function getCampaignCatalog(): {
  index: number;
  title: string;
  family: string;
  mechanics: string[];
}[] {
  return authored.map((config, index) => {
    const level = campaignLevel(index);
    return {
      index,
      title: config.title,
      family: config.layout,
      mechanics: [...(level.mechanics ?? [])],
    };
  });
}
