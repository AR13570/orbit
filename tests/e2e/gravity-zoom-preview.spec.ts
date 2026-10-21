import { expect, test } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";
import {
  bodyRadius,
  expectNoZoomControls,
  expectRenderedZoom,
  installZoomProbe,
  wheelZoom,
} from "./zoom-fixture";

for (const device of [
  { width: 1280, height: 800, touch: false },
  { width: 390, height: 844, touch: true },
  { width: 844, height: 390, touch: true },
  { width: 320, height: 568, touch: true },
]) {
  for (const zoom of [75, 50]) {
    test(`Gravity partial preview stays visible at ${zoom}% on ${device.width}x${device.height}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: device,
        hasTouch: device.touch,
        isMobile: device.touch,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      try {
        await page.addInitScript(markTutorialSeen);
        await installZoomProbe(page);
        await page.addInitScript(() => {
          localStorage.setItem("orbit.path-assist.v1", "partial");
          const probe = window as any;
          probe.previewDots = [];
          const arc = CanvasRenderingContext2D.prototype.arc;
          const clear = CanvasRenderingContext2D.prototype.fillRect;
          CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
            if (
              this.canvas.classList.contains("scene-canvas") &&
              x === 0 &&
              y === 0
            )
              probe.previewDots = [];
            return clear.call(this, x, y, w, h);
          };
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
              probe.previewDots.push({
                x: (x * transform.a + transform.e) / devicePixelRatio,
                y: (y * transform.d + transform.f) / devicePixelRatio,
                radius: (r * transform.a) / devicePixelRatio,
                alpha: this.globalAlpha,
              });
            }
            return arc.call(this, x, y, r, start, end, anti);
          };
        });
        await page.clock.install();
        await page.clock.pauseAt(new Date());
        await page.goto("/?mode=gravity&seed=42");
        await page.clock.runFor(200);
        await expectNoZoomControls(page);
        const baseline = await bodyRadius(page);
        await wheelZoom(page, zoom / 100, {
          x: device.width / 2,
          y: device.height / 2,
        });
        await expectRenderedZoom(page, baseline, zoom / 100);
        const start = {
          x: device.touch ? Math.round(device.width * 0.53) : 500,
          y: device.height < 500 ? 240 : Math.round(device.height * 0.64),
        };
        const end = { x: start.x + (device.touch ? 76 : 110), y: start.y + 15 };
        const cdp = device.touch ? await context.newCDPSession(page) : null;
        if (cdp) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ id: 1, ...start }],
          });
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ id: 1, ...end }],
          });
        } else {
          await page.mouse.move(start.x, start.y);
          await page.mouse.down();
          await page.mouse.move(end.x, end.y);
        }
        await page.clock.runFor(800);
        const dots: { x: number; y: number; radius: number; alpha: number }[] =
          await page.evaluate(() => (window as any).previewDots);
        expect(dots.length).toBeGreaterThanOrEqual(12);
        expect(dots.length).toBeLessThanOrEqual(50);
        expect(dots[0].alpha).toBeGreaterThan(0.75);
        expect(dots[0].radius).toBeCloseTo(1.5, 2);
        expect(
          dots.filter(
            (dot) =>
              dot.alpha > 0.1 &&
              dot.x > 0 &&
              dot.x < device.width &&
              dot.y > 0 &&
              dot.y < device.height,
          ).length,
        ).toBeGreaterThanOrEqual(8);
        for (let i = 1; i < dots.length; i++)
          expect(
            Math.hypot(dots[i].x - dots[i - 1].x, dots[i].y - dots[i - 1].y),
          ).toBeLessThanOrEqual(12.01);
        await expect(page.locator(".game-surface [role=status]")).toHaveText(
          "0 planets in motion",
        );
        await page.screenshot({
          path: `/private/tmp/orbit-gravity-preview-${device.width}x${device.height}-${zoom}.png`,
        });
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }
}
