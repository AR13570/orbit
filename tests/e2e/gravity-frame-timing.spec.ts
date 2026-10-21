import { expect, test } from "@playwright/test";
import { GRAVITY_SPEED_SCALE } from "../../src/gravity/physics";
import { markTutorialSeen } from "./tutorial-fixture";

test("slow render frames retain wall time instead of slowing Gravity playback", async ({
  page,
}) => {
  let moduleUrl = "";
  page.on("response", (response) => {
    if (new URL(response.url()).pathname === "/src/gravity/engine.ts")
      moduleUrl = response.url();
  });
  await page.addInitScript(markTutorialSeen);
  await page.addInitScript(() => {
    localStorage.setItem("orbit.sound-muted.v1", "true");
  });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto("/?mode=gravity&seed=42");
  await expect(page.getByLabel("Gravity orbital field")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.clock.runFor(100);
  expect(moduleUrl).not.toBe("");
  await page.evaluate(async (url) => {
    const { GravityEngine } = await import(url);
    const probe = window as any;
    probe.samples = [];
    const request = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      let previous: number | undefined;
      const render = (time: number) => {
        previous ??= time;
        if (time - previous < 113) return request(render);
        probe.frameTime = time;
        callback(time);
      };
      return request(render);
    };
    const update = GravityEngine.prototype.update;
    GravityEngine.prototype.update = function (dt) {
      update.call(this, dt);
      if (Number.isFinite(probe.frameTime))
        probe.samples.push({
          time: probe.frameTime,
          elapsed: this.getRenderSnapshot().elapsed,
        });
    };
  }, moduleUrl);
  await page.clock.runFor(2200);
  const samples = await page.evaluate(() => (window as any).samples);
  expect(samples.length).toBeGreaterThan(8);
  const first = samples[0],
    last = samples.at(-1);
  const wallTime = (last.time - first.time) / 1000;
  expect(last.elapsed - first.elapsed).toBeCloseTo(
    wallTime * GRAVITY_SPEED_SCALE,
    1,
  );
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
});
