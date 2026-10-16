import { describe, expect, it } from "vitest";
import { OrbitEngine } from "../../src/game/engine";
import { ODESSEY_FIXED_STEP, odesseyLaunchSpeed } from "../../src/game/physics";
import type { Particle, Sector } from "../../src/game/types";
const view = { x: 0, y: 0, width: 200, height: 1000 };
const state = (engine: OrbitEngine) =>
  (engine as unknown as { state: { sector: Sector; particles: Particle[] } })
    .state;
function world() {
  const engine = new OrbitEngine(7);
  Object.assign(state(engine).sector, {
    launch: { x: 100, y: 500 },
    bounds: view,
    checkpoint: { position: { x: 10000, y: 500 }, radius: 45 },
    bodies: [],
  });
  engine.setFlightBounds(view);
  engine.setAim(0, 250 / odesseyLaunchSpeed(1));
  return engine;
}
function tick(engine: OrbitEngine, seconds: number) {
  for (let n = 0; n < Math.round(seconds / ODESSEY_FIXED_STEP); n++)
    engine.update(ODESSEY_FIXED_STEP);
}
describe("Odessey visible-screen recovery", () => {
  it("gives every escaping shot five seconds instead of predicting its fate", () => {
    const engine = world();
    engine.launch();
    tick(engine, 0.5);
    expect(engine.getSnapshot().status).toBe("flying");
    expect(engine.getSnapshot().particles[0].offscreenRemaining).toBeCloseTo(
      4.92,
      6,
    );
    tick(engine, 4.9);
    expect(engine.getSnapshot().status).toBe("flying");
    tick(engine, 0.03);
    expect(engine.getSnapshot().status).toBe("failed");
  });
  it("resets the timer when panning brings a projectile back into view", () => {
    const engine = world();
    engine.launch();
    tick(engine, 2);
    const p = engine.getSnapshot().particles[0].position;
    engine.setFlightBounds({ x: p.x - 100, y: 0, width: 400, height: 1000 });
    expect(
      engine.getSnapshot().particles[0].offscreenRemaining,
    ).toBeUndefined();
    engine.setFlightBounds(view);
    expect(engine.getSnapshot().particles[0].offscreenRemaining).toBe(5);
    tick(engine, 4.9);
    expect(engine.getSnapshot().status).toBe("flying");
  });
  it("shares the five-second deadline between prediction and actual flight", () => {
    const engine = world(),
      before = engine.getSnapshot(),
      path = engine.predict(8)[0];
    expect(engine.getSnapshot()).toEqual(before);
    engine.launch();
    tick(engine, 8);
    expect(engine.getSnapshot().status).toBe("failed");
    expect(engine.getSnapshot().particles[0].position).toEqual(path.at(-1));
    expect(path.at(-1)!.x).toBeCloseTo(1455, 6);
  });
});
