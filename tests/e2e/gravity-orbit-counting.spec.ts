import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { campaignBlueprint } from "../../src/gravity/campaign-design";
import { fitGravityFrame } from "../../src/gravity/renderer";
import {
  gravityPullDistance,
  gravityPullFraction,
} from "../../src/gravity/input";
import { worldToClient } from "../../src/render/coordinates";
import { markTutorialSeen } from "./tutorial-fixture";

test("core recognizes a particle at 1.2 turns and the two-lap goal completes at 2.2", async ({
  page,
}) => {
  const viewport = { width: 1280, height: 800 };
  await page.setViewportSize(viewport);
  await page.addInitScript(markTutorialSeen);
  await page.addInitScript(() => {
    localStorage.setItem("orbit.sound-muted.v1", "true");
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (
      ...args: Parameters<typeof fillText>
    ) {
      if (
        this.canvas.classList.contains("scene-canvas") &&
        this.font.startsWith("600 ") &&
        /^\d+$/.test(args[0])
      )
        (window as any).renderedCoreCount = Number(args[0]);
      return fillText.apply(this, args);
    };
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto("/?mode=gravity&seed=42");
  await page.evaluate(() => document.fonts.ready);
  await page.clock.runFor(100);
  expect(await page.evaluate(() => (window as any).renderedCoreCount)).toBe(0);
  const level = campaignBlueprint(0);
  const shot = JSON.parse(
    readFileSync("src/gravity/campaign-witnesses.json", "utf8"),
  )["0"][0];
  const { area, camera } = fitGravityFrame(
    level,
    viewport.width,
    viewport.height,
  );
  const origin = worldToClient(
    shot.position,
    { left: area.x, top: area.y, width: area.width, height: area.height },
    camera,
  );
  const distance =
    gravityPullFraction(shot.power) *
    gravityPullDistance("mouse", viewport.width, viewport.height);
  await page.mouse.move(origin.x, origin.y);
  await page.mouse.down();
  await page.mouse.move(
    origin.x - Math.cos(shot.angle) * distance,
    origin.y - Math.sin(shot.angle) * distance,
  );
  await page.mouse.up();
  await expect(
    page.getByText("1 planet in motion", { exact: true }),
  ).toBeVisible();
  let milliseconds = 0;
  while (
    milliseconds < 4000 &&
    (await page.evaluate(() => (window as any).renderedCoreCount)) === 0
  ) {
    await page.clock.runFor(100);
    milliseconds += 100;
  }
  expect(milliseconds).toBeGreaterThanOrEqual(2300);
  expect(milliseconds).toBeLessThanOrEqual(2700);
  expect(await page.evaluate(() => (window as any).renderedCoreCount)).toBe(1);
  const next = page.getByRole("button", { name: "Next level", exact: true });
  await expect(next).toHaveCount(0);
  while (milliseconds < 5500 && !(await next.count())) {
    await page.clock.runFor(100);
    milliseconds += 100;
  }
  await expect(next).toBeVisible();
  expect(milliseconds).toBeGreaterThanOrEqual(4200);
  expect(milliseconds).toBeLessThanOrEqual(4800);
  expect(await page.evaluate(() => (window as any).renderedCoreCount)).toBe(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.runFor(100);
  const cancel = page.getByRole("button", {
    name: "Cancel automatic next level",
  });
  await expect(cancel).toBeVisible();
  const nextBox = (await next.boundingBox())!;
  const cancelBox = (await cancel.boundingBox())!;
  expect(Math.abs(nextBox.y - cancelBox.y)).toBeLessThan(2);
  expect(cancelBox.x - nextBox.x - nextBox.width).toBeGreaterThanOrEqual(4);
  expect(
    await cancel.evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgba(0, 0, 0, 0)");
  await page.screenshot({ path: "/private/tmp/orbit-next-cancel-mobile.png" });
  await cancel.click();
  await expect(cancel).toHaveCount(0);
  await expect(page.locator(".gravity-next-progress")).toHaveCount(0);
  await page.clock.runFor(12000);
  await expect(page.locator(".gravity-level")).toHaveText("Level 1");
  await next.click();
  await expect(page.locator(".gravity-level")).toHaveText("Level 2");
  expect(errors).toEqual([]);
});

for (const [theme, purple] of [
  ["dark", "#56316e"],
  ["light", "#7043a2"],
]) {
  test(`repellers render purple in ${theme} mode`, async ({ page }) => {
    const levelIndex = Array.from({ length: 45 }, (_, i) => i).find((i) =>
      campaignBlueprint(i).bodies.some((b) => b.kind === "repellent"),
    )!;
    await page.addInitScript(markTutorialSeen);
    await page.addInitScript(
      ({ theme, levelIndex }) => {
        localStorage.setItem("orbit.theme.v1", theme);
        localStorage.setItem("orbit.sound-muted.v1", "true");
        localStorage.setItem(
          "orbit.gravity.progress.v1:42",
          JSON.stringify({
            version: 1,
            seed: 42,
            currentIndex: levelIndex,
            unlockedIndex: levelIndex,
            completedIndices: [],
          }),
        );
        (window as any).bodyColors = [];
        const fill = CanvasRenderingContext2D.prototype.fill;
        CanvasRenderingContext2D.prototype.fill = function (...args: any[]) {
          if (
            this.canvas.classList.contains("scene-canvas") &&
            typeof this.fillStyle === "string"
          )
            (window as any).bodyColors.push(this.fillStyle);
          return (fill as Function).apply(this, args);
        };
      },
      { theme, levelIndex },
    );
    await page.goto("/?mode=gravity&seed=42");
    await expect
      .poll(() => page.evaluate(() => (window as any).bodyColors))
      .toContain(purple);
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--repeller-body")
          .trim(),
      ),
    ).toBe(purple);
    await page.screenshot({
      path: `/private/tmp/orbit-purple-repellers-${theme}.png`,
    });
  });
}
