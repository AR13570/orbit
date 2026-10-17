import { expect, it } from "vitest";
import { getGravityLevel } from "../../src/gravity/campaign";
import { fitGravityFrame } from "../../src/gravity/renderer";
import {
  createState,
  fireFrom,
  step,
  goalProgress,
} from "../../src/gravity/simulation";

for (const [width, height] of [
  [1200, 800],
  [390, 844],
  [320, 568],
  [844, 390],
])
  it(`all 45 solutions survive the real default size and outermost view at ${width}x${height}`, () => {
    for (let index = 0; index < 45; index++) {
      const level = getGravityLevel(42, index),
        state = createState(level),
        { camera, area } = fitGravityFrame(level, width, height);
      state.physics.planetRadius = Math.max(4, Math.min(16, 6 / camera.scale));
      const scale = camera.scale * 0.5;
      state.flightBounds = {
        x: camera.center.x - (area.x + area.width / 2) / scale,
        y: camera.center.y - (area.y + area.height / 2) / scale,
        width: width / scale,
        height: height / scale,
      };
      let shot = 0,
        complete = false;
      for (let n = 0; n < 30 * 120; n++) {
        while (
          shot < level.witness.length &&
          level.witness[shot].time <= state.elapsed + 1e-8
        ) {
          const w = level.witness[shot++];
          fireFrom(state, w.position!, w.velocity!);
        }
        step(state, 1 / 120);
        if (goalProgress(state).complete) {
          complete = true;
          break;
        }
      }
      expect(
        complete,
        `${index + 1}: ${level.title}, radius ${state.physics.planetRadius}`,
      ).toBe(true);
    }
  }, 60000);
