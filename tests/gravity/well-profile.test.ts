import { expect, it } from "vitest";
import { gravityForceAt, wellPotential } from "../../src/gravity/physics";
import type { Body } from "../../src/game/types";

const core: Body = {
  id: "wide",
  kind: "attractor",
  position: { x: 100, y: 0 },
  radius: 96,
  strength: 1000000,
  softening: 180,
};

it("uses an authored extended-mass well profile with matching potential independent of surface radius", () => {
  expect(gravityForceAt({ x: 0, y: 0 }, [core]).x).toBeCloseTo(
    23.58490566037736,
    10,
  );
  expect(gravityForceAt({ x: 0, y: 0 }, [{ ...core, radius: 160 }])).toEqual(
    gravityForceAt({ x: 0, y: 0 }, [core]),
  );
  const h = 0.001;
  const gradient =
    (wellPotential({ x: h, y: 0 }, [core]) -
      wellPotential({ x: -h, y: 0 }, [core])) /
    (2 * h);
  expect(-gradient).toBeCloseTo(23.58490566037736, 6);
  expect(wellPotential(core.position, [core])).toBeCloseTo(
    -8726.646259971647,
    8,
  );
  expect(
    gravityForceAt({ x: 0, y: 0 }, [{ ...core, kind: "repellent" }]).x,
  ).toBeCloseTo(-23.58490566037736, 10);
});

it.each([undefined, 0, -5, NaN, Infinity])(
  "retains the legacy well profile for invalid authored softening %s",
  (softening) => {
    const authored = { ...core, softening };
    expect(gravityForceAt({ x: 0, y: 0 }, [authored]).x).toBeCloseTo(
      86.20689655172413,
      10,
    );
    expect(wellPotential({ x: 0, y: 0 }, [authored])).toBeCloseTo(
      -9512.659427809121,
      8,
    );
  },
);
