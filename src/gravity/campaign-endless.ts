import {
  CAMPAIGN_AUTHORED_ORDER,
  CAMPAIGN_DESIGNS,
  structureBlueprint,
} from "./campaign-design";
import solutions from "./campaign-endless-witnesses.json";
import transforms from "./campaign-endless-transforms.json";
import { gravityLaunchPower } from "./physics";
import type { GravityLevel, Vec2, WitnessShot } from "./types";
const profileId = (index: number) =>
  `${CAMPAIGN_DESIGNS[index].layout}:${CAMPAIGN_DESIGNS[index].field}`;
export const ENDLESS_CAMPAIGN_TEMPLATES = CAMPAIGN_DESIGNS.flatMap((_, i) =>
  CAMPAIGN_DESIGNS.findIndex((__, j) => profileId(j) === profileId(i)) === i
    ? [i]
    : [],
).sort((a, b) => CAMPAIGN_AUTHORED_ORDER[a] - CAMPAIGN_AUTHORED_ORDER[b]);
/** These are field profiles of nine base structures, not additional geometries. */
export const CAMPAIGN_ENDLESS_IDS = ENDLESS_CAMPAIGN_TEMPLATES.map(profileId);
function hash(n: number) {
  n = Math.imul(n ^ (n >>> 16), 0x21f0aaad);
  n = Math.imul(n ^ (n >>> 15), 0x735a2d97);
  return (n ^ (n >>> 15)) >>> 0;
}
const bases = [
  ...new Set(
    ENDLESS_CAMPAIGN_TEMPLATES.map((index) => CAMPAIGN_DESIGNS[index].layout),
  ),
];
function order(seed: number, cycle: number) {
  const output = [...bases];
  let state = hash(seed ^ Math.imul(cycle + 1, 0x9e3779b9));
  for (let i = output.length - 1; i > 0; i--) {
    state = hash(state + 0x6d2b79f5);
    const j = state % (i + 1);
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}
export function campaignEndlessLayoutId(seed: number, index: number): string {
  const offset = Math.max(0, index - 45),
    cycle = Math.floor(offset / bases.length),
    sequence = order(seed, cycle);
  // Only the first two positions are swapped, so previous raw last is stable.
  if (cycle && sequence[0] === order(seed, cycle - 1).at(-1))
    [sequence[0], sequence[1]] = [sequence[1], sequence[0]];
  const base = sequence[offset % sequence.length];
  const profiles = CAMPAIGN_ENDLESS_IDS.filter((id) =>
    id.startsWith(`${base}:`),
  );
  return profiles[(cycle + hash(seed ^ bases.indexOf(base))) % profiles.length];
}
/** Increasing populations and complete revolutions have an explicit proved ceiling. */
export function campaignEndlessDifficulty(index: number) {
  const band = Math.min(2, Math.floor(Math.max(0, index - 45) / 40));
  return { band, extraTurns: band, sweepMultiplier: 1 };
}
export function campaignEndlessTransforms(
  profile: string,
  index: number,
): { quarter: number; reflected: boolean }[] {
  const { band } = campaignEndlessDifficulty(index);
  const proved = (
    transforms as Record<string, { quarter: number; reflected: boolean }[]>
  )[`${profile}:${band}`];
  if (!proved?.length)
    throw new Error(`Missing stable transform proof: ${profile}/${band}`);
  return proved.map((t) => ({ ...t }));
}
export function campaignEndlessBlueprint(
  template: number,
  band: number,
): GravityLevel {
  const variants = CAMPAIGN_DESIGNS.filter(
    (_, i) => profileId(i) === profileId(template),
  );
  const demand = Math.min(3, Math.max(1, band + 1));
  const design =
    variants.filter((d) => d.population <= demand).at(-1) ?? variants[0];
  const level = structureBlueprint(design);
  level.source = "procedural";
  level.objective.turns =
    design.field === "gentle" ? 2 : 2 + Math.min(2, Math.max(0, band));
  for (const requirement of level.requirements ?? [])
    requirement.turns = level.objective.turns;
  return level;
}
/** Quarter turns and reflection preserve the force law and remain within offline camera proofs. */
export function transformCampaignLevel(
  level: GravityLevel,
  quarterTurn: number,
  reflected = false,
): GravityLevel {
  const quarter = ((Math.round(quarterTurn) % 4) + 4) % 4;
  const vector = (v: Vec2): Vec2 => {
    const x = reflected ? -v.x : v.x;
    return quarter === 0
      ? { x, y: v.y }
      : quarter === 1
        ? { x: -v.y, y: x }
        : quarter === 2
          ? { x: -x, y: -v.y }
          : { x: v.y, y: -x };
  };
  const position = (v: Vec2): Vec2 => {
    const p = vector({ x: v.x - 600, y: v.y - 600 });
    return { x: p.x + 600, y: p.y + 600 };
  };
  for (const body of level.bodies) body.position = position(body.position);
  for (const shot of level.witness) {
    shot.position = position(shot.position!);
    shot.velocity = vector(shot.velocity!);
    shot.angle = Math.atan2(shot.velocity.y, shot.velocity.x);
    shot.power = gravityLaunchPower(
      Math.hypot(shot.velocity.x, shot.velocity.y),
    );
  }
  level.launch = level.witness.length
    ? { ...level.witness[0].position! }
    : position(level.launch);
  return level;
}
export function buildCampaignEndlessLevel(
  seed: number,
  index: number,
  layoutId: string,
  rotation = 0,
  reflected = false,
  _varied = false,
): GravityLevel {
  const template = ENDLESS_CAMPAIGN_TEMPLATES.find(
    (i) => profileId(i) === layoutId,
  );
  if (template === undefined)
    throw new Error(`Unknown stable field: ${layoutId}`);
  const { band } = campaignEndlessDifficulty(index),
    level = campaignEndlessBlueprint(template, band);
  level.seed = seed;
  level.index = index;
  level.witness = structuredClone(
    (solutions as Record<string, WitnessShot[]>)[`${template}:${band}`] ?? [],
  );
  if (!level.witness.length)
    throw new Error(`Missing validated stable field: ${template}:${band}`);
  return transformCampaignLevel(
    level,
    Math.round(rotation / (Math.PI / 2)),
    reflected,
  );
}
