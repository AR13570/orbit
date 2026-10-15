import { test, expect } from "@playwright/test";
import { OrbitEngine } from "../../src/game/engine";
import { MOBILE_PULL_DISTANCE, pullDistance } from "../../src/controls";
import { markTutorialSeen } from "./tutorial-fixture";
import {
  bodyRadius,
  expectNoZoomControls,
  expectRenderedZoom,
  installZoomProbe,
  resetZoom,
} from "./zoom-fixture";

for (const touch of [false, true]) {
  test(`Zen reaches and completes maximum difficulty at level 15 on ${touch ? "touch portrait" : "desktop"}`, async ({
    browser,
  }) => {
    test.setTimeout(120000);
    const viewport = touch
      ? { width: 390, height: 844 }
      : { width: 1440, height: 900 };
    const context = await browser.newContext({
      viewport,
      hasTouch: touch,
      isMobile: touch,
    });
    await context.addInitScript(markTutorialSeen);
    const page = await context.newPage(),
      errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    try {
      await installZoomProbe(page);
      await page.clock.install();
      await page.clock.pauseAt(new Date());
      await page.goto("/?mode=zen&seed=42");
      await page.clock.runFor(800);
      await expectNoZoomControls(page);
      const reference = new OrbitEngine(42);
      const cdp = touch ? await context.newCDPSession(page) : undefined;
      for (let index = 0; index < 15; index++) {
        await expect(page.getByRole("status")).toHaveText("Ready to pull");
        const field = reference.getSnapshot().sector,
          { angle, power } = field.solution;
        if (index === 14) {
          expect(field.generation.difficulty).toBe(1);
          expect(
            field.checkpoint.position.x - field.launch.x,
          ).toBeGreaterThanOrEqual(2600);
          const baseline = await bodyRadius(page);
          await page.getByLabel("Slingshot flight field").focus();
          await page.keyboard.press("+");
          await page.keyboard.press("+");
          await page.clock.runFor(800);
          await expectRenderedZoom(page, baseline, 1.15 ** 2);
          await page.screenshot({
            path: test.info().outputPath("level-15-zoomed.png"),
          });
          await page.keyboard.press("-");
          await page.clock.runFor(800);
          await expectRenderedZoom(page, baseline, 1.15);
          await page.screenshot({
            path: test.info().outputPath("level-15.png"),
          });
          await resetZoom(page, "Slingshot flight field");
          await page.clock.runFor(800);
          await expectRenderedZoom(page, baseline, 1);
          await page.screenshot({
            path: test.info().outputPath("level-15-whole-course.png"),
          });
        }
        const x = viewport.width * 0.55,
          y = viewport.height * 0.55;
        const distance =
          power *
          (touch
            ? MOBILE_PULL_DISTANCE
            : pullDistance("mouse", viewport.width, viewport.height));
        if (cdp) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x, y, id: 1 }],
          });
          for (let step = 1; step <= 8; step++)
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: [
                {
                  x: x - (Math.cos(angle) * distance * step) / 8,
                  y: y - (Math.sin(angle) * distance * step) / 8,
                  id: 1,
                },
              ],
            });
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
        } else {
          await page.mouse.move(x, y);
          await page.mouse.down();
          await page.mouse.move(
            x - Math.cos(angle) * distance,
            y - Math.sin(angle) * distance,
            { steps: 8 },
          );
          await page.mouse.up();
        }
        for (let elapsed = 0; elapsed < 20000; elapsed += 100) {
          await page.clock.runFor(100);
          if (
            await page
              .getByLabel(`Checkpoint ${index + 1}`, { exact: true })
              .count()
          )
            break;
        }
        await expect(
          page.getByLabel(`Checkpoint ${index + 1}`, { exact: true }),
          `level ${index + 1}`,
        ).toBeVisible();
        await page.clock.runFor(1500);
        reference.setAim(angle, power);
        reference.launch();
        for (
          let frame = 0;
          frame < 1200 && reference.getSnapshot().status === "flying";
          frame++
        )
          reference.update(1 / 60);
        expect(reference.getSnapshot().status).toBe("docked");
        reference.advance();
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

for (const level of [1, 5, 10, 15, 30])
  test(`Zen debug URL jumps to level ${level}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await installZoomProbe(page);
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.goto(`/?debug=1&level=${level}&seed=42`);
    await page.clock.runFor(800);
    await expect(
      page.getByText(`Debug level ${level}`, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel(`Checkpoint ${level - 1}`, { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("Ready to pull");
    expect(new URL(page.url()).searchParams.get("mode")).toBe("zen");
    await expectNoZoomControls(page);
    if (level === 15) {
      const baseline = await bodyRadius(page);
      await page.mouse.move(700, 450);
      await page.mouse.wheel(0, 10000);
      await page.clock.runFor(800);
      await expectRenderedZoom(page, baseline, 0.25);
      await page.screenshot({
        path: test.info().outputPath("debug-level-15-overview.png"),
      });
      await page.mouse.wheel(0, -10000);
      await page.clock.runFor(800);
      await expectRenderedZoom(page, baseline, 0.25 * Math.exp(2));
      // A second wheel step reaches the expanded inspection limit.
      await page.mouse.wheel(0, -10000);
      await page.clock.runFor(800);
      await expectRenderedZoom(page, baseline, 4);
      await page.screenshot({
        path: test.info().outputPath("debug-level-15-inspection.png"),
      });
      await resetZoom(page, "Slingshot flight field");
      await page.clock.runFor(800);
      const reference = new OrbitEngine(42, level),
        field = reference.getSnapshot().sector;
      const distance = field.solution.power * pullDistance("mouse", 1280, 720),
        x = 700,
        y = 420;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(
        x - Math.cos(field.solution.angle) * distance,
        y - Math.sin(field.solution.angle) * distance,
        { steps: 8 },
      );
      await page.mouse.up();
      for (let elapsed = 0; elapsed < 20000; elapsed += 100) {
        await page.clock.runFor(100);
        if (await page.getByLabel("Checkpoint 15", { exact: true }).count())
          break;
      }
      await expect(
        page.getByLabel("Checkpoint 15", { exact: true }),
      ).toBeVisible();
      await page.clock.runFor(1600);
      await expect(
        page.getByText("Debug level 16", { exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("status")).toHaveText("Ready to pull");
    }
    expect(errors).toEqual([]);
  });
