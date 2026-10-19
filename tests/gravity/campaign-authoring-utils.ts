import { gravityLaunchSpeed } from "../../src/gravity/physics";
import type { GravityLevel, WitnessShot } from "../../src/gravity/types";
import {
  candidateShots,
  proofScenarios,
  stableProof,
} from "./stable-authoring-utils";
/** Authoring accepts sustained evidence, never just a first winning frame. */
export function validCampaignSolution(
  level: GravityLevel,
  shots: WitnessShot[],
): boolean {
  if (
    shots.some(
      (shot) =>
        !shot.position ||
        !shot.velocity ||
        !Number.isFinite(shot.power) ||
        Math.hypot(shot.velocity.x, shot.velocity.y) > gravityLaunchSpeed(1),
    ) ||
    !shots.length ||
    shots.some((shot, i) => i > 0 && shot.time - shots[i - 1].time < 4.8)
  )
    return false;
  return proofScenarios(level).every((s) => stableProof(level, shots, s).ok);
}
export function authorCampaignSolution(level: GravityLevel): WitnessShot[] {
  if (validCampaignSolution(level, level.witness))
    return structuredClone(level.witness);
  for (const radius of level.sharedOrbit
    ? [450, 470, 490]
    : [190, 210, 230, 250])
    for (const factor of [0.9, 0.95, 1, 1.05, 1.1])
      for (let phase = 0; phase < 4; phase++) {
        const shots = candidateShots(
          level,
          radius,
          (phase * Math.PI) / 2,
          6,
          factor,
        );
        if (validCampaignSolution(level, shots)) return shots;
      }
  throw new Error(
    `No sustained sequential solution for ${level.title}; do not publish this field.`,
  );
}
