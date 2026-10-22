import { expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { CAMPAIGN_DESIGNS } from "../../src/gravity/campaign-design";
import { getGravityLevel } from "../../src/gravity/campaign";
import {
  buildCampaignEndlessLevel,
  CAMPAIGN_ENDLESS_IDS,
} from "../../src/gravity/campaign-endless";
import { proofScenarios, stableProof } from "./stable-authoring-utils";
import {
  GRAVITY_SPEED_SCALE,
  PARTICLE_GRAVITY_STRENGTH,
  PARTICLE_NEAR_RANGE,
  PARTICLE_NEAR_WEIGHT,
} from "../../src/gravity/physics";

/** Portable exhaustive command: GRAVITY_VERIFY_STABILITY=1 npx vitest run tests/gravity/stable-authoring.test.ts */
it.skipIf(process.env.GRAVITY_VERIFY_STABILITY !== "1")(
  "proves every campaign entry and generated field under sequential, responsive, perturbed play",
  () => {
    const evidence: {
      protocol: Record<string, unknown>;
      campaign: unknown[];
      generation: unknown[];
      rejectedVariants: string[];
      failures: string[];
    } = {
      protocol: {
        fixedStep: 1 / 120,
        particleGravity: true,
        particleGravityStrength: PARTICLE_GRAVITY_STRENGTH,
        particleNearRange: PARTICLE_NEAR_RANGE,
        particleNearWeight: PARTICLE_NEAR_WEIGHT,
        particleSofteningMinimum: 2,
        particleSofteningRadiusFactor: 0.5,
        grouping: false,
        minimumRealLaunchGap: 6 / GRAVITY_SPEED_SCALE,
        playback: GRAVITY_SPEED_SCALE,
        postCompletionSeconds: 120,
        postCompletionFullLaps: 10,
        additionalPureThinkingScenarios:
          "Seven pure +3/+5 simulated-second pauses across radius4,6,8,32 require the complete objective followed by3 simulated seconds. The original15 scenarios retain120 simulated seconds and10 additional laps. The radius32/+3 pure pause is one of those original long-survival scenarios.",
        perturbation: {
          angleRadians: 0.01,
          speedFraction: 0.01,
          positionWorldUnits: 1,
          extraThinkingSimulatedSeconds: [3, 5],
        },
        sizes:
          "base radius4..16; size factor1 or2; constant-area-density mass1 or4",
        generation:
          "Gentle profiles keep two revolutions while their populations grow. Deep and Broad profiles grow to four revolutions. Highest demand tests all quarter turns and reflection states; only passing transforms are approved. Lower bands use the proved untransformed orientation. These are variants, not new structures.",
      },
      campaign: [],
      generation: [],
      rejectedVariants: [],
      failures: [],
    };
    const approved: Record<string, { quarter: number; reflected: boolean }[]> =
      {};
    const save = () => {
      mkdirSync("docs/verification", { recursive: true });
      writeFileSync(
        "docs/verification/stable-campaign.json",
        JSON.stringify(evidence, null, 2) + "\n",
      );
    };
    for (let index = 0; index < 45; index++) {
      const level = getGravityLevel(42, index),
        design = CAMPAIGN_DESIGNS[index];
      const scenarios = proofScenarios(level).map((s) => ({
        scenario: s.name,
        requiredPostCompletionSeconds: s.postCompletionSeconds ?? 120,
        requiredPostCompletionLaps: s.postCompletionLaps ?? 10,
        ...stableProof(level, level.witness, s),
      }));
      evidence.campaign.push({
        index,
        base: design.layout,
        field: design.field,
        population: design.population,
        scenarios,
      });
      for (const result of scenarios)
        if (!result.ok)
          evidence.failures.push(
            `campaign ${index}/${result.scenario}: ${result.reason}`,
          );
      save();
    }
    for (const profile of CAMPAIGN_ENDLESS_IDS)
      for (let band = 0; band < 3; band++)
        for (let quarter = 0; quarter < (band === 2 ? 4 : 1); quarter++)
          for (const reflected of band === 2 ? [false, true] : [false]) {
            const level = buildCampaignEndlessLevel(
              42,
              45 + 40 * band,
              profile,
              (quarter * Math.PI) / 2,
              reflected,
            );
            const scenarios = proofScenarios(level).map((s) => ({
              scenario: s.name,
              requiredPostCompletionSeconds: s.postCompletionSeconds ?? 120,
              requiredPostCompletionLaps: s.postCompletionLaps ?? 10,
              ...stableProof(level, level.witness, s),
            }));
            const accepted = scenarios.every((s) => s.ok);
            evidence.generation.push({
              profile,
              band,
              quarter,
              reflected,
              population: level.objective.count,
              turns: level.objective.turns,
              accepted,
              scenarios,
            });
            const key = `${profile}:${band}`;
            approved[key] ??= [];
            if (accepted) approved[key].push({ quarter, reflected });
            else
              for (const result of scenarios)
                if (!result.ok)
                  evidence.rejectedVariants.push(
                    `${key}/${quarter}/${reflected}/${result.scenario}: ${result.reason}`,
                  );
            save();
          }
    for (const [key, variants] of Object.entries(approved))
      if (!variants.length)
        evidence.failures.push(`No proved transform for ${key}`);
    save();
    expect(evidence.failures).toEqual([]);
    writeFileSync(
      "src/gravity/campaign-endless-transforms.json",
      JSON.stringify(approved, null, 2) + "\n",
    );
  },
  900000,
);
