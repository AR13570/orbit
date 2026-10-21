import { corePositionLabel } from "./core-position-label";
import { objectiveText } from "./simulation";
import type { GravitySnapshot, PlanetCollisionPolicy } from "./types";

/** Immutable values displayed by React, independent of the mutable physics world. */
export interface GravityHud {
  levelIndex: number;
  title: string;
  objective: string;
  hasObjective: boolean;
  directionText: string;
  journeyLabels: readonly string[] | null;
  bestJourneyLeg: number;
  sharedOrbit: boolean;
  current: number;
  target: number;
  complete: boolean;
  alive: number;
  planetRadius: number;
  projectileSize: number;
  planetGravity: boolean;
  planetCollisions: PlanetCollisionPolicy;
}

export function gravityHudSnapshot(
  state: GravitySnapshot,
  previous?: GravityHud,
): GravityHud {
  const { level } = state;
  let alive = 0,
    bestJourneyLeg = 0;
  for (const particle of state.particles) {
    if (!particle.alive) continue;
    alive++;
    bestJourneyLeg = Math.max(bestJourneyLeg, particle.journey?.leg ?? 0);
  }
  const next: GravityHud = {
    levelIndex: level.index,
    title: level.orbitPadding !== undefined ? (level.title ?? "") : "",
    objective: objectiveText(level),
    hasObjective: level.objective.kind !== "none",
    directionText: level.requirements?.some(
      (goal) => goal.direction && goal.direction !== "either",
    )
      ? level.requirements
          .map(
            (goal) =>
              `${corePositionLabel(level, goal.bodyId)}: ${goal.direction ?? "either direction"}`,
          )
          .join(". ")
      : "",
    journeyLabels:
      level.journey?.legs.map((leg) => corePositionLabel(level, leg.bodyId)) ??
      null,
    bestJourneyLeg,
    sharedOrbit: !!level.sharedOrbit,
    current: state.progress.current,
    target: state.progress.target,
    complete: state.complete,
    alive,
    planetRadius: state.physics.planetRadius,
    projectileSize: state.projectileSize ?? 1,
    planetGravity: state.physics.planetGravity,
    planetCollisions: state.physics.planetCollisions,
  };
  if (previous) {
    const labels = next.journeyLabels,
      oldLabels = previous.journeyLabels;
    const sameLabels =
      labels === oldLabels ||
      (labels !== null &&
        oldLabels !== null &&
        labels.length === oldLabels.length &&
        labels.every((label, i) => label === oldLabels[i]));
    if (sameLabels) {
      let unchanged = true;
      for (const key in next) {
        if (
          key !== "journeyLabels" &&
          next[key as keyof GravityHud] !== previous[key as keyof GravityHud]
        ) {
          unchanged = false;
          break;
        }
      }
      if (unchanged) return previous;
    }
  }
  return next;
}
