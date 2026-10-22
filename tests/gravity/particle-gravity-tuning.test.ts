import { expect, it } from "vitest";
import { createState, fireFrom } from "../../src/gravity/simulation";
import { planetAccelerations } from "../../src/gravity/physics";
import { projectileProfile } from "../../src/gravity/projectile-size";
import type { GravityLevel } from "../../src/gravity/types";

const level: GravityLevel = {
  seed: 42,
  index: 0,
  family: "none",
  bounds: { x: -1000, y: -1000, width: 2000, height: 2000 },
  launch: { x: 0, y: 0 },
  bodies: [],
  witness: [],
  objective: { kind: "none", count: 0, turns: 2, hold: 0 },
};
const sizes = [
  { size: 1, surface: 353.8689832612261, separated: 39.36295271895336 },
  { size: 1.4, surface: 426.1333827262466, separated: 76.68206557372358 },
  { size: 2, surface: 611.4580393311849, separated: 154.53177900170016 },
];
it.each(sizes)(
  "strengthens contact at size $size while retaining area-based mass",
  ({ size, surface }) => {
    const profile = projectileProfile(8, 1, size);
    const s = createState({
      ...level,
      physics: { planetRadius: profile.radius, planetMass: profile.mass },
    });
    fireFrom(s, { x: 0, y: 0 }, { x: 0, y: 0 });
    fireFrom(s, { x: 2 * profile.radius, y: 0 }, { x: 0, y: 0 });
    const [a, b] = planetAccelerations(s.particles, [], s.physics);
    expect(a.x).toBeCloseTo(surface, 7);
    expect(b.x).toBeCloseTo(-surface, 7);
    expect(s.particles[0].mass).toBeCloseTo(size * size, 12);
  },
);
it.each(sizes)(
  "pulls separated size-$size particles together well before contact",
  ({ size, separated }) => {
    const profile = projectileProfile(8, 1, size);
    const s = createState({
      ...level,
      physics: { planetRadius: profile.radius, planetMass: profile.mass },
    });
    fireFrom(s, { x: 0, y: 0 }, { x: 0, y: 0 });
    fireFrom(s, { x: 80, y: 0 }, { x: 0, y: 0 });
    const [a, b] = planetAccelerations(s.particles, [], s.physics);
    expect(a.x).toBeCloseTo(separated, 7);
    expect(b.x).toBeCloseTo(-separated, 7);
  },
);
it("preserves the distant field instead of destabilizing far-apart orbits", () => {
  const s = createState({ ...level, physics: { planetRadius: 8 } });
  fireFrom(s, { x: 0, y: 0 }, { x: 0, y: 0 });
  fireFrom(s, { x: 240, y: 0 }, { x: 0, y: 0 });
  const [a, b] = planetAccelerations(s.particles, [], s.physics);
  expect(a.x).toBeCloseTo(1.913476653206483, 10);
  expect(b.x).toBeCloseTo(-1.913476653206483, 10);
});
