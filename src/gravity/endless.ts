/** Legacy formation authoring and physics regression fixtures. Runtime endless
 * levels are provided by campaign-endless.ts. */
import type { Vec2 } from "../game/types";
import type {
  GravityLevel,
  GravityOrbitRequirement,
  WitnessShot,
} from "./types";
import { buildGravityLayout, GRAVITY_LAYOUTS } from "./layouts";
import { gravityLaunchPower } from "./physics";
import { gravityDifficulty } from "./difficulty";
import fixtures from "./endless-fixtures.json";
interface EndlessFixture {
  requirements?: GravityOrbitRequirement[];
  witness: WitnessShot[];
}
const solutions = fixtures as Record<string, EndlessFixture>;
// These older launch fixtures fail with the current mutual gravity. Keep them
// for authoring while the runtime schedules only verified formations.
const authoringOnlyLayouts = new Set([
  "unequal-binary",
  "triple-line",
  "broken-ring",
  "repeller-gate",
  "unequal-chain",
]);
// Counterflow needs directional per-core rendering. The other two aliases have
// the same visible single-core arrangement once the population budget is shared.
export const ENDLESS_LAYOUT_IDS = Object.keys(solutions).filter(
  (id) =>
    !["counterflow", "compact-swarm", "concentric-shells"].includes(id) &&
    !authoringOnlyLayouts.has(id),
);
export function endlessLayoutId(seed: number, index: number): string {
  const offset = index < 45 ? index : index - 45,
    pool = ENDLESS_LAYOUT_IDS;
  const divisor = (a: number, b: number): number =>
    b === 0 ? a : divisor(b, a % b);
  let stride = 1 + ((seed >>> 8) % (pool.length - 1));
  while (divisor(stride, pool.length) !== 1)
    stride = (stride % pool.length) + 1;
  return pool[
    ((offset % pool.length) * stride + ((seed >>> 0) % pool.length)) %
      pool.length
  ];
}
export function buildEndlessGravityLevel(
  seed: number,
  index: number,
  layoutId: string,
  rotation: number,
): GravityLevel {
  const difficulty = gravityDifficulty(index),
    layout = GRAVITY_LAYOUTS.find((item) => item.id === layoutId)!;
  const level = buildGravityLayout(layout, {
    seed,
    index,
    source: "procedural",
    title: `Endless ${Math.max(0, index - 45) + 1}: ${layoutId.split("-").join(" ")}`,
    count: 1,
    turns: difficulty.turns,
  });
  // Enlarged planets keep the authored clearance around ENDLESS cores.
  for (const body of level.bodies)
    if (body.kind === "attractor") body.radius = Math.max(1, body.radius - 3);
  const solution = solutions[layoutId];
  level.objective.count = difficulty.population;
  if (!level.mechanics?.includes("multiple planets"))
    level.mechanics?.push("multiple planets");
  if (solution.requirements) {
    const counts = solution.requirements.map(() => 0);
    let assigned = 0;
    for (
      let round = 0;
      round < difficulty.population && assigned < difficulty.population;
      round++
    )
      for (
        let i = 0;
        i < counts.length && assigned < difficulty.population;
        i++
      ) {
        if (counts[i] >= solution.requirements[i].count) continue;
        counts[i]++;
        assigned++;
      }
    level.requirements = solution.requirements
      .map((requirement, i) => ({
        ...requirement,
        count: counts[i],
        turns: difficulty.turns,
      }))
      .filter((r) => r.count > 0);
  } else delete level.requirements;
  level.witness = structuredClone(solution.witness);
  const rotate = (v: Vec2): Vec2 => ({
    x: v.x * Math.cos(rotation) - v.y * Math.sin(rotation),
    y: v.x * Math.sin(rotation) + v.y * Math.cos(rotation),
  });
  const position = (v: Vec2): Vec2 => {
    const relative = rotate({ x: v.x - 450, y: v.y - 450 });
    return { x: relative.x + 450, y: relative.y + 450 };
  };
  for (const body of level.bodies) body.position = position(body.position);
  for (const motion of level.motions ?? []) {
    motion.center = position(motion.center);
    if (motion.kind === "circle") motion.phase = (motion.phase ?? 0) + rotation;
    else if (motion.amplitude) motion.amplitude = rotate(motion.amplitude);
  }
  for (const shot of level.witness) {
    shot.position = position(shot.position!);
    shot.velocity = rotate(shot.velocity!);
    shot.angle = Math.atan2(shot.velocity.y, shot.velocity.x);
    shot.power = gravityLaunchPower(
      Math.hypot(shot.velocity.x, shot.velocity.y),
    );
  }
  level.launch = { ...level.witness[0].position! };
  return level;
}
