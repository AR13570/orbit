import { it, expect } from "vitest";
import {
  generateGravityLevel,
  mixGravitySeed,
  verifyGeneratedLevel,
  verifyLevel,
} from "../../src/gravity/generator";
import {
  CAMPAIGN_DESIGNS,
  STABLE_CAMPAIGN_STRUCTURES,
} from "../../src/gravity/campaign-design";
import {
  buildCampaignEndlessLevel,
  campaignEndlessBlueprint,
  campaignEndlessDifficulty,
  campaignEndlessLayoutId,
  campaignEndlessTransforms,
  ENDLESS_CAMPAIGN_TEMPLATES,
  CAMPAIGN_ENDLESS_IDS,
} from "../../src/gravity/campaign-endless";
import { GRAVITY_SPEED_SCALE } from "../../src/gravity/physics";
import {
  createState,
  goalProgress,
  objectiveText,
} from "../../src/gravity/simulation";

const profileId = (template: number) =>
  `${CAMPAIGN_DESIGNS[template].layout}:${CAMPAIGN_DESIGNS[template].field}`;
const bandIndices = [45, 85, 125];

it("reshuffles all nine base structures without immediate repeats and cycles every field profile", () => {
  const bases = new Set(
    STABLE_CAMPAIGN_STRUCTURES.map((design) => design.layout),
  );
  expect(bases.size).toBe(9);
  expect(CAMPAIGN_ENDLESS_IDS).toHaveLength(20);
  const seedSequences: string[][] = [];
  for (const seed of [0, 7, 42, 137, 0xffffffff]) {
    const seenProfiles = new Set<string>();
    const sequence = Array.from({ length: bases.size * 6 }, (_, offset) =>
      campaignEndlessLayoutId(seed, 45 + offset),
    );
    sequence.forEach((id, index) => {
      expect(CAMPAIGN_ENDLESS_IDS).toContain(id);
      expect(campaignEndlessLayoutId(seed, 45 + index)).toBe(id);
      if (index)
        expect(id.split(":")[0]).not.toBe(sequence[index - 1].split(":")[0]);
      seenProfiles.add(id);
    });
    for (let start = 0; start < sequence.length; start += bases.size)
      expect(
        new Set(
          sequence
            .slice(start, start + bases.size)
            .map((id) => id.split(":")[0]),
        ),
      ).toEqual(bases);
    expect(seenProfiles).toEqual(new Set(CAMPAIGN_ENDLESS_IDS));
    seedSequences.push(sequence);
  }
  expect(
    new Set(seedSequences.map((sequence) => JSON.stringify(sequence))).size,
  ).toBe(seedSequences.length);
});

it("raises bounded population and complete-turn demand without changing each profile's force field", () => {
  expect(
    [45, 84, 85, 124, 125, Number.MAX_SAFE_INTEGER - 1].map(
      (index) => campaignEndlessDifficulty(index).band,
    ),
  ).toEqual([0, 0, 1, 1, 2, 2]);
  let growsPopulation = false;
  let highestPopulation = 0;
  for (const template of ENDLESS_CAMPAIGN_TEMPLATES) {
    const field = CAMPAIGN_DESIGNS[template].field;
    let previous = campaignEndlessBlueprint(template, 0);
    for (const band of [0, 1, 2]) {
      const next = campaignEndlessBlueprint(template, band);
      expect(next.bodies).toEqual(previous.bodies);
      expect(next.physics).toEqual(previous.physics);
      expect(next.motions).toEqual(previous.motions);
      expect(next.objective.count).toBeGreaterThanOrEqual(
        previous.objective.count,
      );
      expect(next.objective.count).toBeGreaterThanOrEqual(1);
      expect(next.objective.count).toBeLessThanOrEqual(3);
      expect(goalProgress(createState(next)).target).toBeGreaterThanOrEqual(
        goalProgress(createState(previous)).target,
      );
      expect(next.objective.turns).toBe(field === "gentle" ? 2 : 2 + band);
      expect(next.journey).toBeUndefined();
      for (const requirement of next.requirements ?? [])
        expect(requirement.turns).toBe(next.objective.turns);
      growsPopulation ||= next.objective.count > previous.objective.count;
      highestPopulation = Math.max(highestPopulation, next.objective.count);
      previous = next;
    }
  }
  expect(growsPopulation).toBe(true);
  expect(highestPopulation).toBe(3);
});

