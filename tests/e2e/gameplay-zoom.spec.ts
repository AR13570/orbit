import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";

type Mode = "zen" | "gravity";
type Point = { x: number; y: number; id: number };
const fieldName = (mode: Mode) =>
  mode === "zen" ? "Slingshot flight field" : "Gravity orbital field";

async function boot(page: Page, mode: Mode, seen = true) {
  if (seen) await page.addInitScript(markTutorialSeen);
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto(`/?mode=${mode}&seed=42`);
  await page.clock.runFor(200);
}
async function percent(page: Page, value: number) {
  await expect(
    page.getByRole("button", { name: "Reset zoom", exact: true }),
  ).toContainText(`${value}%`);
}
async function touch(cdp: CDPSession, type: string, points: Point[]) {
  await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
}
async function idle(page: Page, mode: Mode) {
  await expect(page.locator(".game-surface [role=status]")).toHaveText(
    mode === "zen" ? "Ready to pull" : "0 / 12 projectiles in flight",
  );
}

for (const mode of ["zen", "gravity"] as const) {
  test(`${mode} desktop zoom supports wheel, buttons, keys and resize without firing`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await boot(page, mode);
    await percent(page, 100);
    const field = page.getByLabel(fieldName(mode));
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Reset zoom", exact: true }),
    ).not.toContainText("100%");
    for (let i = 0; i < 12; i++) {
      const button = page.getByRole("button", { name: "Zoom in", exact: true });
      if (!(await button.isEnabled())) break;
      await button.click();
    }
    await percent(page, 160);
    for (let i = 0; i < 12; i++) {
      const button = page.getByRole("button", {
        name: "Zoom out",
        exact: true,
      });
      if (!(await button.isEnabled())) break;
      await button.click();
    }
    await percent(page, 80);
    await page.mouse.move(350, 300);
    await page.mouse.down();
    await page.mouse.move(410, 300);
    await page.mouse.wheel(0, -10000);
    await page.clock.runFor(100);
    await page.mouse.up();
    await idle(page, mode);
    await percent(page, 160);
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.clock.runFor(100);
    await percent(page, 160);
    await page.getByRole("button", { name: "Reset zoom", exact: true }).click();
    await percent(page, 100);
    await page.mouse.move(350, 300);
    await page.mouse.wheel(0, -10000);
    await page.clock.runFor(100);
    await percent(page, 160);
    await page.mouse.wheel(0, 10000);
    await page.clock.runFor(100);
    await percent(page, 80);
    await field.focus();
    await page.keyboard.press("0");
    await percent(page, 100);
    await page.keyboard.press("+");
    await expect(
      page.getByRole("button", { name: "Reset zoom", exact: true }),
    ).not.toContainText("100%");
    await page.keyboard.press("-");
    await page.keyboard.press("0");
    await percent(page, 100);
    await idle(page, mode);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.mouse.wheel(0, -10000);
    await page.keyboard.press("+");
    await page.clock.runFor(100);
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await percent(page, 100);
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
        const a = { id: 1, x: 140, y: Math.min(250, viewport.height * 0.55) };
        const b = { id: 2, x: 220, y: a.y };
        await touch(cdp, "touchStart", [a]);
        await touch(cdp, "touchStart", [a, b]);
        const spread = { ...b, x: 260 };
        await touch(cdp, "touchMove", [a, spread]);
        await page.clock.runFor(50);
        await percent(page, 150);
        await touch(cdp, "touchEnd", [a]);
        await touch(cdp, "touchMove", [{ ...a, x: a.x + 72 }]);
        await touch(cdp, "touchEnd", []);
        await page.clock.runFor(50);
        await idle(page, mode);
        await percent(page, 150);
        await page.setViewportSize({
          width: viewport.height,
          height: viewport.width,
        });
        await page.clock.runFor(100);
        await percent(page, 150);
        await page.screenshot({
          path: `/private/tmp/orbit-${mode}-pinch-${viewport.width}x${viewport.height}.png`,
        });
        await page
          .getByRole("button", { name: "Reset zoom", exact: true })
          .click();
        await percent(page, 100);
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
          mode === "zen"
            ? /In flight|Offscreen/
            : "1 / 12 projectiles in flight",
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
    const a = { id: 2, x: 140, y: 300 },
      b = { id: 3, x: 220, y: 300 };
    await touch(cdp, "touchStart", [a]);
    await touch(cdp, "touchStart", [a, b]);
    await touch(cdp, "touchMove", [a, { ...b, x: 260 }]);
    await touch(cdp, "touchEnd", [a]);
    await touch(cdp, "touchEnd", []);
    await page.clock.runFor(32);
    await percent(page, 150);
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
