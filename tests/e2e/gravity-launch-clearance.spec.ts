import { expect, test } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";

for (const guided of [true, false]) {
  for (const device of [
    { width: 1200, height: 800, touch: false },
    { width: 390, height: 844, touch: true },
    { width: 844, height: 390, touch: true },
  ]) {
    test(`Gravity ${guided ? "practice" : "game"} explains obstructed launches on ${device.width}x${device.height}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: device,
        hasTouch: device.touch,
        isMobile: device.touch,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      let engineModule = "";
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (request.url().includes("/src/gravity/engine.ts"))
          engineModule = request.url();
      });
      try {
        if (!guided) await page.addInitScript(markTutorialSeen);
        await page.addInitScript(
          ({ guided }) => {
            const probe = window as any;
            probe.clearance = {
              core: null,
              marker: null,
              label: false,
              previewDots: 0,
            };
            const selector = guided ? "gravity-guide-field" : "scene-canvas";
            const arc = CanvasRenderingContext2D.prototype.arc;
            const fill = CanvasRenderingContext2D.prototype.fill;
            const fillRect = CanvasRenderingContext2D.prototype.fillRect;
            const fillText = CanvasRenderingContext2D.prototype.fillText;
            let circle = { x: 0, y: 0, radius: 0 };
            CanvasRenderingContext2D.prototype.fillRect = function (
              x,
              y,
              width,
              height,
            ) {
              if (
                this.canvas.classList.contains(selector) &&
                x === 0 &&
                y === 0
              ) {
                probe.clearance.marker = null;
                probe.clearance.label = false;
                probe.clearance.previewDots = 0;
              }
              return fillRect.call(this, x, y, width, height);
            };
            CanvasRenderingContext2D.prototype.arc = function (
              x,
              y,
              radius,
              start,
              end,
              anti,
            ) {
              if (this.canvas.classList.contains(selector)) {
                circle = { x, y, radius };
                if (radius === (guided ? 32 : 24)) {
                  const transform = this.getTransform();
                  const rect = this.canvas.getBoundingClientRect();
                  const dpr = this.canvas.width / rect.width;
                  probe.clearance.core = {
                    x: rect.left + (x * transform.a + transform.e) / dpr,
                    y: rect.top + (y * transform.d + transform.f) / dpr,
                  };
                }
              }
              return arc.call(this, x, y, radius, start, end, anti);
            };
            CanvasRenderingContext2D.prototype.fill = function (
              ...args: any[]
            ) {
              if (this.canvas.classList.contains(selector)) {
                if (this.fillStyle === "#c9675e")
                  probe.clearance.marker = {
                    ...circle,
                    alpha: this.globalAlpha,
                  };
                if (this.fillStyle === "#7956cf") probe.clearance.previewDots++;
              }
              return fill.apply(this, args as []);
            };
            CanvasRenderingContext2D.prototype.fillText = function (
              text,
              x,
              y,
              maxWidth,
            ) {
              if (
                this.canvas.classList.contains(selector) &&
                text === "Start in clear space"
              )
                probe.clearance.label = true;
              return maxWidth === undefined
                ? fillText.call(this, text, x, y)
                : fillText.call(this, text, x, y, maxWidth);
            };
          },
          { guided },
        );
        await page.clock.install();
        await page.clock.pauseAt(new Date());
        await page.goto("/?mode=gravity&seed=42");
        await page.clock.runFor(1000);
        await page.evaluate(async (moduleUrl) => {
          const { GravityEngine } = await import(moduleUrl);
          const probe = window as any;
          const setLaunch = GravityEngine.prototype.setLaunch;
          GravityEngine.prototype.setLaunch = function (...args) {
            probe.clearanceEngine = this;
            return setLaunch.apply(this, args);
          };
        }, engineModule);
        const field = page.getByLabel(
          guided ? "Gravity practice field" : "Gravity orbital field",
        );
        const cdp = device.touch ? await context.newCDPSession(page) : null;
        let id = 1;
        const down = async (point: { x: number; y: number }) => {
          if (cdp)
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchStart",
              touchPoints: [{ id, ...point }],
            });
          else {
            await page.mouse.move(point.x, point.y);
            await page.mouse.down();
          }
        };
        const move = async (point: { x: number; y: number }) => {
          if (cdp)
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: [{ id, ...point }],
            });
          else await page.mouse.move(point.x, point.y);
        };
        const up = async () => {
          if (cdp)
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchEnd",
              touchPoints: [],
            });
          else await page.mouse.up();
          id++;
        };
        const core = await page.evaluate(() => (window as any).clearance.core);
        expect(core).not.toBeNull();
        await down(core);
        await move({ x: core.x - 45, y: core.y });
        await page.clock.runFor(32);
        const held = await page.evaluate(() => (window as any).clearance);
        expect(held.marker?.alpha).toBe(1);
        expect(held.label).toBe(true);
        expect(held.previewDots).toBe(0);
        await page.screenshot({
          path: `/private/tmp/orbit-blocked-launch-${guided ? "guide" : "game"}-${device.width}x${device.height}.png`,
        });
        await up();
        const status = guided
          ? page.locator(".gravity-guide [role=status]")
          : page.locator(".game-surface [role=status]");
        await expect(status).toHaveText("Start in clear space");
        expect(
          await page.evaluate(
            () =>
              (window as any).clearanceEngine.getSnapshot().particles.length,
          ),
        ).toBe(0);
        if (guided)
          await expect(
            page.getByRole("heading", { name: "Make your first planet" }),
          ).toBeVisible();
        await page.clock.runFor(2500);
        await expect(
          page.getByText("Start in clear space", { exact: true }),
        ).toHaveCount(0);
        const rect = (await field.boundingBox())!;
        const clear = {
          x: rect.x + rect.width * 0.7,
          y: rect.y + rect.height * 0.8,
        };
        await down(clear);
        await move({ x: clear.x - 45, y: clear.y });
        await up();
        expect(
          await page.evaluate(
            () =>
              (window as any).clearanceEngine.getSnapshot().particles.length,
          ),
        ).toBe(1);
        if (guided)
          await expect(
            page.getByRole("heading", { name: "Add another while it moves" }),
          ).toBeVisible();
        else await expect(status).toHaveText("1 planet in motion");
        await expect(field).toBeVisible();
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }
}
