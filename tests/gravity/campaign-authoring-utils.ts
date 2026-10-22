import {
  gravityLaunchPower,
  gravityLaunchSpeed,
} from "../../src/gravity/physics";
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
  const framed = {
    ...level,
    launch: { ...shots[0].position! },
    witness: shots,
  };
  const scenarios = proofScenarios(framed);
  const early = new Set([
    "thinking-3-radius-6",
    "aim-plus",
    "aim-minus-paused",
    "maximum",
  ]);
  // Reject fragile close encounters early, then retain every responsive and
  // aiming-tolerance check. Pure thinking pauses also need sustained survival.
  return [
    ...scenarios.filter((s) => early.has(s.name)),
    ...[6, 32].map((radius) => ({
      name: "sustained thinking pause",
      radius,
      mass: radius === 6 ? 1 : 4,
      delay: 5,
      postCompletionSeconds: 30,
      postCompletionLaps: 2,
    })),
    ...scenarios.filter((s) => !early.has(s.name)),
  ].every((s) => stableProof(framed, shots, s).ok);
}
export function authorCampaignSolution(level: GravityLevel): WitnessShot[] {
  if (validCampaignSolution(level, level.witness))
    return structuredClone(level.witness);
  if (level.witness.length)
    for (const factor of [1.005, 0.995, 1.01, 0.99, 1.02, 0.98, 1.05, 0.95]) {
      const shots = level.witness.map((shot) => {
        const velocity = {
          x: shot.velocity!.x * factor,
          y: shot.velocity!.y * factor,
        };
        return {
          ...structuredClone(shot),
          velocity,
          power: gravityLaunchPower(Math.hypot(velocity.x, velocity.y)),
        };
      });
      if (validCampaignSolution(level, shots)) return shots;
    }
  for (const radius of level.sharedOrbit
    ? [450, 470, 490]
    : [190, 210, 230, 250])
    for (const spacing of [6, 8])
      for (const factor of [1, 1.01, 0.99, 1.02, 0.98, 1.05, 0.95, 1.1, 0.9])
        for (let phase = 0; phase < 16; phase++) {
          const shots = candidateShots(
            level,
            radius,
            (phase * Math.PI) / 8,
            spacing,
            factor,
          );
          if (validCampaignSolution(level, shots)) return shots;
        }
  throw new Error(
    `No sustained sequential solution for ${level.title}; do not publish this field.`,
  );
}
