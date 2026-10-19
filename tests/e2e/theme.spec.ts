import { expect, test } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";

test("dark is the first-visit default and the saved theme is shared by both games", async ({
  page,
}) => {
  await page.addInitScript(markTutorialSeen);
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveCSS("color", "rgb(227, 234, 240)");
  await expect(page.locator("html")).toHaveCSS(
    "background-color",
    "rgb(0, 0, 0)",
  );
  await expect(page.locator(".home-screen")).toHaveCSS(
    "background-color",
    "rgb(0, 0, 0)",
  );
  await expect(page.locator(".home-mode").first()).toHaveCSS(
    "background-color",
    "rgb(19, 23, 29)",
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#000000",
  );
  await page
    .getByRole("button", { name: "Switch to light mode", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Play Gravity", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Dark mode", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".pause-menu")).toHaveCSS(
    "background-color",
    "rgb(19, 23, 29)",
  );
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toHaveCSS("background-color", "rgb(227, 234, 240)");
  await page.screenshot({ path: "/private/tmp/orbit-dark-pause.png" });
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator("canvas.scene-canvas")
        .evaluate((canvas: HTMLCanvasElement) =>
          Array.from(canvas.getContext("2d")!.getImageData(0, 0, 1, 1).data),
        ),
    )
    .toEqual([0, 0, 0, 255]);
  await page.mouse.move(950, 400);
  await page.mouse.down();
  await page.mouse.move(950, 470, { steps: 5 });
  await page.screenshot({ path: "/private/tmp/orbit-dark-gravity.png" });
  await page.mouse.up();
  await expect(
    page.getByText("1 planet in motion", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "/private/tmp/orbit-vibrant-projectiles.png" });
  await page
    .getByRole("button", { name: "Back to main menu", exact: true })
    .click();
  await expect(page.locator(".home-mode").first()).toHaveCSS("opacity", "1");
  await expect(page.locator(".home-title-letter").last()).toHaveCSS(
    "opacity",
    "1",
  );
  await page.screenshot({ path: "/private/tmp/orbit-dark-home.png" });
  await page.getByRole("button", { name: "Play Odessey", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator("canvas.scene-canvas")
        .evaluate((canvas: HTMLCanvasElement) =>
          Array.from(canvas.getContext("2d")!.getImageData(0, 0, 1, 1).data),
        ),
    )
    .toEqual([0, 0, 0, 255]);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator("canvas.scene-canvas")
        .evaluate((canvas: HTMLCanvasElement) =>
          Array.from(canvas.getContext("2d")!.getImageData(0, 0, 1, 1).data),
        ),
    )
    .toEqual([233, 236, 239, 255]);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(errors).toEqual([]);
});

test("portrait creator and tutorial share dark surfaces and readable controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?mode=gravity");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "Skip", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "/private/tmp/orbit-dark-tutorial.png" });
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page
    .getByRole("button", { name: "Back to main menu", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Gravity creator", exact: true })
    .click();
  await expect(page.locator(".creator-actions .creator-primary")).toBeVisible();
  await page.screenshot({ path: "/private/tmp/orbit-dark-creator.png" });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
