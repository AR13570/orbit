import { expect, test } from "@playwright/test";

for (const device of [
  { width: 1200, height: 800, touch: false },
  { width: 390, height: 844, touch: true },
]) {
  test(`Gravity guide Skip stays quiet until keyboard navigation on ${device.width}x${device.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: device,
      hasTouch: device.touch,
      isMobile: device.touch,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    try {
      await page.goto("/?mode=gravity&seed=42");
      const skip = page.getByRole("button", { name: "Skip", exact: true });
      const practice = page.getByLabel("Gravity practice field");
      await expect(skip).toBeVisible();
      await expect(page.locator("body")).toBeFocused();
      await expect(skip).not.toBeFocused();
      await expect(skip).toHaveCSS("outline-style", "none");
      await expect(skip).toHaveCSS("border-radius", "8px");
      await expect(skip).toHaveCSS("font-size", "12px");
      const box = (await skip.boundingBox())!;
      expect(box.width).toBe(56);
      expect(box.height).toBe(44);
      await page.screenshot({
        path: `/private/tmp/orbit-guide-skip-initial-${device.width}x${device.height}.png`,
      });
      await page.keyboard.press("Tab");
      await expect(skip).toBeFocused();
      await expect(skip).toHaveCSS("outline-color", "rgb(137, 148, 157)");
      await expect(skip).toHaveCSS("outline-width", "1px");
      await page.screenshot({
        path: `/private/tmp/orbit-guide-skip-keyboard-${device.width}x${device.height}.png`,
      });
      await page.keyboard.press("Tab");
      await expect(practice).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("heading", { name: "Add another while it moves" }),
      ).toBeVisible();
      await page.keyboard.press("Tab");
      await expect(skip).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(practice).toBeFocused();
      await page.reload();
      await expect(skip).toBeVisible();
      await expect(skip).not.toBeFocused();
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("dialog", { name: "How to play Gravity" }),
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
}

test("Gravity guide recovers when interrupted touches lift outside the field", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  // Reuse the loaded engine module, including Vite's current version query.
  let engineModuleUrl = "";
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/src/gravity/engine.ts")
      engineModuleUrl = request.url();
  });
  const cdp = await context.newCDPSession(page);
  const touch = (
    type: "touchStart" | "touchMove" | "touchEnd",
    touchPoints: { id: number; x: number; y: number }[],
  ) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
  try {
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.goto("/?mode=gravity&seed=42");
    await page.clock.runFor(1000);
    const practice = page.getByLabel("Gravity practice field");
    let field = (await practice.boundingBox())!;
    const a = {
      id: 1,
      x: field.x + field.width * 0.6,
      y: field.y + field.height * 0.7,
    };
    const b = { id: 2, x: a.x + 45, y: a.y };
    await touch("touchStart", [a]);
    await touch("touchMove", [{ ...a, x: a.x - 30 }]);
    await touch("touchStart", [{ ...a, x: a.x - 30 }, b]);
    await touch("touchMove", [
      { ...a, y: 45 },
      { ...b, y: 45 },
    ]);
    await touch("touchEnd", [{ ...b, y: 45 }]);
    await touch("touchEnd", []);
    await expect(
      page.getByRole("heading", { name: "Make your first planet" }),
    ).toBeVisible();
    await touch("touchStart", [{ ...a, id: 3 }]);
    await touch("touchMove", [{ ...a, id: 3, x: a.x - 50 }]);
    await touch("touchEnd", []);
    await expect(
      page.getByRole("heading", { name: "Add another while it moves" }),
    ).toBeVisible();
    await practice.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.clock.runFor(100);
    expect(engineModuleUrl).not.toBe("");
    await page.evaluate(async (moduleUrl) => {
      const { GravityEngine } = await import(moduleUrl);
      const original = GravityEngine.prototype.launch;
      const state = window as typeof window & {
        guideSuccessfulLaunches: number;
      };
      state.guideSuccessfulLaunches = 0;
      GravityEngine.prototype.launch = function () {
        const launched = original.call(this);
        if (launched) state.guideSuccessfulLaunches++;
        return launched;
      };
    }, engineModuleUrl);
    await practice.focus();
    await page.keyboard.press("Enter");
    expect(
      await page.evaluate(
        () =>
          (window as typeof window & { guideSuccessfulLaunches: number })
            .guideSuccessfulLaunches,
      ),
    ).toBe(1);
    await page.evaluate(() => {
      (
        window as typeof window & { guideSuccessfulLaunches: number }
      ).guideSuccessfulLaunches = 0;
    });
    field = (await practice.boundingBox())!;
    const held = {
      id: 4,
      x: field.x + field.width * 0.6,
      y: field.y + field.height * 0.7,
    };
    const slider = (await page
      .getByRole("slider", { name: "Projectile size" })
      .boundingBox())!;
    const size = {
      id: 5,
      x: slider.x + slider.width / 2,
      y: slider.y + slider.height / 2,
    };
    await touch("touchStart", [held]);
    await touch("touchMove", [{ ...held, x: held.x - 30 }]);
    await touch("touchStart", [{ ...held, x: held.x - 30 }, size]);
    await touch("touchMove", [
      { ...held, y: 45 },
      { ...size, y: 45 },
    ]);
    await touch("touchEnd", [{ ...size, y: 45 }]);
    await touch("touchEnd", []);
    expect(
      await page.evaluate(
        () =>
          (window as typeof window & { guideSuccessfulLaunches: number })
            .guideSuccessfulLaunches,
      ),
    ).toBe(0);
    await touch("touchStart", [{ ...held, id: 6 }]);
    await touch("touchMove", [{ ...held, id: 6, x: held.x - 50 }]);
    await touch("touchEnd", []);
    expect(
      await page.evaluate(
        () =>
          (window as typeof window & { guideSuccessfulLaunches: number })
            .guideSuccessfulLaunches,
      ),
    ).toBe(1);
  } finally {
    await context.close();
  }
});

for (const device of [
  { width: 1200, height: 800, touch: false },
  { width: 390, height: 844, touch: true },
  { width: 844, height: 390, touch: true },
  { width: 320, height: 568, touch: true },
  { width: 568, height: 320, touch: true },
]) {
  test(`Gravity guide size lesson fits and keeps preferences on ${device.width}x${device.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: device,
      hasTouch: device.touch,
      isMobile: device.touch,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.addInitScript(() =>
        localStorage.setItem("orbit.gravity.projectile-size.v1", "1.7"),
      );
      await page.clock.install();
      await page.clock.pauseAt(new Date());
      await page.goto("/?mode=gravity&seed=42");
      await page.clock.runFor(1000);
      const practice = page.getByLabel("Gravity practice field");
      await practice.focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Choose a size" }),
      ).toBeVisible();
      const slider = page.getByRole("slider", { name: "Projectile size" });
      await expect(slider).toHaveValue("1");
      await slider.focus();
      await page.keyboard.press("End");
      await expect(slider).toHaveValue("2");
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("button", { name: "Skip", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(slider).toBeFocused();
      await page.clock.runFor(200);
      const control = (await page
        .locator(".gravity-guide .projectile-size-control")
        .boundingBox())!;
      const field = (await practice.boundingBox())!;
      expect(control.x).toBeGreaterThanOrEqual(field.x);
      expect(control.y).toBeGreaterThanOrEqual(field.y);
      expect(control.x + control.width).toBeLessThanOrEqual(
        field.x + field.width,
      );
      expect(control.y + control.height).toBeLessThanOrEqual(
        field.y + field.height,
      );
      for (const selector of [
        ".gravity-guide-copy",
        ".gravity-guide-actions",
        ".gravity-guide-practice",
      ]) {
        const box = (await page.locator(selector).boundingBox())!;
        expect(box.x, selector).toBeGreaterThanOrEqual(0);
        expect(box.y, selector).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, selector).toBeLessThanOrEqual(device.width);
        expect(box.y + box.height, selector).toBeLessThanOrEqual(device.height);
      }
      await page.screenshot({
        path: `/private/tmp/orbit-guide-size-${device.width}x${device.height}.png`,
      });
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await expect(
        page.getByText(/Pinch to zoom; scroll on desktop/),
      ).toBeVisible();
      await page.clock.runFor(200);
      await page.screenshot({
        path: `/private/tmp/orbit-guide-final-${device.width}x${device.height}.png`,
      });
      await page.getByRole("button", { name: "Start playing" }).click();
      await expect(
        page.getByRole("dialog", { name: "How to play Gravity" }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("slider", { name: "Projectile size" }),
      ).toHaveValue("1.7");
      expect(
        await page.evaluate(() =>
          localStorage.getItem("orbit.walkthrough.gravity.v2"),
        ),
      ).toBe("complete");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
