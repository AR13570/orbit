import { expect, test } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";

for (const mode of ["odessey", "gravity"]) {
  for (const viewport of [
    { width: 1200, height: 800 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    test(`${mode} help and restart fit ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.addInitScript(markTutorialSeen);
      await page.goto(`/?mode=${mode}&seed=42`);
      const header = page.locator(".scene-actions");
      const help = header.getByRole("button", {
        name: "How to play",
        exact: true,
      });
      const reset = header.getByRole("button", {
        name: "Reset level (R)",
        exact: true,
      });
      const helpBox = (await help.boundingBox())!,
        resetBox = (await reset.boundingBox())!;
      expect(helpBox.x + helpBox.width).toBeLessThanOrEqual(resetBox.x);
      expect(helpBox.width).toBeGreaterThanOrEqual(44);
      const brand = (await page.locator(".scene-hud").boundingBox())!;
      expect(brand.x + brand.width).toBeLessThanOrEqual(helpBox.x);
      await expect(
        page.locator(".gravity-instruction, .gesture-hint"),
      ).toHaveCount(0);
      await help.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("button", { name: "Skip", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await header.getByRole("button", { name: "Pause", exact: true }).click();
      const menu = page.getByRole("dialog", { name: "Paused", exact: true });
      await menu
        .getByRole("button", { name: "Restart level", exact: true })
        .click();
      await expect(menu).toHaveCount(0);
      expect(new URL(page.url()).searchParams.get("seed")).toBe("42");
      if (mode === "gravity")
        await expect(page.locator(".gravity-feedback")).toHaveText(
          "0 planets in motion",
        );
      if (viewport.width === 320)
        await page.screenshot({
          path: `/private/tmp/orbit-${mode}-clean-hud.png`,
        });
    });
  }
}
