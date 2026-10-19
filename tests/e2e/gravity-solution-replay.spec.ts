import { expect, test } from "@playwright/test";

test("the campaign review page replays sequential launches without changing saved progress", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem(
      "orbit.gravity.progress.v1:42",
      JSON.stringify({
        version: 1,
        seed: 42,
        currentIndex: 1,
        unlockedIndex: 1,
        completedIndices: [],
      }),
    );
  });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto("/docs/verification/campaign-replay.html");
  await expect(
    page.getByRole("combobox", { name: "Level", exact: true }),
  ).toHaveCount(1);
  await expect(page.locator("option")).toHaveCount(45);
  await page
    .getByRole("combobox", { name: "Level", exact: true })
    .selectOption("44");
  await page.clock.runFor(7000);
  expect(await page.locator("body").getAttribute("data-alive")).toBe("2");
  await page.clock.runFor(33000);
  await expect(page.locator("body")).toHaveAttribute("data-complete", "true");
  await expect(page.locator("body")).toHaveAttribute("data-alive", "3");
  const progress = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("orbit.gravity.progress.v1:42")!),
  );
  expect(progress.currentIndex).toBe(1);
  expect(progress.completedIndices).toEqual([]);
  await page.screenshot({ path: "/private/tmp/orbit-final-shared-replay.png" });
});
