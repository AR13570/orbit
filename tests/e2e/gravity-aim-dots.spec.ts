import { expect, test } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";
import { wheelZoom } from "./zoom-fixture";

test("aim dots stay fine and readable across zoom levels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(markTutorialSeen);
  await page.addInitScript(() => {
    const probe = window as any;
    const arc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function (
      x,
      y,
      r,
      start,
      end,
      anti,
    ) {
      if (
        this.canvas.classList.contains("scene-canvas") &&
        ["#7956cf", "#bd9cf2"].includes(String(this.fillStyle))
      ) {
        const transform = this.getTransform();
        probe.aimDotRadius =
          (r * Math.hypot(transform.a, transform.b)) / devicePixelRatio;
      }
      return arc.call(this, x, y, r, start, end, anti);
    };
    localStorage.setItem("orbit.sound-muted.v1", "true");
  });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto("/?mode=gravity&seed=42");
  await expect(page.getByLabel("Gravity orbital field")).toBeVisible();
  await page.clock.runFor(100);
  for (const zoom of [1, 0.5, 2]) {
    if (zoom !== 1) {
      await page.getByLabel("Gravity orbital field").focus();
      await page.keyboard.press("0");
      await page.clock.runFor(350);
      await wheelZoom(page, zoom, { x: 195, y: 400 });
    }
    await page.mouse.move(285, 300);
    await page.mouse.down();
    await page.mouse.move(285, 355, { steps: 5 });
    await page.clock.runFor(160);
    expect(await page.evaluate(() => (window as any).aimDotRadius)).toBeCloseTo(
      1.5,
      3,
    );
    if (zoom === 1)
      await page.screenshot({ path: "/private/tmp/orbit-fine-aim-dots.png" });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    // Escape cancels the held shot; close pause if the keyboard also opens it.
    const resume = page.getByRole("button", { name: "Resume", exact: true });
    if (await resume.isVisible()) await resume.click();
  }
});