it("physically replays every current field and difficulty band at calibrated sizes and outermost bounds", () => {
  for (const id of CAMPAIGN_ENDLESS_IDS)
    for (const index of bandIndices) {
      const transform = campaignEndlessTransforms(id, index)[0];
      const level = buildCampaignEndlessLevel(
        42,
        index,
        id,
        (transform.quarter * Math.PI) / 2,
        transform.reflected,
      );
      expect(verifyGeneratedLevel(level), `${id}/${index}`).toBe(true);
      expect(level.witness).toHaveLength(
        goalProgress(createState(level)).target,
      );
      expect(level.objective.hold).toBe(0);
      expect(level.physics?.planetGravity).toBe(true);
      expect(level.physics?.planetCollisions).toBe("none");
      expect(objectiveText(level)).not.toMatch(/seconds|hold/i);
      level.witness.forEach((shot, i) => {
        expect(shot.power).toBeGreaterThanOrEqual(0);
        expect(shot.power).toBeLessThanOrEqual(1);
        if (i)
          expect(
            (shot.time - level.witness[i - 1].time) / GRAVITY_SPEED_SCALE,
          ).toBeGreaterThanOrEqual(4 - 1e-9);
      });
    }
}, 120000);

it("generates only manifest-approved rotations and reflections for the selected profile and band", () => {
  for (const seed of [7, 42, 137])
    for (const index of [...bandIndices, 10000]) {
      const id = campaignEndlessLayoutId(mixGravitySeed(seed, 0), index);
      const approved = campaignEndlessTransforms(id, index);
      expect(approved.length).toBeGreaterThan(0);
      const candidates = approved.map((transform) =>
        buildCampaignEndlessLevel(
          seed,
          index,
          id,
          (transform.quarter * Math.PI) / 2,
          transform.reflected,
        ),
      );
      expect(candidates, `${seed}/${index}/${id}`).toContainEqual(
        generateGravityLevel(seed, index),
      );
      for (const candidate of candidates) {
        expect(candidate.journey).toBeUndefined();
        expect(candidate.objective.turns).toBeGreaterThanOrEqual(2);
        expect(candidate.sharedOrbit).toEqual(candidates[0].sharedOrbit);
        expect(candidate.requirements).toEqual(candidates[0].requirements);
      }
    }
});

it("continues through distant indices with the selected proved demand and no easier fallback", () => {
  for (const index of [
    45,
    46,
    85,
    125,
    126,
    1000,
    10000,
    65535,
    Number.MAX_SAFE_INTEGER - 1,
  ]) {
    const id = campaignEndlessLayoutId(mixGravitySeed(42, 0), index);
    expect(CAMPAIGN_ENDLESS_IDS).toContain(id);
    const template = ENDLESS_CAMPAIGN_TEMPLATES.find(
      (candidate) => profileId(candidate) === id,
    )!;
    const expected = campaignEndlessBlueprint(
      template,
      campaignEndlessDifficulty(index).band,
    );
    const level = generateGravityLevel(42, index);
    expect(level).toMatchObject({
      index,
      seed: 42,
      source: "procedural",
      layout: id.split(":")[0],
    });
    expect(level.objective).toEqual(expected.objective);
    expect(level.requirements).toEqual(expected.requirements);
    expect(level.physics).toEqual(expected.physics);
    expect(level.bodies).toHaveLength(expected.bodies.length);
    expect(goalProgress(createState(level)).target).toBe(
      goalProgress(createState(expected)).target,
    );
    expect(verifyLevel(level), `${index}/${id}`).toBe(true);
  }
}, 60000);
