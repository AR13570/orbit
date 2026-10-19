import { expect, test, type Page } from "@playwright/test";

// Observe rendering and engine snapshots only. Every launch below is a real
// pointer gesture; the core and all previous planets stay in the live world.
async function snapshot(page: Page) {
  return page.evaluate(() => (window as any).captureEngine.getSnapshot());
}
const distance = (state: any) => {
  const [a, b] = state.particles;
  return Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
};
for (const device of [
  { width: 1200, height: 800, touch: false },
  { width: 390, height: 844, touch: true },
  { width: 844, height: 390, touch: true },
]) {
  test(`minimum size planets attract around Level 1 through real input on ${device.width}x${device.height}`, async ({
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
        localStorage.setItem("orbit.walkthrough.gravity.v2", "complete");
        localStorage.setItem("orbit.gravity.projectile-size.v1", "1");
        localStorage.setItem("orbit.gravity.particle-interaction.v1", "true");
        localStorage.setItem("orbit.sound-muted.v1", "true");
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
            ["#303943", "#dedde5"].includes(String(this.fillStyle))
          ) {
            const matrix = this.getTransform(),
              box = this.canvas.getBoundingClientRect();
            const dpr = this.canvas.width / box.width;
            (window as any).coreTransform = {
              x,
              y,
              scale: matrix.a / dpr,
              tx: matrix.e / dpr + box.x,
              ty: matrix.f / dpr + box.y,
            };
          }
          return arc.call(this, x, y, r, start, end, anti);
        };
      });
      await page.clock.install();
      await page.clock.pauseAt(new Date());
      await page.goto("/?mode=gravity&seed=42");
      await expect(page.getByLabel("Gravity orbital field")).toBeVisible();
      await page.clock.runFor(32);
      await page.evaluate(async (url) => {
        const { GravityEngine } = await import(url);
        const launch = GravityEngine.prototype.launchFrom;
        GravityEngine.prototype.launchFrom = function (...args: any[]) {
          (window as any).captureEngine = this;
          return launch.apply(this, args);
        };
      }, moduleUrl);
      const cdp = device.touch ? await context.newCDPSession(page) : undefined;
      const launch = async (
        position: { x: number; y: number },
        velocity: { x: number; y: number },
      ) => {
        const gesture = await page.evaluate(
          async ({ position, velocity, touch }) => {
            const { gravityPullDistance, gravityPullFraction } =
              await import("/src/gravity/input.ts");
            const { gravityLaunchPower } =
              await import("/src/gravity/physics.ts");
            const t = (window as any).coreTransform;
            const speed = Math.hypot(velocity.x, velocity.y);
            const length =
              gravityPullDistance(
                touch ? "touch" : "mouse",
                innerWidth,
                innerHeight,
              ) * gravityPullFraction(gravityLaunchPower(speed));
            const start = {
              x: position.x * t.scale + t.tx,
              y: position.y * t.scale + t.ty,
            };
            return {
              start,
              end: {
                x: start.x - (velocity.x / speed) * length,
                y: start.y - (velocity.y / speed) * length,
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
      const beginPair = async (flyby = false) => {
        const corePosition = await page.evaluate(() => {
          const { x, y } = (window as any).coreTransform;
          return { x, y };
        });
        const speed = Math.sqrt((2_800_000 * 100) / (100 ** 2 + 40 ** 2));
        await launch(
          { x: corePosition.x + 100, y: corePosition.y },
          { x: 0, y: speed },
        );
        await page.clock.runFor(250);
        const first = (await snapshot(page)).particles[0];
        const angle =
          Math.atan2(
            first.position.y - corePosition.y,
            first.position.x - corePosition.x,
          ) + (flyby ? 0 : 2 * Math.asin((5 * first.radius) / 200));
        const radius = flyby ? 130 : 100;
        const secondSpeed = flyby ? -300 : speed;
        await launch(
          {
            x: corePosition.x + radius * Math.cos(angle),
            y: corePosition.y + radius * Math.sin(angle),
          },
          {
            x: -secondSpeed * Math.sin(angle),
            y: secondSpeed * Math.cos(angle),
          },
        );
        return snapshot(page);
      };
      const initial = await beginPair();
      expect(initial.level.bodies).toHaveLength(1);
      expect(initial.level.bodies[0].strength).toBe(2_800_000);
      expect(initial.physics.planetGravityStrength).toBe(96000);
      expect(
        initial.particles.map((p: any) => [p.mass, p.radius, p.alive]),
      ).toEqual([
        [1, initial.physics.planetRadius, true],
        [1, initial.physics.planetRadius, true],
      ]);
      const physicalRadius = initial.physics.planetRadius;
      const targetRadius =
        device.width === 1200
          ? 4
          : device.width === 390
            ? 4.024844720496895
            : 4.0754716981132075;
      expect(physicalRadius).toBeCloseTo(targetRadius, 8);
      const ids = initial.particles.map((p: any) => p.id);
      await page.clock.runFor(32);
      await page.screenshot({
        path: `/private/tmp/orbit-real-core-before-${device.width}x${device.height}.png`,
      });
      expect(distance(initial)).toBeCloseTo(5 * physicalRadius, 1);
      await page.clock.runFor(125);
      expect(distance(await snapshot(page))).toBeLessThan(4.9 * physicalRadius);
      expect(distance(await snapshot(page))).toBeGreaterThanOrEqual(
        2 * physicalRadius - 1e-6,
      );
      // The first grazing encounter can slide apart before gravity brings it back.
      await page.clock.runFor(1000);
      expect(distance(await snapshot(page))).toBeLessThan(
        2 * physicalRadius + 0.1,
      );
      for (let i = 0; i < 10; i++) {
        await page.clock.runFor(500);
        const state = await snapshot(page);
        expect(state.particles.map((p: any) => p.id)).toEqual(ids);
        expect(state.particles.every((p: any) => p.alive)).toBe(true);
        expect(distance(state)).toBeGreaterThanOrEqual(
          2 * physicalRadius - 1e-6,
        );
        expect(distance(state)).toBeLessThan(2 * physicalRadius + 0.1);
      }
      const final = await snapshot(page);
      expect(
        final.particles.every(
          (p: any) =>
            Math.abs(p.orbits[initial.level.bodies[0].id].winding) >
            Math.PI * 2,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `/private/tmp/orbit-real-core-capture-${device.width}x${device.height}.png`,
      });
      await page.getByRole("button", { name: "Reset level (R)" }).click();
      await beginPair(true);
      await page.clock.runFor(250);
      const flyby = await snapshot(page);
      expect(flyby.particles.every((p: any) => p.alive)).toBe(true);
      expect(distance(flyby)).toBeGreaterThan(100);
      await page.getByRole("button", { name: "Reset level (R)" }).click();
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page.getByRole("button", { name: "Advanced", exact: true }).click();
      await page.getByRole("switch", { name: "Particle Interaction" }).click();
      await expect(
        page.getByRole("switch", { name: "Particle Interaction" }),
      ).toHaveAttribute("aria-checked", "false");
      await page.getByRole("button", { name: "Resume", exact: true }).click();
      await beginPair();
      await page.clock.runFor(3000);
      const independent = await snapshot(page);
      expect(independent.physics.planetGravity).toBe(false);
      expect(independent.particles.every((p: any) => p.alive)).toBe(true);
      expect(distance(independent)).toBeGreaterThan(5 * physicalRadius - 0.1);
      expect(distance(independent)).toBeLessThan(5 * physicalRadius + 0.1);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
