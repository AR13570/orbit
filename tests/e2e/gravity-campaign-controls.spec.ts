import { expect, test } from "@playwright/test";
import { fitGravityFrame } from "../../src/gravity/renderer";
import { worldToClient } from "../../src/render/coordinates";
import {
  gravityPullDistance,
  gravityPullFraction,
} from "../../src/gravity/input";
import { markTutorialSeen } from "./tutorial-fixture";

for (const device of [
  { width: 1200, height: 800, touch: false },
  { width: 390, height: 844, touch: true },
]) {
  for (const index of [2, 4, 27, 32, 34, 44]) {
    test(`real ${device.touch ? "touch" : "mouse"} completes rebuilt Level ${index + 1}`, async ({
      browser,
    }) => {
      test.setTimeout(90000);
      const context = await browser.newContext({
        viewport: device,
        hasTouch: device.touch,
        isMobile: device.touch,
      });
      const page = await context.newPage();
      let url = "";
      page.on("request", (request) => {
        if (new URL(request.url()).pathname === "/src/gravity/engine.ts")
          url = request.url();
      });
      await page.addInitScript(markTutorialSeen);
      await page.addInitScript((index) => {
        localStorage.setItem(
          "orbit.gravity.progress.v1:42",
          JSON.stringify({
            version: 1,
            seed: 42,
            currentIndex: index,
            unlockedIndex: index,
            completedIndices: [],
          }),
        );
        localStorage.setItem("orbit.sound-muted.v1", "true");
      }, index);
      await page.clock.install();
      await page.clock.pauseAt(new Date());
      await page.goto("/?mode=gravity&seed=42");
      await page.clock.runFor(100);
      await page.evaluate(async (url) => {
        const { GravityEngine } = await import(url);
        const read = GravityEngine.prototype.getRenderSnapshot;
        GravityEngine.prototype.getRenderSnapshot = function () {
          (window as any).inputEngine = this;
          return read.call(this);
        };
      }, url);
      await page.clock.runFor(32);
      const level = await page.evaluate(
        () => (window as any).inputEngine.getSnapshot().level,
      );
      const { camera, area } = fitGravityFrame(
        level,
        device.width,
        device.height,
      );
      const cdp = device.touch ? await context.newCDPSession(page) : null;
      const launchEpoch = await page.evaluate(
        () => (window as any).inputEngine.getSnapshot().elapsed,
      );
      let launched = 0;
      for (const shot of level.witness) {
        const elapsed = await page.evaluate(
          () => (window as any).inputEngine.getSnapshot().elapsed,
        );
        if (launchEpoch + shot.time > elapsed)
          await page.clock.runFor(
            Math.ceil(((launchEpoch + shot.time - elapsed) / 1.2) * 1000),
          );
        const start = worldToClient(
          shot.position,
          { left: area.x, top: area.y, width: area.width, height: area.height },
          camera,
        );
        const pull =
          gravityPullFraction(shot.power) *
          gravityPullDistance(
            device.touch ? "touch" : "mouse",
            device.width,
            device.height,
          );
        const end = {
          x: start.x - Math.cos(shot.angle) * pull,
          y: start.y - Math.sin(shot.angle) * pull,
        };
        for (const point of [start, end]) {
          expect(point.x).toBeGreaterThan(0);
          expect(point.x).toBeLessThan(device.width);
          expect(point.y).toBeGreaterThan(0);
          expect(point.y).toBeLessThan(device.height);
        }
        if (cdp) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ id: 7, ...start }],
          });
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ id: 7, ...end }],
          });
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
        } else {
          await page.mouse.move(start.x, start.y);
          await page.mouse.down();
          await page.mouse.move(end.x, end.y);
          await page.mouse.up();
        }
        launched++;
        expect(
          await page.evaluate(
            () => (window as any).inputEngine.getSnapshot().nextId,
          ),
        ).toBe(launched);
      }
      const next = page.getByRole("button", {
        name: "Next level",
        exact: true,
      });
      for (let n = 0; n < 900 && !(await next.count()); n++)
        await page.clock.runFor(100);
      await expect(next).toBeVisible();
      if (index === 44)
        await page.screenshot({
          path: `/private/tmp/orbit-grand-tour-${device.touch ? "touch" : "desktop"}.png`,
        });
      await context.close();
    });
  }
}
