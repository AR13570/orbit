import { expect, test } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";

for (const device of [
  { width: 1280, height: 800, touch: false },
  { width: 390, height: 844, touch: true },
  { width: 844, height: 390, touch: true },
  { width: 320, height: 568, touch: true },
  { width: 568, height: 320, touch: true },
]) {
  test(`Gravity size control supports native input on ${device.width}x${device.height}`, async ({
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
      await page.addInitScript(markTutorialSeen);
      await page.goto("/?mode=gravity&seed=42");
      const slider = page.getByRole("slider", { name: "Projectile size" });
      await expect(slider).toHaveValue("1");
      const diameter = () =>
        slider.evaluate((input) =>
          parseFloat(
            getComputedStyle(input).getPropertyValue("--projectile-size-thumb"),
          ),
        );
      const minimum = await diameter();
      const small = page.locator(".projectile-size-small");
      const large = page.locator(".projectile-size-large");
      await expect(small).toBeVisible();
      await expect(large).toBeVisible();
      expect((await small.boundingBox())!.width).toBeCloseTo(minimum, 1);
      expect((await large.boundingBox())!.width).toBeCloseTo(minimum * 2, 1);
      await slider.focus();
      await page.keyboard.press("End");
      await expect(slider).toHaveValue("2");
      expect(await diameter()).toBeCloseTo(minimum * 2, 1);
      await page.keyboard.press("ArrowDown");
      await expect(slider).toHaveValue("1.99");
      await page.keyboard.press("ArrowUp");
      await expect(slider).toHaveValue("2");
      await page.keyboard.press("Home");
      await expect(slider).toHaveValue("1");
      expect(await diameter()).toBeCloseTo(minimum, 1);
      for (let step = 0; step < 50; step++)
        await page.keyboard.press("ArrowUp");
      await expect(slider).toHaveValue("1.5");
      expect(await diameter()).toBeCloseTo(minimum * 1.5, 1);
      await page.keyboard.press("Home");
      await expect(slider).toHaveAttribute("aria-valuetext", "Default size");
      await page.keyboard.press("ArrowUp");
      await expect(slider).toHaveValue("1.01");
      await page.keyboard.press("Home");
      await expect(slider).toHaveValue("1");
      await expect(page.locator(".projectile-size-control")).not.toContainText(
        "%",
      );
      const box = (await slider.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThan(box.width);
      if (device.width > device.height && device.height <= 500) {
        expect(box.height).toBe(56);
      } else {
        expect(box.height).toBeGreaterThanOrEqual(80);
        expect(box.height).toBeLessThanOrEqual(96);
      }
      await expect(page.locator(".gameplay-zoom-controls")).toHaveCount(0);
      const control = (await page
        .locator(".projectile-size-control")
        .boundingBox())!;
      expect(control.x).toBeGreaterThanOrEqual(0);
      expect(control.y).toBeGreaterThanOrEqual(0);
      expect(control.x + control.width).toBeLessThanOrEqual(device.width);
      expect(control.y + control.height).toBeLessThanOrEqual(device.height);
      if (device.height > 500) {
        expect(device.height - control.y - control.height).toBeLessThanOrEqual(
          device.width <= 480 ? 80 : 48,
        );
      }
      for (const selector of [
        ".gravity-footer",
        ".gravity-objective",
        ".scene-hud",
        ".scene-actions",
      ]) {
        // The footer spans the viewport, but its visible text only occupies
        // the center. Compare text line boxes so left-side space stays usable.
        const boxes =
          selector === ".gravity-footer"
            ? await page
                .locator(".gravity-footer p:visible")
                .evaluateAll((lines) =>
                  lines.flatMap((line) => {
                    const range = document.createRange();
                    range.selectNodeContents(line);
                    return [...range.getClientRects()].map(
                      ({ x, y, width, height }) => ({ x, y, width, height }),
                    );
                  }),
                )
            : [(await page.locator(selector).boundingBox())!];
        for (const other of boxes) {
          expect(
            control.x >= other.x + other.width ||
              control.x + control.width <= other.x ||
              control.y >= other.y + other.height ||
              control.y + control.height <= other.y,
            selector,
          ).toBe(true);
        }
      }
      const x = box.x + box.width / 2;
      const top = box.y + 1;
      const bottom = box.y + box.height - 1;
      const cdp = device.touch ? await context.newCDPSession(page) : null;
      const drag = async (from: number, to: number) => {
        const heldValues: number[] = [];
        if (cdp) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ id: 1, x, y: from }],
          });
          for (let step = 1; step <= 8; step++) {
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: [{ id: 1, x, y: from + ((to - from) * step) / 8 }],
            });
            heldValues.push(Number(await slider.inputValue()));
            if (step === 4 && to < from) {
              expect(await diameter()).toBeGreaterThan(minimum);
              expect(await diameter()).toBeLessThan(minimum * 2);
            }
          }
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
        } else {
          await page.mouse.move(x, from);
          await page.mouse.down();
          for (let step = 1; step <= 8; step++) {
            await page.mouse.move(x, from + ((to - from) * step) / 8);
            heldValues.push(Number(await slider.inputValue()));
            if (step === 4 && to < from) {
              expect(await diameter()).toBeGreaterThan(minimum);
              expect(await diameter()).toBeLessThan(minimum * 2);
            }
          }
          await page.mouse.up();
        }
        expect(
          heldValues.some(
            (value) => Math.abs(value * 10 - Math.round(value * 10)) > 0.01,
          ),
        ).toBe(true);
      };
      await drag(bottom, top);
      await expect(slider).toHaveValue("2");
      await drag(top, bottom);
      await expect(slider).toHaveValue("1");
      await expect(page.locator(".gravity-feedback")).toHaveText(
        "0 planets in motion",
      );
      // Touching the slider with a second finger interrupts a held canvas launch.
      if (cdp) {
        const aim = { id: 1, x: device.width * 0.55, y: device.height * 0.55 };
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [aim],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ ...aim, x: aim.x + 30 }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [
            { ...aim, x: aim.x + 30 },
            { id: 2, x, y: bottom },
          ],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await expect(page.locator(".gravity-feedback")).toHaveText(
          "0 planets in motion",
        );
      }
      await slider.focus();
      await page.keyboard.press("End");
      await page.keyboard.press("ArrowDown");
      await page.getByRole("button", { name: "Reset level (R)" }).click();
      await expect(slider).toHaveValue("1.99");
      await page.getByRole("button", { name: "Skip level" }).click();
      await page
        .getByRole("dialog", { name: "Skip this level?" })
        .getByRole("button", { name: "Skip level", exact: true })
        .click();
      await expect(slider).toHaveValue("1.99");
      await page.reload();
      await expect(slider).toHaveValue("1.99");
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await expect(slider).toHaveCount(0);
      await page.getByRole("button", { name: "Resume", exact: true }).click();
      await expect(slider).toHaveValue("1.99");
      await page.screenshot({
        path: `/private/tmp/orbit-size-feedback-${device.width}x${device.height}.png`,
      });
      await page.evaluate(() =>
        localStorage.setItem("orbit.gravity.projectile-size.v1", "0.5"),
      );
      await page.reload();
      await expect(slider).toHaveValue("1");
      await expect(slider).toHaveAttribute("aria-valuetext", "Default size");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("Gravity size comparison stays inside its hit area at maximum zoom", async ({
  page,
}) => {
  await page.addInitScript(markTutorialSeen);
  await page.goto("/?mode=gravity&seed=42");
  await page.getByLabel("Gravity orbital field").hover();
  await page.mouse.wheel(0, -1000);
  const slider = page.getByRole("slider", { name: "Projectile size" });
  await expect
    .poll(() =>
      page
        .locator(".projectile-size-small")
        .evaluate((marker) => marker.getBoundingClientRect().width),
    )
    .toBe(18);
  await slider.focus();
  await page.keyboard.press("End");
  expect(
    (await page.locator(".projectile-size-large").boundingBox())!.width,
  ).toBe(36);
  expect(
    await slider.evaluate((input) =>
      getComputedStyle(input)
        .getPropertyValue("--projectile-size-thumb")
        .trim(),
    ),
  ).toBe("36px");
  const control = (await page
    .locator(".projectile-size-control")
    .boundingBox())!;
  expect(control.width).toBe(44);
  expect(control.y).toBeGreaterThan(0);
  await page.screenshot({
    path: "/private/tmp/orbit-size-feedback-maximum-zoom.png",
  });
});

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 320, height: 568 },
]) {
  test(`Gravity practice grows its size preview and keeps preferences on ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => {
      localStorage.setItem("orbit.gravity.projectile-size.v1", "1.5");
      localStorage.removeItem("orbit.walkthrough.gravity.v2");
    });
    await page.goto("/?mode=gravity&seed=42");
    const field = page.getByLabel("Gravity practice field");
    await field.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    const slider = page.getByRole("slider", { name: "Projectile size" });
    await expect(slider).toHaveValue("1");
    const diameter = () =>
      slider.evaluate((input) =>
        parseFloat(
          getComputedStyle(input).getPropertyValue("--projectile-size-thumb"),
        ),
      );
    const minimum = await diameter();
    await slider.focus();
    for (let step = 0; step < 50; step++) await page.keyboard.press("ArrowUp");
    await expect(slider).toHaveValue("1.5");
    expect(await diameter()).toBeCloseTo(minimum * 1.5, 1);
    await page.keyboard.press("End");
    expect(await diameter()).toBeCloseTo(minimum * 2, 1);
    expect(
      await page.evaluate(() =>
        localStorage.getItem("orbit.gravity.projectile-size.v1"),
      ),
    ).toBe("1.5");
    const control = (await page
      .locator(".gravity-guide .projectile-size-control")
      .boundingBox())!;
    const practice = (await field.boundingBox())!;
    expect(control.y).toBeGreaterThanOrEqual(practice.y);
    expect(control.y + control.height).toBeLessThanOrEqual(
      practice.y + practice.height,
    );
    await page.screenshot({
      path: `/private/tmp/orbit-size-feedback-guide-${viewport.width}x${viewport.height}.png`,
    });
  });
}
