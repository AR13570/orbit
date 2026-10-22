import { expect, test, type Locator } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";

async function sample(panel: Locator) {
  return panel.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    opacity: Number(getComputedStyle(element).opacity),
  }));
}

async function toggleAndSample(toggle: Locator, panel: Locator) {
  await toggle.evaluate(async (element: HTMLButtonElement) => {
    const expanded = element.getAttribute("aria-expanded");
    element.click();
    while (element.getAttribute("aria-expanded") === expanded)
      await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
  return sample(panel);
}

async function settle(panel: Locator) {
  await panel.evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished),
    );
  });
}

for (const mode of ["odessey", "gravity"]) {
  test(`${mode} pause closes with Escape or backdrop mouse and touch clicks`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 1200, height: 800 },
    });
    const page = await context.newPage();
    await page.addInitScript(markTutorialSeen);
    await page.goto(`/?mode=${mode}&seed=42`);
    const pause = page.getByRole("button", { name: "Pause", exact: true });
    const menu = page.getByRole("dialog", { name: "Paused" });
    await pause.click();
    await menu.getByRole("heading", { name: "Paused", exact: true }).click();
    await expect(menu).toBeVisible();
    await menu.getByRole("button", { name: "Sound on", exact: true }).click();
    const sound = menu.getByRole("button", { name: "Sound off", exact: true });
    await expect(sound).toHaveAttribute("aria-pressed", "false");
    if (mode === "gravity") {
      await menu.getByRole("button", { name: "Advanced", exact: true }).click();
      const grouping = menu.getByRole("switch", {
        name: "Particle grouping",
        exact: true,
      });
      await grouping.setChecked(true);
      await expect(grouping).toHaveAttribute("aria-checked", "true");
      await grouping.focus();
    } else {
      await expect(
        menu.getByRole("button", { name: "Advanced", exact: true }),
      ).toHaveCount(0);
      await sound.focus();
    }
    await expect(
      menu.getByRole("switch", { name: "Path assist", exact: true }),
    ).toHaveCount(0);
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await pause.click();
    await page.mouse.click(10, 10);
    await expect(menu).toHaveCount(0);
    await pause.click();
    await page.touchscreen.tap(10, 10);
    await expect(menu).toHaveCount(0);
    await pause.click();
    await expect(
      menu.getByRole("button", { name: "Restart level", exact: true }),
    ).toHaveCount(1);
    if (mode === "gravity") {
      await menu
        .getByRole("button", { name: "Choose a level", exact: true })
        .click();
      const levels = page.getByRole("dialog", {
        name: "Choose a level",
        exact: true,
      });
      await page.mouse.click(10, 10);
      await expect(levels).toBeVisible();
      await levels
        .getByRole("button", { name: "Back to pause", exact: true })
        .focus();
      await page.keyboard.press("Escape");
      await expect(menu).toBeVisible();
    }
    await menu
      .getByRole("button", { name: "How to play", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await expect(menu).toBeVisible();
    await context.close();
  });
}

test("gravity Advanced reverses smoothly and disables closing controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(markTutorialSeen);
  await page.goto("/?mode=gravity&seed=42");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Paused" });
  await settle(menu);
  const toggle = menu.getByRole("button", { name: "Advanced", exact: true });
  const panel = page.locator(
    `[id="${await toggle.getAttribute("aria-controls")}"]`,
  );
  const sound = menu.getByRole("button", { name: "Sound on", exact: true });
  const theme = menu.getByRole("button", { name: "Dark mode", exact: true });
  const initialSoundY =
    (await sound.boundingBox())!.y - (await menu.boundingBox())!.y;
  expect((await sample(panel)).height).toBe(0);

  const opening = await toggleAndSample(toggle, panel);
  await settle(panel);
  const opened = await sample(panel);
  expect(opening.height).toBeGreaterThan(0);
  expect(opening.height).toBeLessThan(opened.height);
  expect(opening.opacity).toBeGreaterThan(0);
  expect(opening.opacity).toBeLessThan(1);
  expect(
    (await sound.boundingBox())!.y -
      (await menu.boundingBox())!.y -
      initialSoundY,
  ).toBeCloseTo(opened.height, 0);
  const grouping = menu.getByRole("switch", {
    name: "Particle grouping",
    exact: true,
  });
  await grouping.setChecked(true);
  await expect(grouping).toHaveAttribute("aria-checked", "true");

  const closing = await toggleAndSample(toggle, panel);
  expect(closing.height).toBeGreaterThan(0);
  expect(closing.height).toBeLessThan(opened.height);
  expect(closing.opacity).toBeGreaterThan(0);
  expect(closing.opacity).toBeLessThan(1);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toHaveAttribute("inert", "");
  await expect(menu.getByRole("switch")).toHaveCount(0);
  await toggle.focus();
  await page.keyboard.press("Tab");
  await expect(theme).toBeFocused();
  await panel
    .locator("button")
    .first()
    .evaluate((element: HTMLButtonElement) => element.focus());
  await expect(theme).toBeFocused();

  await toggleAndSample(toggle, panel);
  await toggleAndSample(toggle, panel);
  await toggleAndSample(toggle, panel);
  await settle(panel);
  expect((await sample(panel)).height).toBeCloseTo(opened.height, 0);
  expect((await sample(panel)).opacity).toBe(1);
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(grouping).toHaveAttribute("aria-checked", "true");
  await toggleAndSample(toggle, panel);
  await settle(panel);
  expect((await sample(panel)).height).toBe(0);
  expect(
    (await sound.boundingBox())!.y - (await menu.boundingBox())!.y,
  ).toBeCloseTo(initialSoundY, 0);
});

test("gravity Advanced is immediate with reduced motion and fits mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(markTutorialSeen);
  await page.goto("/?mode=gravity&seed=42");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Paused" });
  const toggle = menu.getByRole("button", { name: "Advanced", exact: true });
  const panel = page.locator(
    `[id="${await toggle.getAttribute("aria-controls")}"]`,
  );
  const opening = await toggleAndSample(toggle, panel);
  expect(opening.height).toBeGreaterThan(40);
  expect(opening.opacity).toBe(1);
  expect(
    await panel.evaluate(
      (element) => element.getAnimations({ subtree: true }).length,
    ),
  ).toBe(0);
  expect(
    await menu.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  const grouping = menu.getByRole("switch", {
    name: "Particle grouping",
    exact: true,
  });
  await grouping.scrollIntoViewIfNeeded();
  const box = (await grouping.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(box.height).toBeGreaterThanOrEqual(44);
  const closing = await toggleAndSample(toggle, panel);
  expect(closing.height).toBe(0);
  expect(closing.opacity).toBe(0);
  await expect(menu.getByRole("switch")).toHaveCount(0);
  await toggle.focus();
  await page.keyboard.press("Tab");
  await expect(
    menu.getByRole("button", { name: "Dark mode", exact: true }),
  ).toBeFocused();
});
