import { expect, test } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";
import { bodyRadius, installZoomProbe } from "./zoom-fixture";

test("Space-drag and middle-button drag pan Gravity without launching and reset smoothly", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(markTutorialSeen);
  await installZoomProbe(page);
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto("/?mode=gravity&seed=42");
  const field = page.getByLabel("Gravity orbital field");
  await expect(field).toBeVisible();
  await bodyRadius(page);
  const center = () =>
    page.evaluate(
      () =>
        (
          window as typeof window & {
            renderedBodyCenter: { x: number; y: number };
          }
        ).renderedBodyCenter,
    );
  const baseline = await center();
  await field.focus();
  await page.keyboard.down("Space");
  await expect(field).toHaveCSS("cursor", "grab");
  await page.mouse.move(80, 300);
  await page.mouse.down();
  await page.mouse.move(170, 360, { steps: 6 });
  await page.clock.runFor(32);
  await expect(field).toHaveCSS("cursor", "grabbing");
  await page.mouse.up();
  await page.keyboard.up("Space");
  const panned = await center();
  expect(panned.x - baseline.x).toBeCloseTo(90, 2);
  expect(panned.y - baseline.y).toBeCloseTo(60, 2);
  await expect(
    page.getByText("0 planets in motion", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.clock.runFor(350);
  expect((await center()).x).toBeCloseTo(baseline.x, 2);
  expect((await center()).y).toBeCloseTo(baseline.y, 2);
  await page.mouse.move(80, 300);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(120, 330, { steps: 4 });
  await page.mouse.up({ button: "middle" });
  await page.clock.runFor(32);
  expect((await center()).x - baseline.x).toBeCloseTo(40, 2);
  await expect(
    page.getByText("0 planets in motion", { exact: true }),
  ).toBeVisible();
});
