import { expect, test } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";

for (const viewport of [
  { width: 1200, height: 800 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`all 45 rebuilt courses complete in the browser at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    test.setTimeout(240000);
    await page.setViewportSize(viewport);
    await page.addInitScript(markTutorialSeen);
    await page.addInitScript(() =>
      localStorage.setItem("orbit.sound-muted.v1", "true"),
    );
    let moduleUrl = "";
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/src/gravity/engine.ts")
        moduleUrl = request.url();
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.goto("/?mode=gravity&seed=42");
    await page.clock.runFor(100);
    await page.evaluate(async (url) => {
      const { GravityEngine } = await import(url);
      const read = GravityEngine.prototype.getRenderSnapshot;
      GravityEngine.prototype.getRenderSnapshot = function () {
        (window as any).campaignEngine = this;
        return read.call(this);
      };
    }, moduleUrl);
    await page.clock.runFor(32);
    for (let index = 0; index < 45; index++) {
      if (index) {
        await page
          .getByRole("button", { name: "Next level", exact: true })
          .click();
        await page.clock.runFor(32);
      }
      await expect(page.locator(".gravity-level")).toHaveText(
        `Level ${index + 1}`,
      );
      const result = await page.evaluate(() => {
        const engine = (window as any).campaignEngine;
        engine.setTimeScale(1);
        const level = engine.getRenderSnapshot().level;
        let shot = 0;
        for (let n = 0; n < 30 * 120; n++) {
          let s = engine.getRenderSnapshot();
          while (
            shot < level.witness.length &&
            level.witness[shot].time <= s.elapsed + 1e-8
          ) {
            const witness = level.witness[shot++];
            engine.launchFrom(witness.position, witness.velocity);
          }
          engine.update(1 / 120);
          s = engine.getRenderSnapshot();
          if (s.complete)
            return {
              complete: true,
              seconds: s.elapsed,
              title: level.title,
              kind: level.journey
                ? "relay"
                : level.sharedOrbit
                  ? "shared"
                  : "local",
              radius: s.physics.planetRadius,
            };
        }
        const s = engine.getRenderSnapshot();
        return {
          complete: false,
          title: level.title,
          radius: s.physics.planetRadius,
          progress: s.progress,
        };
      });
      expect(result.complete, JSON.stringify(result)).toBe(true);
      await page.clock.runFor(160);
      await expect(
        page.getByRole("button", { name: "Next level", exact: true }),
      ).toBeVisible();
      if ([4, 18, 27, 32, 34, 36, 41, 44].includes(index)) {
        if (viewport.width === 390)
          await page.screenshot({
            path: `/private/tmp/orbit-campaign-level-${index + 1}.png`,
          });
        const objective = (await page
          .locator(".gravity-objective")
          .boundingBox())!;
        expect(objective.x).toBeGreaterThanOrEqual(0);
        expect(objective.x + objective.width).toBeLessThanOrEqual(
          viewport.width,
        );
      }
    }
    expect(errors).toEqual([]);
  });
}
