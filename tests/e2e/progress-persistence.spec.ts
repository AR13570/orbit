import { expect, test, type Page, type CDPSession } from "@playwright/test";
import { OrbitEngine } from "../../src/game/engine";
import { MOBILE_PULL_DISTANCE, pullDistance } from "../../src/controls";
import { markTutorialSeen } from "./tutorial-fixture";

async function drag(
  page: Page,
  cdp: CDPSession | undefined,
  x: number,
  y: number,
  angle: number,
  distance: number,
) {
  const to = {
    x: x - Math.cos(angle) * distance,
    y: y - Math.sin(angle) * distance,
  };
  if (cdp) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 1 }],
    });
    for (let i = 1; i <= 8; i++)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: x + ((to.x - x) * i) / 8, y: y + ((to.y - y) * i) / 8, id: 1 },
        ],
      });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
  }
}
async function reload(page: Page) {
  await page.reload();
  await page.clock.runFor(800);
}
for (const mobile of [false, true]) {
  const device = mobile ? "touch portrait" : "desktop";
  test(`Zen checkpoint survives flight, dock, reset, mode switch and New seed reloads on ${device}`, async ({
    browser,
  }) => {
    test.setTimeout(90000);
    const viewport = mobile
      ? { width: 390, height: 844 }
      : { width: 1280, height: 800 };
    const context = await browser.newContext({
      viewport,
      isMobile: mobile,
      hasTouch: mobile,
    });
    await context.addInitScript(markTutorialSeen);
    const page = await context.newPage(),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await page.clock.install();
      await page.clock.pauseAt(new Date());
      await page.goto("/?mode=zen&seed=42");
      await page.clock.runFor(800);
      const reference = new OrbitEngine(42),
        solution = reference.getSnapshot().sector.solution;
      const x = viewport.width * 0.55,
        y = viewport.height * 0.55;
      const distance =
        solution.power *
        (mobile
          ? MOBILE_PULL_DISTANCE
          : pullDistance("mouse", viewport.width, viewport.height));
      console.log(
        `Zen ${device}: angle=${solution.angle}, power=${solution.power}, drag (${x},${y}) -> (${x - Math.cos(solution.angle) * distance},${y - Math.sin(solution.angle) * distance})`,
      );
      const cdp = mobile ? await context.newCDPSession(page) : undefined;
      await drag(page, cdp, x, y, solution.angle, distance);
      await page.clock.runFor(50);
      await expect(page.getByRole("status")).toHaveText("In flight");
      await reload(page);
      await expect(page.getByRole("status")).toHaveText("Ready to pull");
      await expect(
        page.getByLabel("Checkpoint 0", { exact: true }),
      ).toBeVisible();
      await drag(page, cdp, x, y, solution.angle, distance);
      for (let t = 0; t < 20000; t += 100) {
        await page.clock.runFor(100);
        if (await page.getByLabel("Checkpoint 1", { exact: true }).count())
          break;
      }
      await expect(page.getByRole("status")).toHaveText("Docked");
      expect(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("orbit.zen.progress.v1:42")!)
              .pendingAdvance,
        ),
      ).toBe(true);
      await page.screenshot({ path: test.info().outputPath("zen-docked.png") });
      reference.setAim(solution.angle, solution.power);
      reference.launch();
      for (
        let i = 0;
        i < 2000 && reference.getSnapshot().status === "flying";
        i++
      )
        reference.update(1 / 60);
      reference.advance();
      await reload(page);
      await expect(
        page.getByLabel("Checkpoint 1", { exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("status")).toHaveText("Ready to pull");
      expect(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("orbit.zen.progress.v1:42")!)
              .sector,
        ),
      ).toEqual(reference.getSnapshot().sector);
      await page
        .getByRole("button", { name: "Reset level (R)", exact: true })
        .click();
      await reload(page);
      await expect(
        page.getByLabel("Checkpoint 1", { exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: test.info().outputPath("zen-restored.png"),
      });
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page
        .getByRole("button", { name: "Choose mode", exact: true })
        .click();
      await page.getByRole("button", { name: /^Gravity Build/ }).click();
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page
        .getByRole("button", { name: "Choose mode", exact: true })
        .click();
      await page.getByRole("button", { name: /^Zen Follow/ }).click();
      await expect(
        page.getByLabel("Checkpoint 1", { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page.getByRole("button", { name: "New seed", exact: true }).click();
      const newSeed = new URL(page.url()).searchParams.get("seed");
      expect(newSeed).not.toBe("42");
      await reload(page);
      await expect(
        page.getByLabel("Checkpoint 0", { exact: true }),
      ).toBeVisible();
      await page.goto("/?mode=zen&seed=42");
      await page.clock.runFor(800);
      await expect(
        page.getByLabel("Checkpoint 1", { exact: true }),
      ).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
  test(`Gravity completion, Next, selected level and infinite skies survive reload on ${device}`, async ({
    browser,
  }) => {
    test.setTimeout(90000);
    const viewport = mobile
      ? { width: 390, height: 844 }
      : { width: 1280, height: 800 };
    const context = await browser.newContext({
      viewport,
      isMobile: mobile,
      hasTouch: mobile,
    });
    await context.addInitScript(markTutorialSeen);
    const page = await context.newPage(),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await page.clock.install();
      await page.clock.pauseAt(new Date());
      await page.goto("/?mode=gravity&seed=42");
      await page.clock.runFor(800);
      const { shot, position } = await page.evaluate(
        async ({ viewport, mobile }) => {
          const campaignPath = "/src/gravity/campaign.ts",
            renderPath = "/src/gravity/renderer.ts",
            coordinatesPath = "/src/render/coordinates.ts";
          const [{ getGravityLevel }, { fitGravityFrame }, { worldToClient }] =
            await Promise.all([
              import(campaignPath),
              import(renderPath),
              import(coordinatesPath),
            ]);
          const level = getGravityLevel(42, 0),
            shot = level.witness[0];
          const { area, camera } = fitGravityFrame(
            level,
            viewport.width,
            viewport.height,
            mobile,
          );
          const position = worldToClient(
            shot.position ?? level.launch,
            {
              left: area.x,
              top: area.y,
              width: area.width,
              height: area.height,
            },
            camera,
          );
          return { shot, position };
        },
        { viewport, mobile },
      );
      const cdp = mobile ? await context.newCDPSession(page) : undefined;
      await drag(
        page,
        cdp,
        position.x,
        position.y,
        shot.angle,
        Math.sqrt(shot.power) * (mobile ? 48 : 90),
      );
      for (let t = 0; t < 60000; t += 500) {
        await page.clock.runFor(500);
        if (
          await page
            .getByRole("button", { name: "Next level", exact: true })
            .count()
        )
          break;
      }
      await expect(
        page.getByRole("button", { name: "Next level", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Reset level (R)", exact: true })
        .click();
      await reload(page);
      await expect(page.locator(".gravity-level")).toHaveText("Level 1");
      await drag(
        page,
        cdp,
        position.x,
        position.y,
        shot.angle,
        Math.sqrt(shot.power) * (mobile ? 48 : 90),
      );
      for (let t = 0; t < 60000; t += 500) {
        await page.clock.runFor(500);
        if (
          await page
            .getByRole("button", { name: "Next level", exact: true })
            .count()
        )
          break;
      }
      await page
        .getByRole("button", { name: "Next level", exact: true })
        .click();
      await reload(page);
      await expect(page.locator(".gravity-level")).toHaveText("Level 2");
      await page
        .getByRole("button", { name: "Skip level", exact: true })
        .click();
      await reload(page);
      await expect(page.locator(".gravity-level")).toHaveText("Level 3");
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page
        .getByRole("button", { name: "Choose a level", exact: true })
        .click();
      await page.getByRole("button", { name: /^Level 45:/ }).click();
      await reload(page);
      await expect(page.locator(".gravity-level")).toHaveText("Level 45");
      await page
        .getByRole("button", { name: "Skip level", exact: true })
        .click();
      await reload(page);
      await expect(page.locator(".gravity-level")).toHaveText("Level 46");
      await page
        .getByRole("button", { name: "Skip level", exact: true })
        .click();
      await reload(page);
      await expect(page.locator(".gravity-level")).toHaveText("Level 47");
      await page.screenshot({
        path: test.info().outputPath("gravity-infinite-restored.png"),
      });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
