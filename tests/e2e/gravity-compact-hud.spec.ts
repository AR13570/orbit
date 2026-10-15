import { expect, test, type Page } from "@playwright/test";
import { newDraft, toGravityLevel } from "../../src/gravity/creator/model";
import { fitGravityFrame } from "../../src/gravity/renderer";
import { worldToClient } from "../../src/render/coordinates";
import { markTutorialSeen } from "./tutorial-fixture";

async function assertObjectiveAction(page: Page, name: string) {
  const objective = page.locator(".gravity-objective");
  const action = objective.getByRole("button", { name, exact: true });
  await expect(action).toBeVisible();
  await expect(action.locator("svg")).toHaveCount(1);
  await expect(page.locator(".gravity-footer button")).toHaveCount(0);
  await expect(page.locator(".gameplay-zoom-controls")).toHaveCount(0);
  const text = (await objective.locator("p").boundingBox())!;
  const button = (await action.boundingBox())!;
  expect(button.height).toBeGreaterThanOrEqual(44);
  expect(button.y).toBeGreaterThanOrEqual(text.y + text.height);
  expect(button.y - (text.y + text.height)).toBeLessThanOrEqual(30);
  const slider = (await page
    .locator(".projectile-size-control")
    .boundingBox())!;
  expect(slider.width).toBeGreaterThanOrEqual(44);
  expect(slider.y + slider.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
  await expect(page.locator(".projectile-size-small")).toBeVisible();
  await expect(page.locator(".projectile-size-large")).toBeVisible();
  const group = (await objective.boundingBox())!;
  expect(
    slider.x + slider.width <= group.x || slider.y >= group.y + group.height,
  ).toBe(true);
  expect(
    await objective.evaluate(
      (element) => getComputedStyle(element).pointerEvents,
    ),
  ).toBe("none");
  expect(
    await action.evaluate((element) => getComputedStyle(element).pointerEvents),
  ).toBe("auto");
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 844, height: 390 },
  { width: 568, height: 320 },
]) {
  test(`Gravity objective actions remain clear with wrapped text at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport,
      hasTouch: viewport.width < 1000,
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(markTutorialSeen);
      await page.addInitScript(() => {
        localStorage.setItem(
          "orbit.gravity.progress.v1:42",
          JSON.stringify({
            version: 1,
            seed: 42,
            currentIndex: 44,
            unlockedIndex: 44,
            completedIndices: [],
          }),
        );
      });
      await page.goto("/?mode=gravity&seed=42");
      await assertObjectiveAction(page, "Skip level");
      await page.screenshot({
        path: `/private/tmp/orbit-hud-campaign-${viewport.width}x${viewport.height}.png`,
      });
      await page
        .getByRole("button", { name: "Skip level", exact: true })
        .click();
      await expect(page.locator(".gravity-level")).toHaveText("Level 46");

      const draft = newDraft();
      draft.name = "Custom orbit";
      draft.bodies[0].position.x = 280;
      draft.bodies.push({
        ...structuredClone(draft.bodies[0]),
        id: "body-2",
        position: { x: 620, y: 450 },
      });
      draft.objective = { kind: "paired", count: 2, turns: 3, hold: 0 };
      draft.requirements = [
        { bodyId: "body-1", count: 1, turns: 3, direction: "clockwise" },
        { bodyId: "body-2", count: 2, turns: 2, direction: "counterclockwise" },
      ];
      await page.evaluate(
        (value) =>
          localStorage.setItem("orbit-creator-draft", JSON.stringify(value)),
        draft,
      );
      await page.goto("/?mode=creator");
      await page.getByRole("button", { name: "Playtest", exact: true }).click();
      await expect(page.locator(".gravity-objective p")).toContainText(
        "counterclockwise",
      );
      await page.screenshot({
        path: `/private/tmp/orbit-hud-custom-${viewport.width}x${viewport.height}.png`,
      });
      await assertObjectiveAction(page, "Back to editor");
      if (viewport.height <= 350) {
        await page.getByLabel("Gravity orbital field").hover();
        await page.mouse.wheel(0, -1000);
        await expect
          .poll(() =>
            page
              .locator(".projectile-size-control")
              .evaluate((element) =>
                parseFloat(
                  getComputedStyle(element).getPropertyValue(
                    "--projectile-size-min",
                  ),
                ),
              ),
          )
          .toBeGreaterThan(9);
        await assertObjectiveAction(page, "Back to editor");
        expect(
          (await page.locator(".projectile-size-small").boundingBox())!.width,
        ).toBe(9);
        expect(
          (await page.locator(".projectile-size-large").boundingBox())!.width,
        ).toBe(18);
        const size = page.getByRole("slider", { name: "Projectile size" });
        await size.focus();
        await page.keyboard.press("End");
        await expect(size).toHaveValue("2");
        await assertObjectiveAction(page, "Back to editor");
        await page.screenshot({
          path: `/private/tmp/orbit-hud-custom-zoom-${viewport.width}x${viewport.height}.png`,
        });
      }
      const group = (await page.locator(".gravity-objective").boundingBox())!;
      const { area, camera } = fitGravityFrame(
        toGravityLevel(draft),
        viewport.width,
        viewport.height,
        viewport.width < 1000,
      );
      for (const body of draft.bodies) {
        const center = worldToClient(
          body.position,
          { left: area.x, top: area.y, width: area.width, height: area.height },
          camera,
        );
        const radius = body.radius * camera.scale + 8;
        expect(
          group.x + group.width <= center.x - radius ||
            group.x >= center.x + radius ||
            group.y + group.height <= center.y - radius ||
            group.y >= center.y + radius,
        ).toBe(true);
      }
      await page
        .getByRole("button", { name: "Back to editor", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Gravity creator", exact: true }),
      ).toHaveCount(1);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
