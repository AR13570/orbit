import { expect, test } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";
import { wheelZoom } from "./zoom-fixture";

for (const device of [
  { width: 1280, height: 800, touch: false },
  { width: 390, height: 844, touch: true },
  { width: 844, height: 390, touch: true },
]) {
  test(`Gravity held shooter survives no-op zoom and native drag routes on ${device.width}x${device.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: device,
      hasTouch: device.touch,
      isMobile: device.touch,
    });
    const page = await context.newPage();
    let engineModule = "";
    page.on("request", (request) => {
      if (request.url().includes("/src/gravity/engine.ts"))
        engineModule = request.url();
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.addInitScript(markTutorialSeen);
      await page.addInitScript(() => {
        localStorage.setItem(
          "orbit.gravity.progress.v1:42",
          JSON.stringify({
            version: 1,
            seed: 42,
            currentIndex: 45,
            unlockedIndex: 45,
            completedIndices: [],
          }),
        );
        const probe = window as any;
        probe.heldShooter = null;
        probe.inputEvents = [];
        probe.wheelCount = 0;
        for (const type of [
          "pointerdown",
          "pointerup",
          "pointercancel",
          "lostpointercapture",
          "wheel",
          "resize",
        ])
          window.addEventListener(type, (event) => {
            if (type === "wheel") probe.wheelCount++;
            const input = event as PointerEvent & WheelEvent;
            probe.inputEvents.push({
              type,
              id: input.pointerId,
              primary: input.isPrimary,
              x: input.clientX,
              y: input.clientY,
              deltaY: input.deltaY,
            });
          });
        let circle = { x: 0, y: 0, radius: 0 };
        const fillRect = CanvasRenderingContext2D.prototype.fillRect;
        CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
          if (
            this.canvas.classList.contains("scene-canvas") &&
            x === 0 &&
            y === 0
          )
            probe.heldShooter = null;
          return fillRect.call(this, x, y, w, h);
        };
        const arc = CanvasRenderingContext2D.prototype.arc;
        CanvasRenderingContext2D.prototype.arc = function (
          x,
          y,
          radius,
          start,
          end,
          anti,
        ) {
          circle = { x, y, radius };
          return arc.call(this, x, y, radius, start, end, anti);
        };
        const fill = CanvasRenderingContext2D.prototype.fill;
        CanvasRenderingContext2D.prototype.fill = function (...args: any[]) {
          if (
            this.canvas.classList.contains("scene-canvas") &&
            (this.fillStyle === "#7a60d6" || this.fillStyle === "#c9675e")
          ) {
            const transform = this.getTransform();
            const dpr =
              this.canvas.width / this.canvas.getBoundingClientRect().width;
            probe.heldShooter = {
              x: (circle.x * transform.a + transform.e) / dpr,
              y: (circle.y * transform.d + transform.f) / dpr,
              radius: (circle.radius * transform.a) / dpr,
              scale: transform.a / dpr,
              alpha: this.globalAlpha,
            };
          }
          return fill.apply(this, args as []);
        };
      });
      await page.clock.install({ time: new Date("2026-10-15T00:00:00Z") });
      await page.clock.pauseAt(new Date("2026-10-15T00:00:01Z"));
      await page.goto("/?mode=gravity&seed=42");
      await page.clock.runFor(200);
      expect(errors).toEqual([]);
      await page.evaluate(async (moduleUrl) => {
        const { GravityEngine } = await import(moduleUrl);
        const probe = window as any;
        probe.launchCount = 0;
        const launch = GravityEngine.prototype.launch;
        GravityEngine.prototype.launch = function () {
          probe.launchCount++;
          probe.heldEngine = this;
          return launch.call(this);
        };
      }, engineModule);
      const cdp = device.touch ? await context.newCDPSession(page) : null;
      const start = { x: device.width * 0.5, y: device.height * 0.6 };
      let id = 1;
      const down = async () => {
        if (cdp)
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ id, ...start }],
          });
        else {
          await page.mouse.move(start.x, start.y);
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
      const wheel = async (dx: number, dy: number) => {
        const before = await page.evaluate(() => (window as any).wheelCount);
        await page.mouse.wheel(dx, dy);
        await expect
          .poll(() => page.evaluate(() => (window as any).wheelCount))
          .toBe(before + 1);
      };
      const expectShooter = async (phase = "held aim") => {
        await page.clock.runFor(32);
        const shooter = await page.evaluate(() => (window as any).heldShooter);
        expect(
          shooter,
          `${phase}: ${JSON.stringify(await page.evaluate(() => (window as any).inputEvents.slice(-8)))}`,
        ).not.toBeNull();
        expect(shooter.x).toBeCloseTo(start.x, 2);
        expect(shooter.y).toBeCloseTo(start.y, 2);
        const radius = await page.evaluate(
          () =>
            (window as any).heldEngine.getRenderSnapshot().physics.planetRadius,
        );
        expect(shooter.radius).toBeCloseTo(radius * shooter.scale, 6);
        expect(shooter.alpha).toBe(1);
      };
      // Keep an actual planet moving while the next shot is held.
      await down();
      await move({ x: start.x - 24, y: start.y });
      await up();
      await expect(page.locator(".game-surface [role=status]")).toHaveText(
        "1 planet in motion",
      );
      // No-op wheel input keeps the real gesture launchable exactly once.
      await down();
      await move({ x: start.x - 24, y: start.y });
      await page.mouse.move(start.x - 24, start.y);
      await wheel(80, 0);
      await expectShooter();
      await up();
      expect(await page.evaluate(() => (window as any).launchCount)).toBe(2);
      await expect(page.locator(".game-surface [role=status]")).toHaveText(
        "2 planets in motion",
      );
      for (const zoom of [1, 0.5, 4]) {
        await page.getByLabel("Gravity orbital field").focus();
        await page.keyboard.press("0");
        // Overshoot to reach the exact clamp, independent of wheel float precision.
        if (zoom !== 1) await wheelZoom(page, zoom === 4 ? 5 : 0.2, start);
        await down();
        for (const point of [
          start,
          { x: start.x + 2, y: start.y },
          { x: start.x + 50, y: start.y },
          { x: device.width * 0.55, y: device.height * 0.4 },
          { x: device.width - 32, y: 30 },
          { x: -30, y: -30 },
          start,
        ]) {
          await move(point);
          await expectShooter(`zoom ${zoom}, point ${point.x},${point.y}`);
        }
        await page.mouse.move(start.x, start.y);
        await wheel(80, 0);
        await expectShooter();
        if (zoom !== 1) {
          await wheel(0, zoom === 4 ? -80 : 80);
          await expectShooter(`clamped wheel at zoom ${zoom}`);
        }
        // A real zoom still cancels the held shot and its preview.
        await wheel(0, zoom === 4 ? 80 : -80);
        await page.clock.runFor(32);
        expect(
          await page.evaluate(() => (window as any).heldShooter),
        ).toBeNull();
        await move({ x: start.x - 24, y: start.y });
        await up();
        await page.clock.runFor(32);
        expect(
          await page.evaluate(() => (window as any).heldShooter),
        ).toBeNull();
        expect(await page.evaluate(() => (window as any).launchCount)).toBe(2);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
