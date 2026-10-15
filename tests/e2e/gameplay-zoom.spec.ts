import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";
import {
  bodyRadius,
  expectNoZoomControls,
  expectRenderedZoom,
  installZoomProbe,
  resetZoom,
} from "./zoom-fixture";

type Mode = "zen" | "gravity";
type Point = { x: number; y: number; id: number };
const fieldName = (mode: Mode) =>
  mode === "zen" ? "Slingshot flight field" : "Gravity orbital field";

async function boot(page: Page, mode: Mode, seen = true) {
  if (seen) await page.addInitScript(markTutorialSeen);
  await installZoomProbe(page);
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto(`/?mode=${mode}&seed=42`);
  await page.clock.runFor(200);
}
async function touch(cdp: CDPSession, type: string, points: Point[]) {
  await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
}
async function idle(page: Page, mode: Mode) {
  await expect(page.locator(".game-surface [role=status]")).toHaveText(
    mode === "zen" ? "Ready to pull" : "0 planets in motion",
  );
}

for (const mode of ["zen", "gravity"] as const) {
  test(`${mode} desktop zoom supports wheel, keys and resize without firing or visible controls`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await boot(page, mode);
    await expectNoZoomControls(page);
    let baseline = await bodyRadius(page);
    const field = page.getByLabel(fieldName(mode));
    await field.focus();
    await page.keyboard.press("+");
    await expectRenderedZoom(page, baseline, 1.15);
    await page.keyboard.press("-");
    await expectRenderedZoom(page, baseline, 1);
    for (let i = 0; i < 40; i++) await page.keyboard.press("+");
    await expectRenderedZoom(page, baseline, 4);
    for (let i = 0; i < 40; i++) await page.keyboard.press("-");
    await expectRenderedZoom(page, baseline, 0.25);
    await page.mouse.move(350, 300);
    await page.mouse.down();
    await page.mouse.move(410, 300);
    await page.mouse.wheel(0, -10000);
    await page.clock.runFor(32);
    await page.mouse.wheel(0, -10000);
    await page.clock.runFor(100);
    await page.mouse.up();
    await idle(page, mode);
    await expectRenderedZoom(page, baseline, 4);
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.clock.runFor(100);
    const resizedZoomedRadius = await bodyRadius(page);
    await resetZoom(page, fieldName(mode));
    baseline = await bodyRadius(page);
    expect(resizedZoomedRadius / baseline).toBeCloseTo(4, 3);
    await expectRenderedZoom(page, baseline, 1);
    await page.mouse.move(350, 300);
    await page.mouse.wheel(0, -10000);
    await page.clock.runFor(32);
    await page.mouse.wheel(0, -10000);
    await page.clock.runFor(100);
    await expectRenderedZoom(page, baseline, 4);
    await page.mouse.wheel(0, 10000);
    await page.clock.runFor(32);
    await page.mouse.wheel(0, 10000);
    await page.clock.runFor(100);
    await expectRenderedZoom(page, baseline, 0.25);
    await resetZoom(page, fieldName(mode));
    await expectRenderedZoom(page, baseline, 1);
    await idle(page, mode);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.mouse.wheel(0, -10000);
    await page.clock.runFor(32);
    await page.mouse.wheel(0, -10000);
    await page.keyboard.press("+");
    await page.clock.runFor(100);
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expectRenderedZoom(page, baseline, 1);
    await expectNoZoomControls(page);
    await idle(page, mode);
  });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    test(`${mode} real pinch owns both fingers and a later single pull launches ${viewport.width}x${viewport.height}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport,
        hasTouch: true,
        isMobile: true,
      });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      try {
        await boot(page, mode);
        await expectNoZoomControls(page);
        let baseline = await bodyRadius(page);
        const a = { id: 1, x: 140, y: Math.min(250, viewport.height * 0.55) };
        const b = { id: 2, x: 220, y: a.y };
        await touch(cdp, "touchStart", [a]);
        await touch(cdp, "touchStart", [a, b]);
        const spread = { ...b, x: 260 };
        await touch(cdp, "touchMove", [a, spread]);
        await page.clock.runFor(50);
        await expectRenderedZoom(page, baseline, 1.5);
        await touch(cdp, "touchEnd", [a]);
        await touch(cdp, "touchMove", [{ ...a, x: a.x + 72 }]);
        await touch(cdp, "touchEnd", []);
        await page.clock.runFor(50);
        await idle(page, mode);
        await expectRenderedZoom(page, baseline, 1.5);
        await page.setViewportSize({
          width: viewport.height,
          height: viewport.width,
        });
        await page.clock.runFor(100);
        const resizedPinchedRadius = await bodyRadius(page);
        await page.screenshot({
          path: `/private/tmp/orbit-${mode}-pinch-${viewport.width}x${viewport.height}.png`,
        });
        await resetZoom(page, fieldName(mode));
        baseline = await bodyRadius(page);
        expect(resizedPinchedRadius / baseline).toBeCloseTo(1.5, 3);
        await expectRenderedZoom(page, baseline, 1);
        // A new native pinch can zoom out after the first touch session is over.
        const c = { id: 4, x: 140, y: Math.min(220, viewport.width * 0.45) };
        const d = { id: 5, x: 260, y: c.y };
        await touch(cdp, "touchStart", [c]);
        await touch(cdp, "touchStart", [c, d]);
        await touch(cdp, "touchMove", [c, { ...d, x: 200 }]);
        await touch(cdp, "touchEnd", []);
        await expectRenderedZoom(page, baseline, 0.5);
        await idle(page, mode);
        await resetZoom(page, fieldName(mode));
        await expectRenderedZoom(page, baseline, 1);
        const point = {
          id: 3,
          x: 150,
          y: Math.min(220, viewport.width * 0.45),
        };
        await touch(cdp, "touchStart", [point]);
        await touch(cdp, "touchMove", [{ ...point, x: point.x + 72 }]);
        await touch(cdp, "touchEnd", []);
        await page.clock.runFor(32);
        await expect(page.locator(".game-surface [role=status]")).toHaveText(
          mode === "zen" ? /In flight|Offscreen/ : "1 planet in motion",
        );
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }

  test(`${mode} walkthrough has no gameplay zoom controls and ignores wheel zoom`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await boot(page, mode, false);
    await expect(
      page.getByRole("dialog", {
        name: `How to play ${mode === "zen" ? "Zen" : "Gravity"}`,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^(Zoom in|Zoom out|Reset zoom)$/ }),
    ).toHaveCount(0);
    if (mode === "gravity") {
      const baseline = await bodyRadius(page);
      await page.mouse.move(300, 300);
      await page.mouse.wheel(0, -10000);
      await page.keyboard.press("+");
      await page.clock.runFor(1000);
      await expectRenderedZoom(page, baseline, 1);
      await expect(
        page.getByRole("button", { name: /^(Zoom in|Zoom out|Reset zoom)$/ }),
      ).toHaveCount(0);
      return;
    }
    for (let i = 0; i < 4; i++) {
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.clock.runFor(1000);
    }
    const line = page.locator(".practice-pull-guide line");
    await expect(line).toBeAttached();
    const before = await line.evaluate((el) =>
      ["x1", "y1", "x2", "y2"].map((attr) => Number(el.getAttribute(attr))),
    );
    await page.mouse.move(300, 300);
    await page.mouse.wheel(0, -10000);
    await page.keyboard.press("+");
    await page.clock.runFor(1000);
    const after = await line.evaluate((el) =>
      ["x1", "y1", "x2", "y2"].map((attr) => Number(el.getAttribute(attr))),
    );
    for (let i = 0; i < before.length; i++)
      expect(after[i]).toBeCloseTo(before[i], 1);
    await expect(
      page.getByRole("button", { name: /^(Zoom in|Zoom out|Reset zoom)$/ }),
    ).toHaveCount(0);
  });
}

test("Zen pinch cancels a pending flight tap without branching", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage(),
    cdp = await context.newCDPSession(page);
  try {
    await boot(page, "zen");
    const point = { id: 1, x: 150, y: 300 };
    for (let i = 0; i < 2; i++) {
      await touch(cdp, "touchStart", [point]);
      await touch(cdp, "touchEnd", []);
      await page.clock.runFor(50);
    }
    await expect(page.locator('.game-surface [aria-live="polite"]')).toHaveText(
      "Split mode",
    );
    await touch(cdp, "touchStart", [point]);
    await touch(cdp, "touchMove", [{ ...point, x: 222 }]);
    await touch(cdp, "touchEnd", []);
    await page.clock.runFor(32);
    await expect(page.locator('.game-surface [role="status"]')).toHaveText(
      /In flight|Offscreen/,
    );
    const baseline = await bodyRadius(page);
    const a = { id: 2, x: 140, y: 300 },
      b = { id: 3, x: 220, y: 300 };
    await touch(cdp, "touchStart", [a]);
    await touch(cdp, "touchStart", [a, b]);
    await touch(cdp, "touchMove", [a, { ...b, x: 260 }]);
    await touch(cdp, "touchEnd", [a]);
    await touch(cdp, "touchEnd", []);
    await page.clock.runFor(32);
    await expectRenderedZoom(page, baseline, 1.5);
    await expect(page.locator('.game-surface [aria-live="polite"]')).toHaveText(
      "Split mode",
    );
    await touch(cdp, "touchStart", [{ id: 4, x: 180, y: 300 }]);
    await touch(cdp, "touchEnd", []);
    await page.clock.runFor(32);
    await expect(page.locator('.game-surface [aria-live="polite"]')).toHaveText(
      "Shot split",
    );
  } finally {
    await context.close();
  }
});
