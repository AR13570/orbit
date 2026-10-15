import { expect, test, type Page, type CDPSession } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";
type Point = { x: number; y: number; id: number };
async function touch(
  cdp: CDPSession,
  type: "touchStart" | "touchMove" | "touchEnd" | "touchCancel",
  points: Point[],
) {
  await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
}
async function boot(page: Page, seen = true) {
  if (seen) await page.addInitScript(markTutorialSeen);
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto("/?mode=gravity&seed=42");
  await page.clock.runFor(1000);
}
async function drag(page: Page, x: number, y: number, distance = 70) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - distance, y, { steps: 5 });
  await page.mouse.up();
}
test("Gravity desktop free launches, wheel cancellation, player settings and resume", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await boot(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await drag(page, 350, 600);
  await expect(page.locator(".game-surface [role=status]")).toHaveText(
    "1 planet in motion",
  );
  await page.clock.runFor(500);
  await drag(page, 780, 400, 110);
  await expect(page.locator(".game-surface [role=status]")).toHaveText(
    "2 planets in motion",
  );
  await page.mouse.move(280, 450);
  await page.mouse.down();
  await page.mouse.move(200, 450);
  await page.mouse.wheel(0, -50);
  await page.mouse.up();
  await page.clock.runFor(32);
  await expect(page.locator(".game-surface [role=status]")).toHaveText(
    "2 planets in motion",
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Paused" });
  await expect(menu.getByRole("combobox")).toHaveCount(0);
  const advanced = menu.getByRole("button", { name: "Advanced", exact: true });
  await expect(advanced).toHaveAttribute("aria-expanded", "false");
  await expect(menu.getByRole("switch")).toHaveCount(0);
  await advanced.click();
  await page.clock.runFor(240);
  await expect(
    menu.getByRole("switch", { name: "Path assist" }),
  ).toHaveAttribute("aria-checked", "false");
  await expect(
    menu.getByRole("button", { name: "Clear trails", exact: true }),
  ).toHaveCount(0);
  await expect(
    menu.getByRole("button", { name: "Save sky image", exact: true }),
  ).toHaveCount(0);
  await menu.getByRole("switch", { name: "Path assist", exact: true }).click();
  await expect(
    menu.getByRole("switch", { name: "Path assist", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await menu.getByRole("button", { name: "Sound on", exact: true }).click();
  await expect(
    menu.getByRole("button", { name: "Sound off", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.clock.runFor(50);
  const image = await page
    .getByLabel("Gravity orbital field")
    .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
  await page.clock.runFor(500);
  expect(
    await page
      .getByLabel("Gravity orbital field")
      .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL()),
  ).toBe(image);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.clock.runFor(150);
  await page.screenshot({ path: "/private/tmp/gravity-rebuild-desktop.png" });
  await page.getByRole("button", { name: "Skip level", exact: true }).click();
  await expect(page.locator(".gravity-level")).toHaveText("Level 2");
  await page.reload();
  await page.clock.runFor(100);
  await expect(page.locator(".gravity-level")).toHaveText("Level 2");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page
    .getByRole("button", { name: "Choose a level", exact: true })
    .click();
  await expect(
    page.getByRole("group", { name: "Campaign levels" }).getByRole("button"),
  ).toHaveCount(45);
  await page.getByRole("button", { name: "Explore infinite skies" }).click();
  await expect(page.locator(".gravity-level")).toHaveText(
    /Infinite 1|Level 46/,
  );
  expect(errors).toEqual([]);
});
for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 320, height: 568 },
  { width: 768, height: 1024 },
]) {
  test(`Gravity real touch free launch and pinch own the full gesture ${viewport.width}x${viewport.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage(),
      cdp = await context.newCDPSession(page);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await boot(page);
      const x = viewport.width * 0.48,
        y = viewport.height * 0.58,
        a = { id: 1, x, y },
        b = { id: 2, x: x + 70, y };
      await touch(cdp, "touchStart", [a]);
      await touch(cdp, "touchMove", [{ ...a, x: x - 30 }]);
      await touch(cdp, "touchStart", [{ ...a, x: x - 30 }, b]);
      await touch(cdp, "touchMove", [
        { ...a, x: x - 50 },
        { ...b, x: b.x + 40 },
      ]);
      await touch(cdp, "touchEnd", [{ ...a, x: x - 50 }]);
      await touch(cdp, "touchMove", [{ ...a, x: x - 72 }]);
      await touch(cdp, "touchEnd", []);
      await page.clock.runFor(32);
      await expect(page.locator(".game-surface [role=status]")).toHaveText(
        "0 planets in motion",
      );
      await page.getByLabel("Gravity orbital field").focus();
      await page.keyboard.press("0");
      const p = { id: 3, x: viewport.width * 0.4, y: viewport.height * 0.66 };
      await touch(cdp, "touchStart", [p]);
      await touch(cdp, "touchMove", [{ ...p, x: p.x - 72 }]);
      await touch(cdp, "touchEnd", []);
      await expect(page.locator(".game-surface [role=status]")).toHaveText(
        "1 planet in motion",
      );
      const q = { id: 4, x: viewport.width * 0.7, y: viewport.height * 0.55 };
      await touch(cdp, "touchStart", [q]);
      await touch(cdp, "touchMove", [{ ...q, x: q.x - 45 }]);
      await touch(cdp, "touchEnd", []);
      await expect(page.locator(".game-surface [role=status]")).toHaveText(
        "2 planets in motion",
      );
      await page.clock.runFor(200);
      await page.screenshot({
        path: `/private/tmp/gravity-rebuild-touch-${viewport.width}x${viewport.height}.png`,
      });
      const r = { id: 5, x: viewport.width * 0.5, y: viewport.height * 0.6 };
      await touch(cdp, "touchStart", [r]);
      await touch(cdp, "touchMove", [{ ...r, x: r.x - 40 }]);
      await page.setViewportSize({
        width: viewport.height,
        height: viewport.width,
      });
      await page.clock.runFor(100);
      await touch(cdp, "touchEnd", []);
      await expect(page.locator(".game-surface [role=status]")).toHaveText(
        "2 planets in motion",
      );
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page.getByRole("button", { name: "Resume", exact: true }).click();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
for (const mobile of [false, true])
  test(`Gravity v2 guide teaches two free launches with ${mobile ? "touch" : "mouse"}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1200, height: 800 },
      hasTouch: mobile,
      isMobile: mobile,
    });
    const page = await context.newPage();
    try {
      await boot(page, false);
      await expect(
        page.getByRole("heading", { name: "Make your first planet" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Continue", exact: true }),
      ).toHaveCount(0);
      const box = (await page
        .getByLabel("Gravity practice field")
        .boundingBox())!;
      const p = {
        id: 1,
        x: box.x + box.width * 0.45,
        y: box.y + box.height * 0.72,
      };
      if (mobile) {
        const cdp = await context.newCDPSession(page);
        await touch(cdp, "touchStart", [p]);
        await touch(cdp, "touchStart", [p, { id: 2, x: p.x + 60, y: p.y }]);
        await touch(cdp, "touchEnd", [p]);
        await touch(cdp, "touchMove", [{ ...p, x: p.x - 72 }]);
        await touch(cdp, "touchEnd", []);
        await expect(
          page.getByRole("heading", { name: "Make your first planet" }),
        ).toBeVisible();
        for (let n = 0; n < 2; n++) {
          const start = { ...p, id: n + 3, x: p.x + n * 80 };
          await touch(cdp, "touchStart", [start]);
          await touch(cdp, "touchMove", [{ ...start, x: start.x - 72 }]);
          await touch(cdp, "touchEnd", []);
        }
      } else {
        await drag(page, p.x, p.y);
        await expect(
          page.getByRole("heading", { name: "Add another while it moves" }),
        ).toBeVisible();
        await drag(page, p.x + 100, p.y - 40);
      }
      await expect(
        page.getByRole("heading", { name: "Let gravity draw" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Choose a size" }),
      ).toBeVisible();
      await expect(
        page.getByRole("slider", { name: "Projectile size" }),
      ).toHaveValue("1");
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await expect(page.getByText(/Pinch to zoom/)).toBeVisible();
      await page
        .getByRole("button", { name: "Start playing", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "How to play Gravity" }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(() =>
          localStorage.getItem("orbit.walkthrough.gravity.v2"),
        ),
      ).toBe("complete");
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page
        .getByRole("button", { name: "How to play", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Make your first planet" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Skip", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
    } finally {
      await context.close();
    }
  });
test("Gravity creator portable link preserves physics and per-core goals", async ({
  page,
}) => {
  await page.addInitScript(markTutorialSeen);
  await page.goto("/?mode=creator");
  await page.getByRole("button", { name: "Sandbox settings" }).click();
  await page
    .getByRole("combobox", { name: "Planet collisions" })
    .selectOption("elastic");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Saved levels", exact: true }).click();
  await page.getByRole("button", { name: "Import, export or share" }).click();
  const json = await page
    .getByRole("textbox", { name: "Level JSON" })
    .inputValue();
  expect(JSON.parse(json).physics.planetCollisions).toBe("elastic");
  const portable = JSON.parse(json);
  portable.name = "Portable constellation";
  await page
    .getByRole("textbox", { name: "Level JSON" })
    .fill(JSON.stringify(portable));
  await page.getByRole("button", { name: "Import JSON", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Rename level" }),
  ).toContainText("Portable constellation");
  await page.getByRole("button", { name: "Playtest", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Paused" });
  const advanced = menu.getByRole("button", { name: "Advanced", exact: true });
  await expect(advanced).toHaveAttribute("aria-expanded", "false");
  await expect(menu.getByRole("switch")).toHaveCount(0);
  await advanced.click();
  await expect(
    menu.getByRole("switch", { name: "Path assist", exact: true }),
  ).toBeVisible();
  await expect(
    menu.getByRole("switch", { name: "Particle Interaction", exact: true }),
  ).toHaveAttribute("aria-checked", String(portable.physics.planetGravity));
  await expect(menu.getByRole("switch")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Choose a level", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Back to editor", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Rename level" }),
  ).toContainText("Portable constellation");
  await page.getByRole("button", { name: "Sandbox settings" }).click();
  await expect(
    page.getByRole("combobox", { name: "Planet collisions" }),
  ).toHaveValue("elastic");
});

test("Gravity dense mobile sky keeps 128 planets and held predictions responsive", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const result = await page.evaluate(async () => {
    // Test-only browser imports exercise the real engine and Canvas renderer without a production debug hook.
    const { GravityEngine } = await import("/src/gravity/engine.ts");
    const { getGravityLevel } = await import("/src/gravity/campaign.ts");
    const { createGravityRenderer } = await import("/src/gravity/renderer.ts");
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;inset:0;width:390px;height:844px";
    document.body.append(canvas);
    const engine = new GravityEngine(42, getGravityLevel(42, 14));
    engine.setPhysics({
      planetGravity: true,
      planetCollisions: "none",
      bodyCollisions: false,
      trailSeconds: 30,
      escapeDistance: 100000,
    });
    for (let i = 0; i < 128; i++)
      engine.launchFrom(
        { x: 90 + (i % 16) * 48, y: 130 + Math.floor(i / 16) * 80 },
        { x: ((i % 3) - 1) * 15, y: ((i % 5) - 2) * 8 },
      );
    for (let i = 0; i < 96; i++) engine.update(0.25);
    const renderer = createGravityRenderer(canvas);
    renderer.resize(390, 844, 2);
    const frameTimes: number[] = [],
      predictionTimes: number[] = [];
    let prediction: { x: number; y: number }[] = [];
    for (let i = 0; i < 40; i++) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      const start = performance.now();
      engine.update(1 / 60);
      if (i % 5 === 0) {
        const before = performance.now();
        prediction = engine.predictFrom(
          { x: 180 + i * 3, y: 650 },
          { x: 75, y: -20 },
          0.6,
        );
        predictionTimes.push(performance.now() - before);
      }
      renderer.render(engine.getRenderSnapshot(), prediction, i / 60, {
        paused: false,
        reducedMotion: false,
        pull: { x: -40, y: 0 },
      });
      frameTimes.push(performance.now() - start);
    }
    const state = engine.getRenderSnapshot();
    const results = {
      active: state.particles.filter(
        (planet: { alive: boolean }) => planet.alive,
      ).length,
      trailPoints: state.particles.reduce(
        (sum: number, planet: { trail: unknown[] }) =>
          sum + planet.trail.length,
        0,
      ),
      maxPrediction: Math.max(...predictionTimes),
      meanFrame: frameTimes.reduce((sum, n) => sum + n, 0) / frameTimes.length,
      maxFrame: Math.max(...frameTimes),
    };
    renderer.destroy();
    canvas.remove();
    return results;
  });
  console.log("Gravity 128-planet mobile benchmark", JSON.stringify(result));
  expect(result.active).toBe(128);
  expect(result.trailPoints).toBeGreaterThan(20000);
  expect(result.maxPrediction).toBeLessThan(100);
  expect(result.meanFrame).toBeLessThan(50);
});
