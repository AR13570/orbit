import { expect, test, type Page } from "@playwright/test";
import { wheelZoom } from "./zoom-fixture";

const readPair = (page: Page) =>
  page.evaluate(() => {
    const state = (window as any).spinEngine.getSnapshot();
    const [a, b] = state.particles;
    const dx = b.position.x - a.position.x,
      dy = b.position.y - a.position.y;
    const vx = b.velocity.x - a.velocity.x,
      vy = b.velocity.y - a.velocity.y;
    const square = dx * dx + dy * dy;
    return {
      elapsed: state.elapsed,
      distance: Math.sqrt(square),
      angle: Math.atan2(dy, dx),
      omega: (dx * vy - dy * vx) / square,
      momentum: {
        x: a.mass * a.velocity.x + b.mass * b.velocity.x,
        y: a.mass * a.velocity.y + b.mass * b.velocity.y,
      },
      center: {
        x: (a.position.x + b.position.x) / 2,
        y: (a.position.y + b.position.y) / 2,
      },
      particles: state.particles.map(
        ({ id, radius, mass, alive, position, velocity }: any) => ({
          id,
          radius,
          mass,
          alive,
          position,
          velocity,
        }),
      ),
    };
  });

for (const device of [
  { width: 1200, height: 800, touch: false, large: false },
  { width: 390, height: 844, touch: true, large: false },
  { width: 844, height: 390, touch: true, large: false },
  { width: 1200, height: 800, touch: false, large: true },
]) {
  test(`${device.large ? "larger planets acquire gentle spin after natural moving capture through native input" : "settled planets acquire gentle spin while fast grazing planets separate through native input"} on ${device.width}x${device.height}`, async ({
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
      await page.addInitScript(() => {
        localStorage.setItem("orbit.sound-muted.v1", "true");
        localStorage.setItem("orbit.gravity.projectile-size.v1", "1");
        localStorage.setItem("orbit.gravity.particle-interaction.v1", "true");
        localStorage.setItem(
          "orbit-creator-draft",
          JSON.stringify({
            version: 1,
            id: "native-gentle-spin",
            name: "Gentle spin",
            launch: { x: 450, y: 450 },
            bodies: [],
            objective: { kind: "none", count: 1, turns: 1, hold: 0 },
            physics: {
              planetRadius: 8,
              planetMass: 1,
              planetGravity: true,
              planetGravityStrength: 96000,
              planetCollisions: "soft",
              bodyCollisions: true,
              trailSeconds: 24,
            },
          }),
        );
        const probe = window as any;
        const translate = CanvasRenderingContext2D.prototype.translate;
        CanvasRenderingContext2D.prototype.translate = function (x, y) {
          translate.call(this, x, y);
          if (this.canvas.classList.contains("scene-canvas")) {
            const matrix = this.getTransform(),
              box = this.canvas.getBoundingClientRect();
            const dpr = this.canvas.width / box.width;
            probe.spinTransform = {
              scale: matrix.a / dpr,
              tx: matrix.e / dpr + box.x,
              ty: matrix.f / dpr + box.y,
            };
          }
        };
        let circle = { x: 0, y: 0, radius: 0 };
        const fillRect = CanvasRenderingContext2D.prototype.fillRect;
        CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
          if (
            this.canvas.classList.contains("scene-canvas") &&
            x === 0 &&
            y === 0
          )
            probe.spinSurfaces = [];
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
            const matrix = this.getTransform(),
              dpr =
                this.canvas.width / this.canvas.getBoundingClientRect().width;
            probe.spinSurfaces.push({
              color: this.fillStyle,
              radius: (circle.radius * matrix.a) / dpr,
              x: (circle.x * matrix.a + matrix.e) / dpr,
              y: (circle.y * matrix.d + matrix.f) / dpr,
            });
          }
          return fill.apply(this, args as []);
        };
      });
      await page.clock.install();
      await page.clock.pauseAt(new Date());
      await page.goto("/?mode=creator&seed=42");
      await page.getByRole("button", { name: "Playtest", exact: true }).click();
      await expect(page.getByLabel("Gravity orbital field")).toBeVisible();
      await page.clock.runFor(32);
      expect(moduleUrl).not.toBe("");
      await page.evaluate(async (url) => {
        const { GravityEngine } = await import(url);
        const view = GravityEngine.prototype.getRenderSnapshot;
        GravityEngine.prototype.getRenderSnapshot = function () {
          (window as any).spinEngine = this;
          return view.call(this);
        };
      }, moduleUrl);
      await page.clock.runFor(32);
      await wheelZoom(page, 2, {
        x: device.width * 0.6,
        y: device.height * 0.6,
      });
      const cdp = device.touch ? await context.newCDPSession(page) : undefined;
      const launch = async (
        position: { x: number; y: number },
        velocity: { x: number; y: number },
      ) => {
        const gesture = await page.evaluate(
          async ({ position, velocity, touch }) => {
            const { gravityPullDistance } =
              await import("/src/gravity/input.ts");
            const { gravityLaunchPower } =
              await import("/src/gravity/physics.ts");
            const t = (window as any).spinTransform,
              speed = Math.hypot(velocity.x, velocity.y);
            const length =
              gravityPullDistance(
                touch ? "touch" : "mouse",
                innerWidth,
                innerHeight,
                2,
              ) * Math.sqrt(gravityLaunchPower(speed));
            return {
              start: {
                x: position.x * t.scale + t.tx,
                y: position.y * t.scale + t.ty,
              },
              end: {
                x: position.x * t.scale + t.tx - (velocity.x / speed) * length,
                y: position.y * t.scale + t.ty - (velocity.y / speed) * length,
              },
            };
          },
          { position, velocity, touch: device.touch },
        );
        if (cdp) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ id: 1, ...gesture.start }],
          });
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ id: 1, ...gesture.end }],
          });
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
        } else {
          await page.mouse.move(gesture.start.x, gesture.start.y);
          await page.mouse.down();
          await page.mouse.move(gesture.end.x, gesture.end.y);
          await page.mouse.up();
        }
      };
      if (device.large) {
        const size = page.getByRole("slider", { name: "Projectile size" });
        await size.focus();
        await page.keyboard.press("End");
        await expect(size).toHaveValue("2");
        await launch({ x: 420, y: 450 }, { x: 5, y: 9 });
        await page.clock.runFor(32);
        const first = await page.evaluate(
          () => (window as any).spinEngine.getSnapshot().particles[0],
        );
        expect(first.radius).toBe(16);
        expect(first.mass).toBe(4);
        await launch(
          { x: first.position.x + 80, y: first.position.y },
          { x: 5, y: 9.192 },
        );
        const initial = await readPair(page);
        expect(initial.distance).toBeCloseTo(80, 3);
        expect(initial.omega).toBeCloseTo(0.0024, 4);
        await page.clock.runFor(16);
        await page.screenshot({
          path: "/private/tmp/orbit-gentle-spin-large-before-1200x800.png",
        });
        let contact = await readPair(page);
        for (let n = 0; n < 160 && contact.distance > 32 + 1e-5; n++) {
          await page.clock.runFor(25);
          contact = await readPair(page);
        }
        expect(contact.distance).toBeCloseTo(32, 5);
        expect(contact.omega).toBeGreaterThan(0.01);
        expect(contact.omega).toBeLessThan(0.02);
        await page.clock.runFor(6000);
        const spinning = await readPair(page);
        expect(
          spinning.particles.map(({ id, radius, mass, alive }: any) => ({
            id,
            radius,
            mass,
            alive,
          })),
        ).toEqual(
          initial.particles.map(({ id, radius, mass, alive }: any) => ({
            id,
            radius,
            mass,
            alive,
          })),
        );
        expect(spinning.particles.every((p: any) => p.alive)).toBe(true);
        expect(spinning.distance).toBeGreaterThanOrEqual(32 - 1e-7);
        expect(spinning.distance).toBeCloseTo(32, 5);
        expect(spinning.omega).toBeGreaterThan(0.049);
        expect(spinning.omega).toBeLessThan(0.051);
        expect(spinning.angle - contact.angle).toBeGreaterThan(0.2);
        expect(spinning.angle - contact.angle).toBeLessThan(0.5);
        expect(spinning.momentum.x).toBeCloseTo(initial.momentum.x, 8);
        expect(spinning.momentum.y).toBeCloseTo(initial.momentum.y, 8);
        expect(spinning.center.x - initial.center.x).toBeCloseTo(
          (initial.momentum.x / 8) * (spinning.elapsed - initial.elapsed),
          6,
        );
        expect(spinning.center.y - initial.center.y).toBeCloseTo(
          (initial.momentum.y / 8) * (spinning.elapsed - initial.elapsed),
          6,
        );
        const surfaces = await page.evaluate(
          () => (window as any).spinSurfaces,
        );
        expect(surfaces).toHaveLength(2);
        expect(
          Math.hypot(
            surfaces[0].x - surfaces[1].x,
            surfaces[0].y - surfaces[1].y,
          ) -
            surfaces[0].radius -
            surfaces[1].radius,
        ).toBeCloseTo(0, 5);
        await page.screenshot({
          path: "/private/tmp/orbit-gentle-spin-large-after-1200x800.png",
        });
        expect(errors).toEqual([]);
        return;
      }
      await launch({ x: 420, y: 450 }, { x: 20, y: 0 });
      await page.clock.runFor(32);
      const first = await page.evaluate(
        () => (window as any).spinEngine.getSnapshot().particles[0],
      );
      expect(first.radius).toBe(8);
      await launch(
        { x: first.position.x + 20, y: first.position.y },
        { x: 20, y: 0 },
      );
      const initial = await readPair(page);
      expect(initial.particles).toHaveLength(2);
      expect(initial.distance).toBeCloseTo(20, 3);
      expect(Math.abs(initial.omega)).toBeLessThan(0.001);
      // Native touch coordinates round slightly; preserve the actual input momentum.
      expect(initial.momentum.x).toBeCloseTo(40, 3);
      expect(initial.momentum.y).toBeCloseTo(0, 5);
      await page.clock.runFor(16);
      const beforeSurfaces = await page.evaluate(
        () => (window as any).spinSurfaces,
      );
      expect(beforeSurfaces).toHaveLength(2);
      expect(
        Math.hypot(
          beforeSurfaces[0].x - beforeSurfaces[1].x,
          beforeSurfaces[0].y - beforeSurfaces[1].y,
        ) -
          beforeSurfaces[0].radius -
          beforeSurfaces[1].radius,
      ).toBeGreaterThan(1);
      await page.screenshot({
        path: `/private/tmp/orbit-gentle-spin-before-${device.width}x${device.height}.png`,
      });
      await page.clock.runFor(250);
      const settled = await readPair(page);
      expect(settled.distance).toBeCloseTo(16, 5);
      expect(Math.abs(settled.omega)).toBeLessThan(0.005);
      await page.clock.runFor(500);
      const ramp = await readPair(page);
      expect(Math.abs(ramp.omega)).toBeGreaterThan(0.003);
      expect(Math.abs(ramp.omega)).toBeLessThan(0.02);
      await page.clock.runFor(5000);
      const spinning = await readPair(page);
      expect(
        spinning.particles.map(({ id, radius, mass, alive }: any) => ({
          id,
          radius,
          mass,
          alive,
        })),
      ).toEqual(
        initial.particles.map(({ id, radius, mass, alive }: any) => ({
          id,
          radius,
          mass,
          alive,
        })),
      );
      expect(spinning.particles.every((p: any) => p.alive)).toBe(true);
      expect(spinning.distance).toBeGreaterThanOrEqual(16 - 1e-7);
      expect(spinning.distance).toBeCloseTo(16, 5);
      expect(Math.abs(spinning.omega)).toBeGreaterThan(0.049);
      expect(Math.abs(spinning.omega)).toBeLessThan(0.051);
      expect(Math.abs(spinning.angle - settled.angle)).toBeGreaterThan(0.14);
      expect(Math.abs(spinning.angle - settled.angle)).toBeLessThan(0.4);
      expect(spinning.momentum.x).toBeCloseTo(initial.momentum.x, 8);
      expect(spinning.momentum.y).toBeCloseTo(initial.momentum.y, 8);
      expect(spinning.center.x - initial.center.x).toBeCloseTo(
        (initial.momentum.x / 2) * (spinning.elapsed - initial.elapsed),
        4,
      );
      expect(spinning.center.y - initial.center.y).toBeCloseTo(
        (initial.momentum.y / 2) * (spinning.elapsed - initial.elapsed),
        8,
      );
      const surfaces = await page.evaluate(() => (window as any).spinSurfaces);
      expect(surfaces).toHaveLength(2);
      expect(
        Math.hypot(
          surfaces[0].x - surfaces[1].x,
          surfaces[0].y - surfaces[1].y,
        ) -
          surfaces[0].radius -
          surfaces[1].radius,
      ).toBeCloseTo(0, 5);
      await page.screenshot({
        path: `/private/tmp/orbit-gentle-spin-after-${device.width}x${device.height}.png`,
      });
      await page.getByRole("button", { name: "Reset level (R)" }).click();
      await launch({ x: 420, y: 450 }, { x: 0, y: 100 });
      await page.clock.runFor(16);
      const fastFirst = await page.evaluate(
        () => (window as any).spinEngine.getSnapshot().particles[0],
      );
      await launch(
        { x: fastFirst.position.x + 16.05, y: fastFirst.position.y },
        { x: 0, y: -100 },
      );
      const grazing = await readPair(page);
      expect(grazing.distance).toBeGreaterThanOrEqual(16 - 1e-5);
      expect(grazing.distance).toBeLessThan(16.1);
      expect(Math.abs(grazing.omega)).toBeGreaterThan(10);
      await page.clock.runFor(750);
      const escaping = await readPair(page);
      expect(escaping.particles.every((p: any) => p.alive)).toBe(true);
      expect(escaping.distance).toBeGreaterThan(100);
      expect(escaping.particles.map((p: any) => p.id)).toEqual(
        grazing.particles.map((p: any) => p.id),
      );
      expect(errors).toEqual([]);
      await page.screenshot({
        path: `/private/tmp/orbit-gentle-spin-escape-${device.width}x${device.height}.png`,
      });
    } finally {
      await context.close();
    }
  });
}
