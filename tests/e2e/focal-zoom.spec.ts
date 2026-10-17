import { expect, test, type Page } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";
import { bodyRadius, installZoomProbe, wheelZoom } from "./zoom-fixture";

async function body(page: Page) {
  const radius = await bodyRadius(page);
  const center = await page.evaluate(
    () =>
      (
        window as typeof window & {
          renderedBodyCenter?: { x: number; y: number };
        }
      ).renderedBodyCenter!,
  );
  return { ...center, radius };
}
async function boot(page: Page, mode: string) {
  await page.addInitScript(markTutorialSeen);
  await installZoomProbe(page);
  await page.clock.install({ time: new Date("2026-10-15T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-15T00:00:01Z"));
  await page.goto(`/?mode=${mode}&seed=42`);
  await page.clock.runFor(200);
}
function anchored(
  before: Awaited<ReturnType<typeof body>>,
  after: Awaited<ReturnType<typeof body>>,
  from: { x: number; y: number },
  to = from,
) {
  const scale = after.radius / before.radius;
  expect(Math.abs(after.x + (from.x - before.x) * scale - to.x)).toBeLessThan(
    1,
  );
  expect(Math.abs(after.y + (from.y - before.y) * scale - to.y)).toBeLessThan(
    1,
  );
}

test("Odessey reset view appears after a mouse pan at default zoom", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await boot(page, "odessey");
  const initial = await body(page);
  const reset = page.getByRole("button", { name: "Reset view", exact: true });
  await expect(reset).toHaveCount(0);
  await page.mouse.move(600, 400);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(680, 440, { steps: 4 });
  await page.mouse.up({ button: "middle" });
  const moved = await body(page);
  expect(moved.radius).toBeCloseTo(initial.radius, 3);
  expect(Math.hypot(moved.x - initial.x, moved.y - initial.y)).toBeGreaterThan(
    50,
  );
  await expect(reset).toBeVisible();
  await reset.click();
  await page.clock.runFor(350);
  const restored = await body(page);
  expect(restored.x).toBeCloseTo(initial.x, 3);
  expect(restored.y).toBeCloseTo(initial.y, 3);
  await expect(reset).toHaveCount(0);
});

for (const mode of ["odessey", "gravity"]) {
  test(`${mode} reset view restores a two-finger pan without a zoom change`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    try {
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await boot(page, mode);
      const initial = await body(page);
      const reset = page.getByRole("button", {
        name: "Reset view",
        exact: true,
      });
      await expect(reset).toHaveCount(0);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { id: 1, x: 100, y: 400 },
          { id: 2, x: 230, y: 400 },
        ],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { id: 1, x: 140, y: 440 },
          { id: 2, x: 270, y: 440 },
        ],
      });
      await expect
        .poll(async () => (await body(page)).x)
        .toBeCloseTo(initial.x + 40, 2);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      expect((await body(page)).radius).toBeCloseTo(initial.radius, 3);
      await expect(reset).toBeVisible();
      await reset.tap();
      await page.clock.runFor(350);
      const restored = await body(page);
      expect(restored.x).toBeCloseTo(initial.x, 3);
      expect(restored.y).toBeCloseTo(initial.y, 3);
      expect(restored.radius).toBeCloseTo(initial.radius, 3);
      await expect(reset).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test(`${mode} wheel zoom preserves the world point beneath the cursor`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await boot(page, mode);
    const resetView = page.getByRole("button", {
      name: "Reset view",
      exact: true,
    });
    await expect(resetView).toHaveCount(0);
    const initial = await body(page);
    const point = { x: 810, y: 410 };
    for (const factor of [1.15, 0.8, 1.18]) {
      const before = await body(page);
      await wheelZoom(page, factor, point);
      anchored(before, await body(page), point);
    }
    await expect(resetView).toBeVisible();
    await expect(resetView).toHaveText("");
    const zoomed = await body(page);
    await resetView.click();
    await page.clock.runFor(32);
    const midway = await body(page);
    expect(Math.abs(midway.radius - initial.radius)).toBeGreaterThan(0.01);
    expect(Math.abs(midway.radius - initial.radius)).toBeLessThan(
      Math.abs(zoomed.radius - initial.radius),
    );
    await page.clock.runFor(350);
    const restored = await body(page);
    expect(restored.x).toBeCloseTo(initial.x, 3);
    expect(restored.y).toBeCloseTo(initial.y, 3);
    expect(restored.radius).toBeCloseTo(initial.radius, 3);
    await expect(resetView).toHaveCount(0);
  });

  test(`${mode} native pinch follows its moving midpoint in both directions and at the cap`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    try {
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await boot(page, mode);
      const initial = await body(page);
      await page.evaluate(() => {
        const probe = window as typeof window & { touchMoves: number };
        probe.touchMoves = 0;
        document.addEventListener("pointermove", (event) => {
          if (event.pointerType === "touch") probe.touchMoves++;
        });
      });
      let expectedMoves = 0;
      let a = { id: 1, x: 110, y: 400 };
      let b = { id: 2, x: 230, y: 400 };
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [a],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [a, b],
      });
      for (const [left, right, y] of [
        [100, 260, 420],
        [130, 230, 440],
        [40, 350, 440],
        [50, 360, 450],
      ]) {
        const from = { x: (a.x + b.x) / 2, y: a.y };
        const before = await body(page);
        a = { ...a, x: left, y };
        b = { ...b, x: right, y };
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [a, b],
        });
        expectedMoves += 2;
        await expect
          .poll(() =>
            page.evaluate(
              () =>
                (window as typeof window & { touchMoves: number }).touchMoves,
            ),
          )
          .toBe(expectedMoves);
        await page.clock.runFor(64);
        anchored(before, await body(page), from, { x: (left + right) / 2, y });
      }
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await expect(page.locator(".game-surface [role=status]")).toHaveText(
        mode === "odessey" ? "Ready to pull" : "0 planets in motion",
      );
      const resetView = page.getByRole("button", {
        name: "Reset view",
        exact: true,
      });
      await expect(resetView).toBeVisible();
      await expect(resetView).toHaveText("");
      const zoomed = await body(page);
      await resetView.tap();
      await page.clock.runFor(32);
      const midway = await body(page);
      expect(Math.abs(midway.radius - initial.radius)).toBeGreaterThan(0.01);
      expect(Math.abs(midway.radius - initial.radius)).toBeLessThan(
        Math.abs(zoomed.radius - initial.radius),
      );
      await page.clock.runFor(350);
      const restored = await body(page);
      expect(restored.x).toBeCloseTo(initial.x, 3);
      expect(restored.y).toBeCloseTo(initial.y, 3);
      expect(restored.radius).toBeCloseTo(initial.radius, 3);
      await expect(resetView).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test(`${mode} reset view yields to new zoom and respects reduced motion`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await boot(page, mode);
    const initial = await body(page);
    const point = { x: 810, y: 410 };
    const resetView = page.getByRole("button", {
      name: "Reset view",
      exact: true,
    });
    await wheelZoom(page, 1.15, point);
    await resetView.click();
    await page.clock.runFor(48);
    await wheelZoom(page, 0.95, point);
    const interrupted = await body(page);
    await page.clock.runFor(400);
    expect(await body(page)).toEqual(interrupted);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await resetView.click();
    const restored = await body(page);
    expect(restored.x).toBeCloseTo(initial.x, 3);
    expect(restored.y).toBeCloseTo(initial.y, 3);
    expect(restored.radius).toBeCloseTo(initial.radius, 3);
    await expect(resetView).toHaveCount(0);
  });
}
