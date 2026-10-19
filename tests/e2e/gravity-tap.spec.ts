import { expect, test } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";

for (const device of [
  { width: 1280, height: 800, touch: false },
  { width: 390, height: 844, touch: true },
  { width: 844, height: 390, touch: true },
]) {
  test(`Gravity creates a planet without pullback on ${device.width}x${device.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: device,
      hasTouch: device.touch,
      isMobile: device.touch,
    });
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(markTutorialSeen);
      await page.goto("/?mode=gravity&seed=42");
      await expect(page.getByLabel("Gravity orbital field")).toBeVisible();
      const x = Math.round(device.width * 0.8);
      const y = Math.round(device.height * 0.38);
      if (device.touch) {
        await page.touchscreen.tap(x, y);
      } else {
        await page.mouse.click(x, y);
      }
      await expect(
        page.getByText("1 planet in motion", { exact: true }),
      ).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
