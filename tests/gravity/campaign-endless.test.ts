import { expect, it } from "vitest";
import { generateGravityLevel, verifyLevel } from "../../src/gravity/generator";
import { campaignEndlessLayoutId } from "../../src/gravity/campaign-endless";
import { CAMPAIGN_DESIGNS } from "../../src/gravity/campaign-design";

const family = (level: ReturnType<typeof generateGravityLevel>) =>
  level.journey ? "relay" : level.sharedOrbit ? "shared" : "local";

it("shuffles family block order without consecutive repeats, including distant indices", () => {
  for (const seed of [0, 7, 42, 137, 0xffffffff]) {
    const orders = new Set<string>();
    for (const start of [45, 10002, Number.MAX_SAFE_INTEGER - 30]) {
      const sequence = Array.from({ length: 24 }, (_, n) => {
        const d = CAMPAIGN_DESIGNS.find(
          (d) => d.layout === campaignEndlessLayoutId(seed, start + n),
        )!;
        return d.goal === "orbit" || d.goal === "counter" ? "local" : d.goal;
      });
      sequence.forEach((f, i) => {
        if (i) expect(f).not.toBe(sequence[i - 1]);
      });
      if (start === 45)
        for (let i = 0; i < sequence.length; i += 3) {
          expect(new Set(sequence.slice(i, i + 3)).size).toBe(3);
          orders.add(sequence.slice(i, i + 3).join("/"));
        }
    }
    expect(orders.size).toBeGreaterThan(1);
  }
});

it("continues with campaign shared and same-planet relay challenges in every six-stage window", () => {
  const levels = Array.from({ length: 45 }, (_, i) =>
    generateGravityLevel(42, 45 + i),
  );
  for (let i = 0; i <= levels.length - 6; i++) {
    expect(new Set(levels.slice(i, i + 6).map(family))).toEqual(
      new Set(["local", "shared", "relay"]),
    );
    if (i) expect(family(levels[i])).not.toBe(family(levels[i - 1]));
  }
  expect(levels.some((level) => level.sharedCounter)).toBe(true);
  expect(
    levels.some((level) =>
      level.journey?.legs.some((leg) => leg.sweep >= Math.PI * 2),
    ),
  ).toBe(true);
  expect(levels.every((level) => level.objective.hold === 0)).toBe(true);
});

it("keeps generated solutions physically solvable and protects cached relay metadata", () => {
  for (let index = 45; index < 54; index++) {
    const level = generateGravityLevel(137, index);
    expect(verifyLevel(level), `${index}: ${level.title}`).toBe(true);
    const original = structuredClone(level);
    if (level.journey) level.journey.legs.pop();
    if (level.sharedOrbit) level.sharedOrbit.pop();
    expect(generateGravityLevel(137, index)).toEqual(original);
  }
});
