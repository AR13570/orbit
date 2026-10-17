import { CAMPAIGN_DESIGNS, campaignBlueprint } from "./campaign-design";
import {
  generateGravityLevel,
  normalizeGravityIndex,
  normalizeGravitySeed,
} from "./generator";
import witnesses from "./campaign-witnesses.json";
import type { GravityLevel, WitnessShot } from "./types";
export const CAMPAIGN_LEVEL_COUNT = 45;
const cache = new Map<number, GravityLevel>();
function campaignLevel(index: number): GravityLevel {
  const existing = cache.get(index);
  if (existing) return structuredClone(existing);
  const level = campaignBlueprint(index);
  level.witness = structuredClone(
    (witnesses as Record<string, WitnessShot[]>)[String(index)] ?? [],
  );
  if (level.witness[0]?.position)
    level.launch = { ...level.witness[0].position };
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
  return CAMPAIGN_DESIGNS.map((d, index) => ({
    index,
    title: d.title,
    family: d.layout,
    mechanics: [...(campaignLevel(index).mechanics ?? [])],
  }));
}
