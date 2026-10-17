import { expect, test } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";

for (const mode of ["odessey", "gravity"])
  for (const viewport of [
    { width: 1200, height: 800 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ])
    test(`${mode} pause actions stay reachable at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript(markTutorialSeen);
      await page.goto(`/?mode=${mode}&seed=42`);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      const menu = page.getByRole("dialog", { name: "Paused" });
      await expect(menu).toBeVisible();
      const advanced = menu.getByRole("button", {
        name: "Advanced",
        exact: true,
      });
      await expect(advanced).toHaveAttribute("aria-expanded", "false");
      await expect(menu.getByRole("switch")).toHaveCount(0);
      await menu.getByRole("button", { name: "Resume", exact: true }).focus();
      await page.keyboard.press("Tab");
      await expect(advanced).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(
        menu.getByRole("button", { name: "Sound on", exact: true }),
      ).toBeFocused();
      await advanced.click();
      const assist = menu.getByRole("switch", {
        name: "Path assist",
        exact: true,
      });
      await expect(assist).toHaveAttribute("aria-checked", "false");
      await expect(
        menu.getByRole("button", { name: /^(Full|Partial)$/ }),
      ).toHaveCount(0);
      const label = (await menu
        .getByText("Path assist", { exact: true })
        .boundingBox())!;
      const soundLabel = (await menu
        .getByText("Sound on", { exact: true })
        .boundingBox())!;
      const switchRow = (await assist.boundingBox())!;
      expect(Math.abs(label.x - soundLabel.x)).toBeLessThan(1);
      expect(
        Math.abs(
          label.y + label.height / 2 - switchRow.y - switchRow.height / 2,
        ),
      ).toBeLessThan(1);
      expect(
        await menu.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true);
      if (viewport.height >= 800)
        expect(
          await menu.evaluate(
            (element) => element.scrollHeight <= element.clientHeight,
          ),
        ).toBe(true);

      const actions = [
        "Resume",
        "Advanced",
        "Path assist",
        ...(mode === "gravity" ? ["Particle Interaction"] : []),
        "Sound on",
        "How to play",
        "Restart level",
        "Choose mode",
        ...(mode === "gravity" ? ["Choose a level"] : ["New seed"]),
      ];
      for (const name of actions) {
        const button = menu.getByRole(
          name === "Path assist" || name === "Particle Interaction"
            ? "switch"
            : "button",
          { name, exact: true },
        );
        await button.scrollIntoViewIfNeeded();
        const box = (await button.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      }
      await menu
        .getByRole("switch", { name: "Path assist", exact: true })
        .click();
      await expect(
        menu.getByRole("switch", { name: "Path assist", exact: true }),
      ).toHaveAttribute("aria-checked", "true");
      await assist.focus();
      await page.keyboard.press("Space");
      await expect(assist).toHaveAttribute("aria-checked", "false");
      await page.keyboard.press("Enter");
      await expect(assist).toHaveAttribute("aria-checked", "true");
      await menu.getByRole("button", { name: "Sound on", exact: true }).click();
      await expect(
        menu.getByRole("button", { name: "Sound off", exact: true }),
      ).toHaveAttribute("aria-pressed", "false");
      const last = menu.getByRole("button", {
        name: "Choose mode",
        exact: true,
      });
      await last.focus();
      await page.keyboard.press("Tab");
      await expect(
        menu.getByRole("button", { name: "Resume", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(last).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);
      await page.keyboard.press("p");
      await expect(advanced).toHaveAttribute("aria-expanded", "false");
      await advanced.click();
      await expect(
        menu.getByRole("switch", { name: "Path assist", exact: true }),
      ).toHaveAttribute("aria-checked", "true");
      await page.keyboard.press("p");
      await expect(menu).toHaveCount(0);
    });
