import { expect, it } from "vitest";
import {
  verifyLevel,
  witnessCompletionTime,
} from "../../src/gravity/generator";
import { buildGravityLayout, GRAVITY_LAYOUTS } from "../../src/gravity/layouts";
import { createState } from "../../src/gravity/simulation";
import { getGravityLevel } from "../../src/gravity/campaign";

it("uses no-rebound soft contacts for every regular campaign formation", () => {
  for (let index = 0; index < 45; index++)
    expect(
      createState(getGravityLevel(42, index)).physics.planetCollisions,
      `campaign ${index}`,
    ).toBe("soft");
});

it("completes opposite-direction orbits with soft contacts across rotations and force scales", () => {
  const layout = GRAVITY_LAYOUTS.find((item) => item.id === "counterflow")!;
  for (const [rotation, strength] of [
    [0, 1],
    [0.371, 0.7],
    [1.413, 1.3],
  ]) {
    const level = buildGravityLayout(layout, {
      index: 4,
      seed: 42,
      title: "Passing directions",
      source: "campaign",
      rotation,
      strength,
    });
    expect(createState(level).physics.planetCollisions).toBe("soft");
    expect(verifyLevel(level), `${rotation}/${strength}`).toBe(true);
    expect(
      witnessCompletionTime(level, 1 / 240),
      `${rotation}/${strength}`,
    ).not.toBeNull();
  }
});

it("keeps all twelve planets orbiting the shell core with soft contacts", () => {
  const layout = GRAVITY_LAYOUTS.find(
    (item) => item.id === "concentric-shells",
  )!;
  for (const rotation of [0, 0.371, 1.413]) {
    const strength = 1;
    const level = buildGravityLayout(layout, {
      index: 32,
      seed: 42,
      title: "A sky full of color",
      source: "campaign",
      count: 12,
      turns: 1,
      rotation,
      strength,
    });
    const state = createState(level);
    expect(state.physics.planetCollisions).toBe("soft");
    expect(level.requirements).toEqual([
      { bodyId: "well-1", count: 12, turns: 1 },
    ]);
    expect(level.witness).toHaveLength(12);
    expect(verifyLevel(level), `${rotation}/${strength}`).toBe(true);
    expect(
      witnessCompletionTime(level, 1 / 240),
      `${rotation}/${strength}`,
    ).not.toBeNull();
  }
});

it("replays authored local routes with stronger pull and larger surfaces across rotations and physics steps", () => {
  const repaired: [string, number][] = [
    ["concentric-shells", 8],
    ["triple-line", 1],
    ["double-ring", 1],
    ["cross", 1],
    ["open-v", 1],
    ["hexagon", 1],
    ["offset-crescent", 1],
    ["staggered-ladder", 1],
    ["broken-ring", 1],
    ["unequal-chain", 1],
    ["three-clusters", 1],
    ["self-gravitating-constellation", 2],
    ["self-gravitating-constellation", 3],
    ["compact-swarm", 7],
    ["five-star", 1],
    ["eight-well-enclosure", 5],
    ["eight-well-enclosure", 8],
    ["merging-swarm", 7],
    ["elastic-pair", 4],
  ];
  for (const [id, count] of repaired)
    for (const rotation of [0, 0.371, 1.413]) {
      const layout = GRAVITY_LAYOUTS.find((item) => item.id === id)!;
      const level = buildGravityLayout(layout, {
        index: 0,
        seed: 42,
        title: id,
        source: "campaign",
        count,
        rotation,
      });
      for (const dt of [1 / 120, 1 / 240])
        expect(
          witnessCompletionTime(level, dt),
          `${id}/${count}/${rotation}/${dt}`,
        ).not.toBeNull();
    }
}, 60000);
