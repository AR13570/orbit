import { expect, test } from "@playwright/test";
import { OrbitEngine } from "../../src/game/engine";
import { markTutorialSeen } from "./tutorial-fixture";

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`Odessey mode picker, game header and walkthrough on ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(markTutorialSeen);
    await page.addInitScript(() =>
      localStorage.setItem("orbit.sound-muted.v1", "true"),
    );
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: /^Odessey\s*Follow/ }),
    ).toBeVisible();
    await expect(page.getByText("Zen", { exact: true })).toHaveCount(0);
    if (process.env.UPDATE_README_SHOTS === "1" && viewport.width === 1280)
      await page.screenshot({
        path: "docs/images/mode-picker.png",
        animations: "disabled",
      });
    await page.getByRole("button", { name: /^Odessey\s*Follow/ }).click();
    await expect(page).toHaveURL(/mode=odessey/);
    await expect(page.getByText("Odessey", { exact: true })).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("Ready to pull");
    if (process.env.UPDATE_README_SHOTS === "1" && viewport.width === 390)
      await page.screenshot({
        path: "docs/images/odessey-flight.png",
        animations: "disabled",
      });
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page
      .getByRole("button", { name: "Choose mode", exact: true })
      .click();
    await page
      .getByRole("button", { name: "How to play Odessey", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "How to play Odessey" }),
    ).toBeVisible();
  });
}

test("legacy Zen links and browser saves resume under Odessey after refresh", async ({
  page,
}) => {
  const saved = new OrbitEngine(42, 5).getCheckpoint();
  await page.addInitScript((checkpoint) => {
    if (!localStorage.getItem("orbit.zen.progress.v1:42")) {
      localStorage.setItem(
        "orbit.zen.progress.v1:42",
        JSON.stringify(checkpoint),
      );
      localStorage.setItem("orbit.zen.default-seed.v1", "42");
      localStorage.setItem("orbit.walkthrough.zen.v1", "complete");
      localStorage.setItem("orbit.sound-muted.v1", "true");
    }
  }, saved);
  await page.goto("/?mode=zen");
  await expect(page).toHaveURL(/mode=odessey/);
  await expect(page.getByText("Odessey", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Checkpoint 4", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(() => ({
      seed: localStorage.getItem("orbit.odessey.default-seed.v1"),
      tutorial: localStorage.getItem("orbit.walkthrough.odessey.v1"),
      checkpoint: JSON.parse(
        localStorage.getItem("orbit.odessey.progress.v1:42")!,
      ).checkpointCount,
    })),
  ).toEqual({ seed: "42", tutorial: "complete", checkpoint: 4 });
  await page.reload();
  await expect(page.getByLabel("Checkpoint 4", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
