import { expect, test } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";

for (const device of [
  { width: 1280, height: 800, touch: false },
  { width: 390, height: 844, touch: true },
  { width: 844, height: 390, touch: true },
]) {
  test(`Odessey Full path stays visible while continuously aiming on ${device.width}x${device.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: device,
      hasTouch: device.touch,
      isMobile: device.touch,
    });
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(markTutorialSeen);
      await page.addInitScript(() => {
        localStorage.setItem("orbit.path-assist.v1", "full");
        const probe = window as any;
        probe.aimDots = 0;
        const clear = CanvasRenderingContext2D.prototype.fillRect;
        CanvasRenderingContext2D.prototype.fillRect = function (
          x,
          y,
          width,
          height,
        ) {
          if (
            this.canvas.classList.contains("scene-canvas") &&
            x === 0 &&
            y === 0
          )
            probe.aimDots = 0;
          return clear.call(this, x, y, width, height);
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
          const t = this.getTransform();
          const pixelRatio =
            this.canvas.width / this.canvas.getBoundingClientRect().width;
          if (
            this.canvas.classList.contains("scene-canvas") &&
            ["#8a0f4b", "#f09bbf"].includes(String(this.fillStyle)) &&
            Math.abs((radius * Math.hypot(t.a, t.b)) / pixelRatio - 2.1) < 0.01
          )
            probe.aimDots++;
          return arc.call(this, x, y, radius, start, end, anti);
        };
      });
      await page.clock.install();
      await page.clock.pauseAt(new Date());
      await page.goto("/?mode=odessey&seed=42");
      await expect(page.getByLabel("Slingshot flight field")).toBeVisible();
      await page.clock.runFor(1000);
      const aim = await page.evaluate(async () => {
        const { OrbitEngine } = await import("/src/game/engine.ts");
        const engine = new OrbitEngine(42);
        return engine.getSnapshot().sector.solution;
      });
      const start = { x: device.width / 2, y: device.height * 0.6 };
      const rotation = device.width < device.height ? -Math.PI / 2 : 0;
      const reach = device.touch ? 72 : 160;
      const cdp = device.touch ? await context.newCDPSession(page) : null;
      if (cdp)
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ id: 1, ...start }],
        });
      else {
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
      }
      for (let frame = 0; frame < 36; frame++) {
        const angle = aim.angle + rotation + Math.sin(frame / 5) * 0.08;
        const power = aim.power + Math.cos(frame / 7) * 0.02;
        const end = {
          x: start.x - Math.cos(angle) * power * reach,
          y: start.y - Math.sin(angle) * power * reach,
        };
        if (cdp)
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ id: 1, ...end }],
          });
        else await page.mouse.move(end.x, end.y);
        await page.clock.runFor(20);
        expect(
          await page.evaluate(() => (window as any).aimDots),
          `blank path at aim frame ${frame}`,
        ).toBeGreaterThan(0);
      }
      if (!device.touch)
        await page.screenshot({
          path: "/private/tmp/orbit-odessey-continuous-aim.png",
        });
      await page.keyboard.press("Escape");
      if (cdp)
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
      else await page.mouse.up();
      await expect(
        page.getByRole("button", { name: "Resume", exact: true }),
      ).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
