import { expect, test } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";
import { resetZoom, wheelZoom } from "./zoom-fixture";

for (const device of [
  { width: 1200, height: 800, touch: false },
  { width: 390, height: 844, touch: true },
  { width: 844, height: 390, touch: true },
]) {
  for (const levelIndex of [0, 30]) {
    test(`Gravity level ${levelIndex + 1} physical surfaces stay tangent through native zoom and aim on ${device.width}x${device.height}`, async ({
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
        await page.addInitScript(markTutorialSeen);
        await page.addInitScript((index) => {
          localStorage.setItem(
            "orbit.gravity.progress.v1:42",
            JSON.stringify({
              version: 1,
              seed: 42,
              currentIndex: index,
              unlockedIndex: index,
              completedIndices: [],
            }),
          );
          localStorage.setItem("orbit.gravity.projectile-size.v1", "1");
        }, levelIndex);
        await page.addInitScript(() => {
          const probe = window as any;
          probe.surfaceCircles = [];
          let circle = { x: 0, y: 0, radius: 0 };
          const fillRect = CanvasRenderingContext2D.prototype.fillRect;
          CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
            if (
              this.canvas.classList.contains("scene-canvas") &&
              x === 0 &&
              y === 0
            )
              probe.surfaceCircles = [];
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
            if (
              this.canvas.classList.contains("scene-canvas") &&
              ["#303943", "#dedde5"].includes(String(this.fillStyle))
            ) {
              const matrix = this.getTransform();
              const dpr =
                this.canvas.width / this.canvas.getBoundingClientRect().width;
              probe.fieldTransform = {
                scale: matrix.a / dpr,
                tx: matrix.e / dpr,
                ty: matrix.f / dpr,
              };
            }
            return arc.call(this, x, y, radius, start, end, anti);
          };
          const fill = CanvasRenderingContext2D.prototype.fill;
          CanvasRenderingContext2D.prototype.fill = function (...args: any[]) {
            if (
              this.canvas.classList.contains("scene-canvas") &&
              ["#cf315c", "#007c9e", "#7a60d6", "#c9675e"].includes(
                String(this.fillStyle),
              )
            ) {
              const matrix = this.getTransform();
              const dpr =
                this.canvas.width / this.canvas.getBoundingClientRect().width;
              probe.surfaceCircles.push({
                color: this.fillStyle,
                worldRadius: circle.radius,
                radius: (circle.radius * matrix.a) / dpr,
                x: (circle.x * matrix.a + matrix.e) / dpr,
                y: (circle.y * matrix.d + matrix.f) / dpr,
                scale: matrix.a / dpr,
                alpha: this.globalAlpha,
              });
            }
            return fill.apply(this, args as []);
          };
        });
        await page.clock.install();
        await page.clock.pauseAt(new Date());
        await page.goto("/?mode=gravity&seed=42");
        await page.clock.runFor(100);
        expect(moduleUrl).not.toBe("");
        await page.evaluate(async (url) => {
          const { GravityEngine } = await import(url);
          const view = GravityEngine.prototype.getRenderSnapshot;
          GravityEngine.prototype.getRenderSnapshot = function () {
            (window as any).surfaceEngine = this;
            return view.call(this);
          };
          const launch = GravityEngine.prototype.launchFrom;
          GravityEngine.prototype.launchFrom = function (...args: any[]) {
            (window as any).surfaceEngine = this;
            return launch.apply(this, args);
          };
        }, moduleUrl);
        const cdp = device.touch ? await context.newCDPSession(page) : null;
        await page.clock.runFor(32);
        const clearStart = () =>
          page.evaluate(() => {
            const state = (window as any).surfaceEngine.getSnapshot();
            const t = (window as any).fieldTransform;
            const candidates = [
              [0.6, 0.7],
              [0.5, 0.65],
              [0.7, 0.55],
              [0.45, 0.5],
              [0.6, 0.45],
              [0.8, 0.7],
              [0.3, 0.6],
            ];
            for (const [fx, fy] of candidates) {
              const point = { x: innerWidth * fx, y: innerHeight * fy };
              const world = {
                x: (point.x - t.tx) / t.scale,
                y: (point.y - t.ty) / t.scale,
              };
              if (
                state.level.bodies.every(
                  (body: any) =>
                    Math.hypot(
                      world.x - body.position.x,
                      world.y - body.position.y,
                    ) >
                    body.radius + 5 * state.physics.planetRadius + 5,
                )
              )
                return point;
            }
            throw new Error("No clear native launch fixture origin");
          });
        let start = await clearStart();
        const down = async () => {
          if (cdp)
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchStart",
              touchPoints: [{ id: 7, ...start }],
            });
          else {
            await page.mouse.move(start.x, start.y);
            await page.mouse.down();
          }
        };
        const move = async () => {
          if (cdp)
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: [{ id: 7, x: start.x - 30, y: start.y }],
            });
          else await page.mouse.move(start.x - 30, start.y);
        };
        const up = async () => {
          if (cdp)
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchEnd",
              touchPoints: [],
            });
          else await page.mouse.up();
        };
        await down();
        await move();
        await up();
        expect(
          await page.evaluate(
            () => (window as any).surfaceEngine.getSnapshot().particles.length,
          ),
        ).toBe(1);
        const initial = await page.evaluate(() =>
          (window as any).surfaceEngine.getSnapshot(),
        );
        const expectedRadius =
          levelIndex === 0
            ? device.width === 1200
              ? 4
              : device.width === 390
                ? 4.024844720496895
                : 4.0754716981132075
            : device.width === 1200
              ? 9.663934426229508
              : device.width === 390
                ? 16
                : 14.830188679245284;
        expect(initial.physics.planetRadius).toBeCloseTo(expectedRadius, 8);
        expect(initial.particles[0].radius).toBeCloseTo(expectedRadius, 8);
        expect(initial.particles[0].mass).toBe(1);
        await page.evaluate(() => {
          const engine = (window as any).surfaceEngine;
          (window as any).surfaceAnchor = {
            ...engine.getSnapshot().particles[0].position,
          };
          engine.retry();
          engine.setPaused(true);
          engine.setProjectileSize(2);
          engine.launchFrom((window as any).surfaceAnchor, { x: 0, y: 0 });
          engine.setProjectileSize(1);
          engine.launchFrom(
            {
              ...(window as any).surfaceAnchor,
              x:
                (window as any).surfaceAnchor.x +
                3 * engine.getSnapshot().physics.planetRadius,
            },
            { x: 0, y: 0 },
          );
        });
        await page.clock.runFor(32);
        const baseline = await page.evaluate(
          () => (window as any).surfaceCircles[0].scale,
        );
        for (const zoom of [0.5, 1, 2]) {
          await resetZoom(page, "Gravity orbital field");
          if (cdp && zoom !== 1) {
            const a = { id: 1, x: 120, y: device.height * 0.45 };
            const b = { id: 2, x: 160, y: a.y };
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchStart",
              touchPoints: [a],
            });
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchStart",
              touchPoints: [a, b],
            });
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: [a, { ...b, x: a.x + 40 * zoom }],
            });
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchEnd",
              touchPoints: [],
            });
          } else if (zoom !== 1) await wheelZoom(page, zoom, start);
          await page.clock.runFor(32);
          const surfaces = await page.evaluate(
            () => (window as any).surfaceCircles,
          );
          const large = surfaces.find((item: any) => item.color === "#cf315c");
          const small = surfaces.find((item: any) => item.color === "#007c9e");
          expect(large.worldRadius).toBeCloseTo(2 * expectedRadius, 8);
          expect(small.worldRadius).toBeCloseTo(expectedRadius, 8);
          expect(large.scale).toBeCloseTo(baseline * zoom, 6);
          // Browser canvas matrices round to float precision before screen projection.
          expect(large.radius).toBeCloseTo(
            2 * expectedRadius * baseline * zoom,
            5,
          );
          expect(small.radius).toBeCloseTo(expectedRadius * baseline * zoom, 5);
          expect(
            Math.hypot(large.x - small.x, large.y - small.y) -
              large.radius -
              small.radius,
          ).toBeCloseTo(0, 6);
          expect(large.alpha).toBe(1);
          expect(small.alpha).toBe(1);
          await page.screenshot({
            path: `/private/tmp/orbit-physical-surfaces-level${levelIndex + 1}-${device.width}x${device.height}-zoom-${zoom}.png`,
          });
          await down();
          await move();
          await page.clock.runFor(32);
          const aim = await page.evaluate(() =>
            (window as any).surfaceCircles.find(
              (item: any) =>
                item.color === "#7a60d6" || item.color === "#c9675e",
            ),
          );
          expect(aim.worldRadius).toBeCloseTo(expectedRadius, 8);
          expect(aim.radius).toBeCloseTo(small.radius, 6);
          await up();
          // Remove only the native gesture's newly launched planet between snapshots.
          await page.evaluate(() => {
            const engine = (window as any).surfaceEngine;
            engine.retry();
            engine.setProjectileSize(2);
            engine.launchFrom((window as any).surfaceAnchor, { x: 0, y: 0 });
            engine.setProjectileSize(1);
            engine.launchFrom(
              {
                ...(window as any).surfaceAnchor,
                x:
                  (window as any).surfaceAnchor.x +
                  3 * engine.getSnapshot().physics.planetRadius,
              },
              { x: 0, y: 0 },
            );
          });
        }
        const flyingBeforeResize = await page.evaluate(() =>
          (window as any).surfaceEngine
            .getSnapshot()
            .particles.map(({ radius, mass }: any) => ({ radius, mass })),
        );
        await page.setViewportSize({
          width: device.height,
          height: device.width,
        });
        await page.clock.runFor(64);
        const resized = await page.evaluate(() => {
          const state = (window as any).surfaceEngine.getSnapshot();
          return {
            radius: state.physics.planetRadius,
            scale: (window as any).fieldTransform.scale,
            particles: state.particles.map(({ radius, mass }: any) => ({
              radius,
              mass,
            })),
          };
        });
        expect(resized.particles).toEqual(flyingBeforeResize);
        expect(resized.radius).toBeCloseTo(
          Math.max(4, Math.min(16, 6 / (resized.scale / 4))),
          5,
        );
        await resetZoom(page, "Gravity orbital field");
        expect(
          await page.evaluate(
            () =>
              (window as any).surfaceEngine.getSnapshot().physics.planetRadius,
          ),
        ).toBeCloseTo(resized.radius, 8);
        start = await clearStart();
        await down();
        await move();
        await up();
        const afterResize = await page.evaluate(() =>
          (window as any).surfaceEngine.getSnapshot().particles.at(-1),
        );
        expect(afterResize.radius).toBeCloseTo(resized.radius, 8);
        expect(afterResize.mass).toBe(1);
        // Navigation must prepare the new launch profile before another frame or input.
        await page.getByRole("button", { name: "Pause", exact: true }).click();
        await page
          .getByRole("button", { name: "Choose a level", exact: true })
          .click();
        const nextIndex = levelIndex === 0 ? 30 : 0;
        await page
          .getByRole("button", {
            name:
              nextIndex === 30
                ? "Level 31: Three separate skies"
                : "Level 1: First orbit",
            exact: true,
          })
          .click();
        const navigated = await page.evaluate(async () => {
          const state = (window as any).surfaceEngine.getSnapshot();
          const { fitGravityFrame } = await import("/src/gravity/renderer.ts");
          const scale = fitGravityFrame(state.level, innerWidth, innerHeight)
            .camera.scale;
          return {
            index: state.level.index,
            radius: state.physics.planetRadius,
            scale,
          };
        });
        expect(navigated.index).toBe(nextIndex);
        expect(navigated.radius).toBeCloseTo(
          Math.max(4, Math.min(16, 6 / navigated.scale)),
          8,
        );
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }
}
