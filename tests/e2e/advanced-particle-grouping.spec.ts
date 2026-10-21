import { expect, test } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";

for (const viewport of [
  { width: 1200, height: 800 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test(`independent grouping and clickable help fit ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(markTutorialSeen);
    await page.goto("/?mode=gravity&seed=42");
    const open = async () => {
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page.getByRole("button", { name: "Advanced", exact: true }).click();
    };
    await open();
    const menu = page.getByRole("dialog", { name: "Paused", exact: true });
    const grouping = menu.getByRole("switch", {
      name: "Particle grouping",
      exact: true,
    });
    const interaction = menu.getByRole("switch", {
      name: "Particle Interaction",
      exact: true,
    });
    await expect(grouping).toHaveAttribute("aria-checked", "false");
    await expect(interaction).toHaveAttribute("aria-checked", "true");
    await expect(
      menu.getByRole("switch", { name: "Path assist", exact: true }),
    ).toHaveCount(0);
    for (const label of ["Particle Interaction", "Particle grouping"]) {
      const help = menu.getByRole("button", {
        name: `About ${label}`,
        exact: true,
      });
      await help.click();
      await expect(help).toHaveAttribute("aria-expanded", "true");
      const explanation = page.locator(
        `[id="${await help.getAttribute("aria-controls")}"]`,
      );
      await expect(explanation).toBeVisible();
      expect((await explanation.textContent())!.length).toBeGreaterThan(30);
      const box = (await help.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      await expect(grouping).toHaveAttribute("aria-checked", "false");
      await expect(interaction).toHaveAttribute("aria-checked", "true");
      await help.click();
      await expect(explanation).toBeHidden();
    }
    await grouping.click();
    await interaction.click();
    await page.reload();
    await open();
    await expect(grouping).toHaveAttribute("aria-checked", "true");
    await expect(interaction).toHaveAttribute("aria-checked", "false");
    await grouping.click();
    await interaction.click();
    await menu
      .getByRole("button", { name: "About Particle grouping", exact: true })
      .click();
    if (viewport.width === 390)
      await page.screenshot({
        path: "/private/tmp/orbit-advanced-grouping.png",
      });
    expect(
      await menu.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
  });
}

test("Odessey omits Full path assist and an empty Advanced section despite legacy storage", async ({
  page,
}) => {
  await page.addInitScript(markTutorialSeen);
  await page.addInitScript(() =>
    localStorage.setItem("orbit.path-assist.v1", "full"),
  );
  await page.goto("/?mode=odessey&seed=42");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Paused", exact: true });
  await expect(
    menu.getByRole("button", { name: "Advanced", exact: true }),
  ).toHaveCount(0);
  await expect(menu.locator(".pause-advanced-panel")).toHaveCount(0);
  await expect(
    menu.getByRole("switch", { name: "Path assist", exact: true }),
  ).toHaveCount(0);
  await expect(
    menu.getByRole("button", { name: "About Path assist", exact: true }),
  ).toHaveCount(0);
  await expect(
    menu.getByRole("button", { name: "Resume", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    menu.getByRole("button", { name: "Dark mode", exact: true }),
  ).toBeFocused();
});
