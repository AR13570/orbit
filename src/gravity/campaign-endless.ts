import { CAMPAIGN_DESIGNS, campaignBlueprint } from "./campaign-design";
import solutions from "./campaign-endless-witnesses.json";
import { gravityLaunchPower } from "./physics";
import type { GravityLevel, Vec2, WitnessShot } from "./types";

type Family = "local" | "shared" | "relay";
const families: Family[] = ["local", "shared", "relay"];
/** Introductory geometry is promoted below; every campaign structure participates. */
export const ENDLESS_CAMPAIGN_TEMPLATES = CAMPAIGN_DESIGNS.flatMap((_, i) => [
  i,
]);
export const CAMPAIGN_ENDLESS_IDS = ENDLESS_CAMPAIGN_TEMPLATES.map(
  (i) => CAMPAIGN_DESIGNS[i].layout,
);
const familyOf = (index: number): Family => {
  const goal = CAMPAIGN_DESIGNS[index].goal;
  return goal === "shared" || goal === "relay" ? goal : "local";
};
function hash(value: number): number {
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return (value ^ (value >>> 15)) >>> 0;
}
function shuffled(seed: number, group: number[], cycle: number): number[] {
  const output = [...group];
  let state = hash(seed ^ Math.imul(cycle + 1, 0x9e3779b9));
  for (let i = output.length - 1; i > 0; i--) {
    state = hash(state + 0x6d2b79f5);
    const j = state % (i + 1);
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}
export function campaignEndlessLayoutId(seed: number, index: number): string {
  const offset = Math.max(0, index - 45);
  const block = Math.floor(offset / 3);
  const familySeed = hash(seed ^ 0x66616d69);
  const order = shuffled(familySeed, [0, 1, 2], block);
  // Swapping the first two leaves each block's raw last family unchanged, so
  // a boundary can be checked without walking any earlier generation history.
  if (
    (!block && order[0] === 2) ||
    (block && order[0] === shuffled(familySeed, [0, 1, 2], block - 1).at(-1))
  )
    [order[0], order[1]] = [order[1], order[0]];
  const family = families[order[offset % 3]];
  const group = ENDLESS_CAMPAIGN_TEMPLATES.filter(
    (i) => familyOf(i) === family,
  );
  const visit = Math.floor(offset / 3),
    cycle = Math.floor(visit / group.length);
  const templateSeed = hash(seed ^ families.indexOf(family));
  const permutation = shuffled(templateSeed, group, cycle);
  if (
    cycle &&
    permutation[0] === shuffled(templateSeed, group, cycle - 1).at(-1)
  )
    [permutation[0], permutation[1]] = [permutation[1], permutation[0]];
  return CAMPAIGN_DESIGNS[permutation[visit % group.length]].layout;
}
export function campaignEndlessDifficulty(index: number) {
  const band = Math.min(2, Math.floor(Math.max(0, index - 45) / 30));
  return { band, extraTurns: band, sweepMultiplier: 1 + band * 0.1 };
}
/** Shared by offline authoring and runtime, so a fallback cannot lower the requested demand. */
export function campaignEndlessBlueprint(
  template: number,
  band: number,
): GravityLevel {
  const level = campaignBlueprint(template);
  level.source = "procedural";
  level.objective.hold = 0;
  const promotedTitles: Record<number, string> = {
    0: "Counter-orbits",
    1: "Twin currents",
    2: "Shared duet",
    4: "Passing into orbit",
    5: "Double sanctuary",
    6: "Island currents",
    7: "Needle capture",
  };
  level.title = promotedTitles[template] ?? level.title;
  if (template === 0) {
    level.family = level.objective.kind = "counter";
    level.objective.count = 2;
    level.objective.turns = 2;
    delete level.requirements;
    level.mechanics = ["opposite directions", "multiple planets"];
  }
  if (template === 1 || template === 6) {
    level.requirements?.forEach((r, i) => {
      r.direction = i % 2 ? "counterclockwise" : "clockwise";
    });
    level.mechanics?.push("opposite directions");
  }
  if (template === 2) {
    level.sharedCounter = true;
    level.objective.count = 2;
    level.mechanics?.push("opposing shared orbits", "multiple planets");
  }
  if (template === 5) {
    level.objective.count = 2;
    level.requirements?.forEach((r) => {
      r.count = 2;
    });
    level.mechanics?.push("multiple planets");
  }
  if ((template === 4 || template === 7) && level.journey) {
    level.journey.legs[0].sweep = 1;
    level.journey.legs.at(-1)!.sweep = Math.PI * 2;
    level.mechanics?.push("transfer and capture");
  }
  if (level.journey) {
    for (const leg of level.journey.legs)
      if (leg.sweep < Math.PI * 2) leg.sweep *= 1 + band * 0.1;
  } else {
    // Chaotic fields are about finding a viable capture, rather than waiting
    // for arbitrarily many laps. Their verified ceiling stays stable across bands.
    const ceilings: Record<number, number> = {
      6: 1,
      12: 1,
      14: 2,
      17: 1,
      18: 1,
      26: 1,
      28: 1,
      29: 1,
      34: 1,
      36: 2,
      38: 2,
      39: 2,
      43: 1,
    };
    const ceiling = ceilings[template] ?? 3;
    level.objective.turns = Math.min(ceiling, level.objective.turns + band);
    for (const r of level.requirements ?? [])
      r.turns = Math.min(ceiling, (r.turns ?? 1) + band);
  }
  return level;
}
export function buildCampaignEndlessLevel(
  seed: number,
  index: number,
  layoutId: string,
  rotation: number,
  reflected = false,
  varied = false,
): GravityLevel {
  const template = CAMPAIGN_DESIGNS.findIndex((d) => d.layout === layoutId);
  if (template < 0)
    throw new Error(`Unknown endless campaign template: ${layoutId}`);
  const { band } = campaignEndlessDifficulty(index);
  const level = campaignEndlessBlueprint(template, band);
  level.seed = seed;
  level.index = index;
  level.witness = structuredClone(
    (solutions as Record<string, WitnessShot[]>)[`${template}:${band}`] ?? [],
  );
  if (!level.witness.length)
    throw new Error(`Missing endless campaign solution: ${template}:${band}`);
  if (varied) {
    for (let i = 0; i < level.bodies.length; i++) {
      const body = level.bodies[i];
      const dx =
        (hash(seed ^ Math.imul(index + 1, 173) ^ (i * 3)) / 0xffffffff - 0.5) *
        10;
      const dy =
        (hash(seed ^ Math.imul(index + 1, 271) ^ (i * 3 + 1)) / 0xffffffff -
          0.5) *
        10;
      body.position.x += dx;
      body.position.y += dy;
      body.strength *=
        1 +
        (hash(seed ^ Math.imul(index + 1, 397) ^ (i * 3 + 2)) / 0xffffffff -
          0.5) *
          0.04;
      const motion = level.motions?.find((m) => m.bodyId === body.id);
      if (motion) {
        motion.center.x += dx;
        motion.center.y += dy;
      }
    }
  }
  const vector = (v: Vec2): Vec2 => {
    const x = reflected ? -v.x : v.x;
    return {
      x: x * Math.cos(rotation) - v.y * Math.sin(rotation),
      y: x * Math.sin(rotation) + v.y * Math.cos(rotation),
    };
  };
  const position = (v: Vec2): Vec2 => {
    const p = vector({ x: v.x - 450, y: v.y - 450 });
    return { x: p.x + 450, y: p.y + 450 };
  };
  for (const body of level.bodies) body.position = position(body.position);
  for (const motion of level.motions ?? []) {
    motion.center = position(motion.center);
    if (motion.amplitude) motion.amplitude = vector(motion.amplitude);
  }
  if (reflected)
    for (const r of level.requirements ?? [])
      if (r.direction)
        r.direction =
          r.direction === "clockwise" ? "counterclockwise" : "clockwise";
  for (const shot of level.witness) {
    shot.position = position(shot.position!);
    shot.velocity = vector(shot.velocity!);
    shot.angle = Math.atan2(shot.velocity.y, shot.velocity.x);
    shot.power = gravityLaunchPower(
      Math.hypot(shot.velocity.x, shot.velocity.y),
    );
  }
  level.launch = { ...level.witness[0].position! };
  return level;
}
