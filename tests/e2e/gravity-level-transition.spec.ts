import { expect, test } from "@playwright/test";
import { fitGravityFrame } from "../../src/gravity/renderer";
import { gravityPullDistance } from "../../src/gravity/input";
import { worldToClient } from "../../src/render/coordinates";
import { markTutorialSeen } from "./tutorial-fixture";

test("footer skip confirms and completed levels advance with a paused three-second border", async ({
  page,
}) => {
  test.setTimeout(90000);
  const viewport = { width: 390, height: 844 };
  await page.setViewportSize(viewport);
  await page.addInitScript(markTutorialSeen);
  await page.addInitScript(() =>
    localStorage.setItem("orbit.sound-muted.v1", "true"),
  );
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto("/?mode=gravity&seed=42");
  await page.clock.runFor(800);
  const footer = page.locator(".gravity-footer");
  const skip = footer.getByRole("button", { name: "Skip level", exact: true });
  expect((await skip.boundingBox())!.y).toBeGreaterThan(viewport.height * 0.8);
  await skip.click();
  const confirmation = page.getByRole("dialog", { name: "Skip this level?" });
  await expect(confirmation).toBeVisible();
  await expect(
    confirmation.getByRole("button", { name: "Keep playing", exact: true }),
  ).toBeFocused();
  await page.clock.runFor(2000);
  await expect(page.locator(".gravity-level")).toHaveText("Level 1");
  await page.screenshot({
    path: "/private/tmp/orbit-gravity-skip-confirm.png",
  });
  await confirmation.press("Escape");
  await expect(confirmation).toHaveCount(0);

  const level = await page.evaluate(async () => {
    const modulePath = "/src/gravity/campaign.ts";
    const { getGravityLevel } = await import(modulePath);
    return getGravityLevel(42, 0);
  });
  const shot = level.witness[0];
  const { area, camera } = fitGravityFrame(
    level,
    viewport.width,
    viewport.height,
    true,
  );
  const origin = worldToClient(
    shot.position ?? level.launch,
    { left: area.x, top: area.y, width: area.width, height: area.height },
    camera,
  );
  const distance =
    Math.sqrt(shot.power) *
    gravityPullDistance("mouse", viewport.width, viewport.height);
  await page.mouse.move(origin.x, origin.y);
  await page.mouse.down();
  await page.mouse.move(
    origin.x - Math.cos(shot.angle) * distance,
    origin.y - Math.sin(shot.angle) * distance,
    { steps: 8 },
  );
  await page.mouse.up();
  const next = footer.getByRole("button", { name: "Next level", exact: true });
  for (let time = 0; time < 60000 && !(await next.count()); time += 100)
    await page.clock.runFor(100);
  await expect(next).toBeVisible();
  await page.clock.runFor(1000);
  const border = page.locator(".gravity-next-progress");
  const start = (await border.getAttribute("d"))!.match(/^M ([\d.]+) 0/);
  expect(start).not.toBeNull();
  expect(Number(start![1])).toBeCloseTo(
    (await next.locator(".gravity-next-border").boundingBox())!.width / 2,
    0,
  );
  const borderBox = (await next.locator(".gravity-next-border").boundingBox())!;
  expect(
    Number(await next.locator(".gravity-next-track").getAttribute("rx")),
  ).toBeCloseTo(borderBox.height / 2, 0);
  const offset = await border.evaluate((element) =>
    Number((element as SVGElement).style.strokeDashoffset),
  );
  expect(offset).toBeGreaterThan(0.5);
  expect(offset).toBeLessThan(0.75);
  await page.screenshot({
    path: "/private/tmp/orbit-gravity-next-progress.png",
  });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.clock.runFor(5000);
  await expect(page.locator(".gravity-level")).toHaveText("Level 1");
  expect(
    await border.evaluate((element) =>
      Number((element as SVGElement).style.strokeDashoffset),
    ),
  ).toBe(offset);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.clock.runFor(2100);
  await expect(page.locator(".gravity-level")).toHaveText("Level 2");
  await page.clock.runFor(5000);
  await expect(page.locator(".gravity-level")).toHaveText("Level 2");
  await footer.getByRole("button", { name: "Skip level", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Skip this level?" })
    .getByRole("button", { name: "Skip level", exact: true })
    .click();
  await expect(page.locator(".gravity-level")).toHaveText("Level 3");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("orbit.gravity.progress.v1:42")!)
          .completedIndices,
    ),
  ).toEqual([0]);
});
