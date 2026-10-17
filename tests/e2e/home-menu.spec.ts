import { expect, test } from "@playwright/test";
import { OrbitEngine } from "../../src/game/engine";
import { markTutorialSeen } from "./tutorial-fixture";

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 320, height: 568 },
]) {
  test(`home menu is readable and both previews animate at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(markTutorialSeen);
    await page.addInitScript(() =>
      localStorage.setItem("orbit.sound-muted.v1", "true"),
    );
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(viewport.width);
    for (const name of [
      "Play Odessey",
      "Play Gravity",
      "How to play Odessey",
      "How to play Gravity",
      "Gravity creator",
    ]) {
      const box = await page
        .getByRole("button", { name, exact: true })
        .boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      if (viewport.height >= 800)
        expect(box!.y + box!.height).toBeLessThan(viewport.height);
    }
    await expect(page.locator(".home-progress")).toHaveCount(0);
    await expect(page.locator(".home-mode-divider")).toHaveCount(0);
    for (const station of await page.locator(".home-mode").all()) {
      const preview = await station.locator(".home-preview").boundingBox();
      const center = await station.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return (
          rect.y +
          (rect.height +
            parseFloat(style.paddingTop) -
            parseFloat(style.paddingBottom)) /
            2
        );
      });
      expect(Math.abs(preview!.y + preview!.height / 2 - center)).toBeLessThan(
        1,
      );
      const play = await station.locator(".home-play").boundingBox();
      const help = await station.locator(".home-help").boundingBox();
      const face = await station.locator(".home-play-face").boundingBox();
      expect(face!.height).toBeLessThanOrEqual(32);
      expect(
        Math.abs(play!.y + play!.height / 2 - help!.y - help!.height / 2),
      ).toBeLessThan(1);
      expect(help!.x - play!.x - play!.width).toBeGreaterThanOrEqual(10);
      expect(help!.x - play!.x - play!.width).toBeLessThanOrEqual(14);
    }
    if (viewport.width > 760) {
      const buttons = await page.locator(".home-play").all();
      const first = await buttons[0].boundingBox();
      const second = await buttons[1].boundingBox();
      expect(Math.abs(first!.y - second!.y)).toBeLessThan(1);
    }
    for (const selector of [".home-moving-ship", ".home-moving-planet"]) {
      const particle = page.locator(selector).first();
      const start = await particle.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y };
      });
      await expect
        .poll(async () => {
          const result = await particle.evaluate((el, before) => {
            const r = el.getBoundingClientRect();
            return Math.hypot(r.x - before.x, r.y - before.y);
          }, start);
          return result;
        })
        .toBeGreaterThan(1);
    }
    await page.screenshot({
      path: `/private/tmp/orbit-home-${viewport.width}x${viewport.height}.png`,
      fullPage: true,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(
      page.locator('.home-preview [style*="home-travel"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('.home-preview[data-motion="still"]'),
    ).toHaveCount(2);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(
      page.locator('.home-preview [style*="home-travel"]'),
    ).toHaveCount(4);
    await page
      .getByRole("button", { name: "Play Gravity", exact: true })
      .click();
    await expect(page.getByLabel("Gravity orbital field")).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("saved progress sits with the heading and compact Continue aligns with help", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(markTutorialSeen);
  await page.addInitScript((checkpoint) => {
    localStorage.setItem("orbit.odessey.default-seed.v1", "42");
    localStorage.setItem(
      "orbit.odessey.progress.v1:42",
      JSON.stringify(checkpoint),
    );
    localStorage.setItem("orbit.gravity.default-seed.v1", "42");
    localStorage.setItem(
      "orbit.gravity.progress.v1:42",
      JSON.stringify({
        version: 1,
        seed: 42,
        currentIndex: 2,
        unlockedIndex: 2,
        completedIndices: [0, 1],
      }),
    );
  }, new OrbitEngine(42, 5).getCheckpoint());
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Continue Odessey", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue Gravity", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".home-mode-heading .home-progress")).toHaveText([
    "Checkpoint 4",
    "Level 3",
  ]);
  for (const station of await page.locator(".home-mode").all()) {
    const title = await station.locator("h2").boundingBox();
    const badge = await station.locator(".home-progress").boundingBox();
    expect(badge!.x).toBeGreaterThan(title!.x + title!.width);
    expect(
      Math.abs(title!.y + title!.height / 2 - badge!.y - badge!.height / 2),
    ).toBeLessThan(1);
    await expect(station.locator(".home-mode-divider")).toBeVisible();
    const play = await station.locator(".home-play").boundingBox();
    const help = await station.locator(".home-help").boundingBox();
    expect(play!.width).toBeLessThan(105);
    expect(play!.height).toBeGreaterThanOrEqual(44);
    expect(
      Math.abs(play!.y + play!.height / 2 - help!.y - help!.height / 2),
    ).toBeLessThan(1);
  }
  await page.screenshot({
    path: "/private/tmp/orbit-home-saved-320.png",
    fullPage: true,
  });
});

test("initial browser saves keep progress badges hidden", async ({ page }) => {
  await page.addInitScript((checkpoint) => {
    localStorage.setItem("orbit.odessey.default-seed.v1", "42");
    localStorage.setItem(
      "orbit.odessey.progress.v1:42",
      JSON.stringify(checkpoint),
    );
    localStorage.setItem("orbit.gravity.default-seed.v1", "42");
    localStorage.setItem(
      "orbit.gravity.progress.v1:42",
      JSON.stringify({
        version: 1,
        seed: 42,
        currentIndex: 0,
        unlockedIndex: 0,
        completedIndices: [],
      }),
    );
  }, new OrbitEngine(42).getCheckpoint());
  await page.goto("/");
  await expect(page.locator(".home-progress")).toHaveCount(0);
  await expect(page.locator(".home-mode-divider")).toHaveCount(0);
});

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`game logos return to the menu and preserve progress at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(markTutorialSeen);
    await page.addInitScript((checkpoint) => {
      localStorage.setItem("orbit.sound-muted.v1", "true");
      localStorage.setItem(
        "orbit.odessey.progress.v1:42",
        JSON.stringify(checkpoint),
      );
      localStorage.setItem(
        "orbit.gravity.progress.v1:42",
        JSON.stringify({
          version: 1,
          seed: 42,
          currentIndex: 2,
          unlockedIndex: 2,
          completedIndices: [0, 1],
        }),
      );
    }, new OrbitEngine(42, 5).getCheckpoint());
    for (const mode of ["odessey", "gravity"]) {
      await page.goto(`/?mode=${mode}&seed=42`);
      const home = page.getByRole("button", {
        name: "Back to main menu",
        exact: true,
      });
      await expect(home).toBeVisible();
      const box = await home.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      await home.click();
      await expect(
        page.getByRole("heading", { name: "Orbit", exact: true }),
      ).toBeVisible();
      expect(new URL(page.url()).searchParams.has("mode")).toBe(false);
      const name = mode === "odessey" ? "Odessey" : "Gravity";
      await page
        .getByRole("button", { name: `Continue ${name}`, exact: true })
        .click();
      if (mode === "odessey")
        await expect(
          page.getByLabel("Checkpoint 4", { exact: true }),
        ).toBeVisible();
      else await expect(page.locator(".gravity-level")).toHaveText("Level 3");
      await page
        .getByRole("button", { name: "Back to main menu", exact: true })
        .press("Enter");
      await expect(
        page.getByRole("heading", { name: "Orbit", exact: true }),
      ).toBeVisible();
    }
  });
}
