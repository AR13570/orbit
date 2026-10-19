import { expect, test } from "@playwright/test";
import { gravityAim } from "../../src/gravity/input";
import { markTutorialSeen } from "./tutorial-fixture";
import {
  bodyRadius,
  expectNoZoomControls,
  expectRenderedZoom,
  installZoomProbe,
  wheelZoom,
} from "./zoom-fixture";

for (const device of [
  { width: 1280, height: 800, touch: false, limit: 153 },
  { width: 390, height: 844, touch: true, limit: 81.6 },
  { width: 844, height: 390, touch: true, limit: 81.6 },
  { width: 320, height: 568, touch: true, limit: 81.6 },
]) {
  for (const zoom of [0.5, 0.75, 1, 2]) {
    test(`Gravity deliberate launch response at ${device.width}x${device.height}, zoom ${zoom}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: device,
        hasTouch: device.touch,
        isMobile: device.touch,
      });
      const page = await context.newPage();
      let engineModule = "";
      page.on("request", (request) => {
        if (request.url().includes("/src/gravity/engine.ts"))
          engineModule = request.url();
      });
      try {
        await page.addInitScript(markTutorialSeen);
        await installZoomProbe(page);
        await page.clock.install();
        await page.clock.pauseAt(new Date());
        await page.goto("/?mode=gravity&seed=42");
        await expect(page.getByLabel("Gravity orbital field")).toBeVisible();
        await page.clock.runFor(1000);
        await page.evaluate(async (engineModule) => {
          const { GravityEngine } = await import(engineModule);
          const probe = window as any;
          const original = GravityEngine.prototype.setLaunch;
          GravityEngine.prototype.setLaunch = function (position, aim) {
            probe.gravityEngine = this;
            probe.gravityAim = { ...aim };
            return original.call(this, position, aim);
          };
          const arc = CanvasRenderingContext2D.prototype.arc;
          CanvasRenderingContext2D.prototype.arc = function (
            x,
            y,
            r,
            start,
            end,
            anti,
          ) {
            if (
              this.canvas.classList.contains("scene-canvas") &&
              ["#697783", "#a4b2bf"].includes(String(this.strokeStyle))
            ) {
              const transform = this.getTransform();
              if (Math.abs((r * transform.a) / devicePixelRatio - 5) < 0.01)
                probe.gravityHandle = {
                  x: (x * transform.a + transform.e) / devicePixelRatio,
                  y: (y * transform.d + transform.f) / devicePixelRatio,
                };
            }
            if (
              this.canvas.classList.contains("scene-canvas") &&
              Math.abs((r * this.getTransform().a) / devicePixelRatio - 13) <
                0.01
            )
              probe.gravityArcPower = (end - start) / (Math.PI * 2);
            return arc.call(this, x, y, r, start, end, anti);
          };
        }, engineModule);
        await expectNoZoomControls(page);
        const baseline = await bodyRadius(page);
        if (zoom !== 1)
          await wheelZoom(page, zoom, {
            x: device.width / 2,
            y: device.height / 2,
          });
        await expectRenderedZoom(page, baseline, zoom);
        const limit =
          device.limit * Math.max(0.65, Math.min(1.3, Math.sqrt(zoom)));
        const cdp = device.touch ? await context.newCDPSession(page) : null;
        const start = {
          x: device.width - 30,
          y: device.height * 0.4,
        };
        for (const distance of [24, 48, 80, limit, limit * 1.9]) {
          const end = { x: start.x - distance, y: start.y };
          if (cdp) {
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchStart",
              touchPoints: [{ id: 1, ...start }],
            });
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: [{ id: 1, ...end }],
            });
          } else {
            await page.mouse.move(start.x, start.y);
            await page.mouse.down();
            await page.mouse.move(end.x, end.y);
          }
          await page.clock.runFor(32);
          const aimed = await page.evaluate(() => {
            const probe = window as any;
            return {
              aim: probe.gravityAim,
              handle: probe.gravityHandle,
              arcPower: probe.gravityArcPower,
            };
          });
          const power = gravityAim({ power: distance / limit }).power;
          // Browser input coordinates and wheel deltas use finite precision.
          expect(aimed.aim.power).toBeCloseTo(power, 6);
          expect(aimed.arcPower).toBeCloseTo(aimed.aim.power, 10);
          expect(
            Math.hypot(aimed.handle.x - start.x, aimed.handle.y - start.y),
          ).toBeCloseTo(distance, 1);
          if (distance === limit * 1.9 && zoom === 1 && device.width === 1280)
            await page.screenshot({
              path: "/private/tmp/orbit-unlimited-pull.png",
            });
          if (cdp)
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchEnd",
              touchPoints: [],
            });
          else await page.mouse.up();
          const released = await page.evaluate(() => {
            const state = (window as any).gravityEngine.getSnapshot();
            const particle = state.particles.at(-1);
            return {
              power: state.aim.power,
              speed: Math.hypot(particle.velocity.x, particle.velocity.y),
            };
          });
          expect(released.power).toBeCloseTo(aimed.aim.power, 10);
          const boost = Math.max(0, Math.min(1, (released.power - 0.8) / 0.2));
          expect(released.speed).toBeCloseTo(
            420 * released.power + 40 * boost ** 2 * (3 - 2 * boost),
            7,
          );
          await page
            .getByRole("button", { name: "Reset level (R)", exact: true })
            .click();
        }
        await expect(page.getByLabel("Gravity orbital field")).toBeVisible();
      } finally {
        await context.close();
      }
    });
  }
}

test("Gravity half-length pulls retain the deliberate normalized launch response", async ({
  page,
}) => {
  await page.goto("/?mode=gravity&seed=42");
  const measurements = await page.evaluate(async () => {
    const { GravityEngine } = await import("/src/gravity/engine.ts");
    const { getGravityLevel } = await import("/src/gravity/campaign.ts");
    const { createGravityRenderer } = await import("/src/gravity/renderer.ts");
    const { gravityAim, gravityPullDistance } =
      await import("/src/gravity/input.ts");
    return [
      [1280, 800],
      [390, 844],
      [844, 390],
    ].flatMap(([width, height]) => {
      const mobile = Math.min(width, height) <= 500;
      const limit = gravityPullDistance(
        mobile ? "touch" : "mouse",
        width,
        height,
      );
      const renderer = createGravityRenderer(document.createElement("canvas"));
      renderer.resize(width, height, 1);
      const level = getGravityLevel(42, 0);
      renderer.render(new GravityEngine(42, level).getSnapshot(), [], 0, {
        paused: true,
        reducedMotion: true,
      });
      const scale = renderer.getScale();
      const measure = (power: number) => {
        const game = new GravityEngine(42, level);
        // Compare exactly the same launch point, away from the first well's steep core.
        const position = { x: 300, y: 620 };
        game.setLaunch(position, { angle: 0, power });
        game.launch();
        game.update(0.05);
        const planet = game.getSnapshot().particles[0];
        return (
          Math.hypot(
            planet.position.x - position.x,
            planet.position.y - position.y,
          ) * scale
        );
      };
      const results = [24, 48, 80].map((distance) => {
        const previous =
          Math.min(1, distance / (mobile ? 72 : 160)) ** (mobile ? 1.6 : 1);
        // The shorter reach represents the same fraction of the full pull.
        const current = gravityAim({ power: distance / 2 / limit }).power;
        return {
          width,
          height,
          distance,
          currentDistance: distance / 2,
          before: measure(previous),
          after: measure(current),
          beforePower: previous,
          afterPower: current,
        };
      });
      renderer.destroy();
      return results;
    });
  });
  console.log(
    "Gravity launch response measurements",
    JSON.stringify(measurements),
  );
  for (const sample of measurements)
    expect(sample.after).toBeLessThan(sample.before * 0.8);
});
