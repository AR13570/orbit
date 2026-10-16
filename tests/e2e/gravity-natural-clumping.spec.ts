import { expect, test } from "@playwright/test";
import { wheelZoom } from "./zoom-fixture";

for (const device of [
  { width: 1200, height: 800, touch: false },
  { width: 390, height: 844, touch: true },
  { width: 844, height: 390, touch: true },
]) {
  test(`Gravity captures, supports, slides and releases separate planets on ${device.width}x${device.height}`, async ({
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
    let moduleUrl = "";
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/src/gravity/engine.ts")
        moduleUrl = request.url();
    });
    try {
      await page.addInitScript(() =>
        localStorage.setItem("orbit.walkthrough.gravity.v2", "complete"),
      );
      await page.addInitScript(() => {
        const probe = window as any;
        probe.clumpSurfaces = [];
        let circle = { x: 0, y: 0, radius: 0 };
        const fillRect = CanvasRenderingContext2D.prototype.fillRect;
        CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
          if (
            this.canvas.classList.contains("scene-canvas") &&
            x === 0 &&
            y === 0
          )
            probe.clumpSurfaces = [];
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
            ["#cf315c", "#007c9e"].includes(String(this.fillStyle))
          ) {
            const matrix = this.getTransform();
            const dpr =
              this.canvas.width / this.canvas.getBoundingClientRect().width;
            probe.clumpSurfaces.push({
              color: this.fillStyle,
              worldRadius: circle.radius,
              radius: (circle.radius * matrix.a) / dpr,
              x: (circle.x * matrix.a + matrix.e) / dpr,
              y: (circle.y * matrix.d + matrix.f) / dpr,
              scale: matrix.a / dpr,
            });
          }
          return fill.apply(this, args as []);
        };
      });
      await page.clock.install();
      await page.clock.pauseAt(new Date());
      await page.goto("/?mode=creator&seed=42");
      await page.getByRole("button", { name: "Attractor 1 on field" }).click();
      await page.getByRole("button", { name: "Delete body" }).click();
      await page.getByRole("button", { name: "Sandbox settings" }).click();
      await expect(
        page.getByRole("combobox", { name: "Planet collisions" }),
      ).toHaveValue("soft");
      await page.getByRole("button", { name: "Done", exact: true }).click();
      await page.getByRole("button", { name: "Playtest" }).click();
      const field = page.getByLabel("Gravity orbital field");
      await expect(field).toBeVisible();
      expect(moduleUrl).not.toBe("");
      await page.evaluate(async (url) => {
        const { GravityEngine } = await import(url);
        const launch = GravityEngine.prototype.launchFrom;
        GravityEngine.prototype.launchFrom = function (...args: any[]) {
          (window as any).clumpEngine = this;
          return launch.apply(this, args);
        };
      }, moduleUrl);
      const box = (await field.boundingBox())!;
      const start = {
        x: box.x + box.width * 0.65,
        y: box.y + box.height * 0.6,
      };
      if (device.touch) {
        const cdp = await context.newCDPSession(page);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ id: 1, ...start }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ id: 1, x: start.x - 40, y: start.y }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
      } else {
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(start.x - 40, start.y);
        await page.mouse.up();
      }
      expect(
        await page.evaluate(
          () => (window as any).clumpEngine.getSnapshot().particles.length,
        ),
      ).toBe(1);
      await wheelZoom(page, 4, start);
      const result = await page.evaluate(() => {
        const engine = (window as any).clumpEngine;
        engine.retry();
        engine.setTimeScale(1);
        for (const [size, x] of [
          [2, 420],
          [1, 480],
        ]) {
          engine.setProjectileSize(size);
          engine.launchFrom({ x, y: 450 }, { x: 5, y: 9 });
        }
        const identities = () =>
          engine
            .getSnapshot()
            .particles.map(({ id, radius, mass, color, alive }: any) => ({
              id,
              radius,
              mass,
              color,
              alive,
            }));
        const before = identities();
        const distance = () => {
          const [a, b] = engine.getSnapshot().particles;
          return Math.hypot(
            a.position.x - b.position.x,
            a.position.y - b.position.y,
          );
        };
        let encountered = false,
          maxSeparationAfterContact = 0,
          earlyDistance = 0;
        for (let n = 0; n < 1440; n++) {
          engine.update(1 / 120);
          const span = distance();
          if (n === 29) earlyDistance = span;
          if (span < 24.01) encountered = true;
          if (encountered) {
            maxSeparationAfterContact = Math.max(
              maxSeparationAfterContact,
              span,
            );
          }
        }
        engine.setPaused(true);
        const particles = engine.getSnapshot().particles;
        return {
          before,
          after: identities(),
          earlyDistance,
          encountered,
          maxSeparationAfterContact,
          finalDistance: distance(),
          momentum: {
            x: particles.reduce(
              (sum: number, p: any) => sum + p.mass * p.velocity.x,
              0,
            ),
            y: particles.reduce(
              (sum: number, p: any) => sum + p.mass * p.velocity.y,
              0,
            ),
          },
          policy: engine.getSnapshot().physics.planetCollisions,
        };
      });
      expect(result.policy).toBe("soft");
      expect(result.earlyDistance).toBeGreaterThan(50);
      expect(result.encountered).toBe(true);
      expect(result.maxSeparationAfterContact).toBeCloseTo(24, 7);
      expect(result.finalDistance).toBeCloseTo(24, 7);
      expect(result.after).toEqual(result.before);
      expect(result.momentum.x).toBeCloseTo(25, 8);
      expect(result.momentum.y).toBeCloseTo(45, 8);
      await page.clock.runFor(32);
      await page.screenshot({
        path: `/private/tmp/orbit-natural-capture-${device.width}x${device.height}.png`,
      });
      const rest = await page.evaluate(() => {
        const engine = (window as any).clumpEngine;
        engine.retry();
        engine.setPaused(false);
        engine.setProjectileSize(2);
        engine.launchFrom({ x: 420, y: 450 }, { x: 5, y: 9 });
        engine.setProjectileSize(1);
        engine.launchFrom({ x: 444, y: 450 }, { x: 3, y: 9 });
        for (let n = 0; n < 480; n++) engine.update(1 / 120);
        engine.setPaused(true);
        const [a, b] = engine.getSnapshot().particles;
        return {
          distance: Math.hypot(
            a.position.x - b.position.x,
            a.position.y - b.position.y,
          ),
          relativeSpeed: Math.hypot(
            a.velocity.x - b.velocity.x,
            a.velocity.y - b.velocity.y,
          ),
          center: {
            x: (4 * a.position.x + b.position.x) / 5,
            y: (4 * a.position.y + b.position.y) / 5,
          },
          velocities: [a.velocity, b.velocity],
        };
      });
      expect(rest.distance).toBeCloseTo(24, 7);
      expect(rest.relativeSpeed).toBeLessThan(1e-7);
      expect(rest.center.x).toBeCloseTo(443.2, 7);
      expect(rest.center.y).toBeCloseTo(486, 7);
      for (const velocity of rest.velocities) {
        expect(velocity.x).toBeCloseTo(4.6, 7);
        expect(velocity.y).toBeCloseTo(9, 7);
      }
      await page.clock.runFor(32);
      const surfaces = await page.evaluate(() => (window as any).clumpSurfaces);
      const large = surfaces.find((item: any) => item.color === "#cf315c");
      const small = surfaces.find((item: any) => item.color === "#007c9e");
      expect(large.worldRadius).toBe(16);
      expect(small.worldRadius).toBe(8);
      expect(
        Math.hypot(large.x - small.x, large.y - small.y) -
          large.radius -
          small.radius,
      ).toBeCloseTo(0, 6);
      await page.screenshot({
        path: `/private/tmp/orbit-natural-rest-${device.width}x${device.height}.png`,
      });
      const slide = await page.evaluate(() => {
        const engine = (window as any).clumpEngine;
        engine.retry();
        engine.setPaused(false);
        engine.setProjectileSize(2);
        engine.launchFrom({ x: 420, y: 450 }, { x: 5, y: 3 });
        engine.setProjectileSize(1);
        engine.launchFrom({ x: 444, y: 450 }, { x: 5, y: 33 });
        for (let n = 0; n < 30; n++) engine.update(1 / 120);
        engine.setPaused(true);
        const [a, b] = engine.getSnapshot().particles;
        const dx = b.position.x - a.position.x,
          dy = b.position.y - a.position.y;
        const vx = b.velocity.x - a.velocity.x,
          vy = b.velocity.y - a.velocity.y;
        return {
          distance: Math.hypot(dx, dy),
          angle: Math.atan2(dy, dx),
          relativeAngularMomentum: 0.8 * (dx * vy - dy * vx),
          live: [a.alive, b.alive],
        };
      });
      expect(slide.distance).toBeCloseTo(24, 7);
      expect(slide.angle).toBeGreaterThan(0.25);
      expect(slide.relativeAngularMomentum).toBeCloseTo(576, 7);
      expect(slide.live).toEqual([true, true]);
      await page.clock.runFor(32);
      await page.screenshot({
        path: `/private/tmp/orbit-natural-slide-${device.width}x${device.height}.png`,
      });
      const escape = await page.evaluate(() => {
        const engine = (window as any).clumpEngine;
        engine.retry();
        engine.setPaused(false);
        engine.setProjectileSize(2);
        engine.launchFrom({ x: 420, y: 450 }, { x: 0, y: 0 });
        engine.setProjectileSize(1);
        engine.launchFrom({ x: 444, y: 450 }, { x: -200, y: 200 });
        let closest = Infinity;
        for (let n = 0; n < 120; n++) {
          engine.update(1 / 120);
          const p = engine.getSnapshot().particles;
          closest = Math.min(
            closest,
            Math.hypot(
              p[0].position.x - p[1].position.x,
              p[0].position.y - p[1].position.y,
            ),
          );
        }
        const p = engine.getSnapshot().particles;
        return {
          closest,
          distance: Math.hypot(
            p[0].position.x - p[1].position.x,
            p[0].position.y - p[1].position.y,
          ),
          live: p.filter((item: any) => item.alive).length,
        };
      });
      expect(escape.closest).toBeGreaterThanOrEqual(24 - 1e-7);
      expect(escape.closest).toBeLessThan(25);
      expect(escape.distance).toBeGreaterThan(100);
      expect(escape.live).toBe(2);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
