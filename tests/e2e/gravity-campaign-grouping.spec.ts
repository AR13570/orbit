import { expect, test } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";
for (const device of [
  { width: 492, height: 818, touch: false },
  { width: 390, height: 844, touch: true },
]) {
  test(`sequential native launches gather under real Level 12 forces at ${device.width}x${device.height}`, async ({
    browser,
  }) => {
    test.setTimeout(90000);
    const context = await browser.newContext({
      viewport: device,
      hasTouch: device.touch,
      isMobile: device.touch,
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      let moduleUrl = "";
      page.on("response", (response) => {
        if (new URL(response.url()).pathname === "/src/gravity/engine.ts")
          moduleUrl = response.url();
      });
      await page.addInitScript(markTutorialSeen);
      await page.addInitScript(() => {
        localStorage.setItem("orbit.sound-muted.v1", "true");
        localStorage.setItem("orbit.gravity.particle-interaction.v1", "true");
        localStorage.setItem("orbit.gravity.particle-grouping.v1", "true");
        localStorage.setItem("orbit.gravity.projectile-size.v1", "1.4");
        localStorage.setItem(
          "orbit.gravity.progress.v1:42",
          JSON.stringify({
            version: 1,
            seed: 42,
            currentIndex: 11,
            unlockedIndex: 11,
            completedIndices: [],
          }),
        );
      });
      await page.clock.install();
      await page.clock.pauseAt(new Date());
      await page.goto("/?mode=gravity&seed=42");
      await page.clock.runFor(100);
      await expect(page.locator(".gravity-level")).toHaveText("Level 12");
      await page.evaluate(async (url) => {
        const { GravityEngine } = await import(url),
          original = GravityEngine.prototype.getRenderSnapshot;
        GravityEngine.prototype.getRenderSnapshot = function () {
          (window as any).campaignCaptureEngine = this;
          return original.call(this);
        };
      }, moduleUrl);
      await page.clock.runFor(32);
      const cdp = device.touch ? await context.newCDPSession(page) : null;
      const nativeLaunch = async (shot: {
        position: { x: number; y: number };
        velocity?: { x: number; y: number };
        angle?: number;
        power?: number;
      }) => {
        const gesture = await page.evaluate(
          async ({ shot, touch }) => {
            const s = (window as any).campaignCaptureEngine.getSnapshot();
            const { fitGravityFrame } =
              await import("/src/gravity/renderer.ts");
            const { worldToClient } =
              await import("/src/render/coordinates.ts");
            const { gravityPullDistance, gravityPullFraction } =
              await import("/src/gravity/input.ts");
            const { gravityLaunchPower } =
              await import("/src/gravity/physics.ts");
            const { camera, area } = fitGravityFrame(
              s.level,
              innerWidth,
              innerHeight,
            );
            const start = worldToClient(
              shot.position,
              {
                left: area.x,
                top: area.y,
                width: area.width,
                height: area.height,
              },
              camera,
            );
            const angle = shot.velocity
              ? Math.atan2(shot.velocity.y, shot.velocity.x)
              : shot.angle!;
            const power = shot.velocity
              ? gravityLaunchPower(Math.hypot(shot.velocity.x, shot.velocity.y))
              : shot.power!;
            const reach =
              gravityPullDistance(
                touch ? "touch" : "mouse",
                innerWidth,
                innerHeight,
              ) * gravityPullFraction(power);
            return {
              start,
              end: {
                x: start.x - Math.cos(angle) * reach,
                y: start.y - Math.sin(angle) * reach,
              },
            };
          },
          { shot, touch: device.touch },
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
        } else {
          await page.mouse.move(gesture.start.x, gesture.start.y);
          await page.mouse.down();
          await page.mouse.move(gesture.end.x, gesture.end.y);
        }
        await page.clock.runFor(80);
        if (cdp)
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
        else await page.mouse.up();
      };
      const witness = await page.evaluate(() => {
        const w = (window as any).campaignCaptureEngine.getSnapshot().level
          .witness[0];
        return { position: w.position, angle: w.angle, power: w.power };
      });
      await nativeLaunch(witness);
      await page.clock.runFor(250);
      const second = await page.evaluate(() => {
        const s = (window as any).campaignCaptureEngine.getSnapshot(),
          p = s.particles.find((p: any) => p.alive),
          core = s.level.bodies.find((b: any) => b.kind === "attractor");
        const dx = p.position.x - core.position.x,
          dy = p.position.y - core.position.y,
          d = Math.hypot(dx, dy),
          gap = p.radius + s.physics.planetRadius + 50;
        return {
          position: {
            x: p.position.x - (dy / d) * gap,
            y: p.position.y + (dx / d) * gap,
          },
          velocity: p.velocity,
        };
      });
      await nativeLaunch(second);
      const launchGap = await page.evaluate(() => {
        const s = (window as any).campaignCaptureEngine.getSnapshot(),
          [a, b] = s.particles.filter((p: any) => p.alive);
        return (
          Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y) -
          a.radius -
          b.radius
        );
      });
      expect(launchGap).toBeGreaterThan(1);
      await page.clock.runFor(16);
      let touching = 0,
        bestGap = Infinity;
      for (let frame = 0; frame < 180; frame++) {
        await page.clock.runFor(16);
        const pair = await page.evaluate(() => {
          const s = (window as any).campaignCaptureEngine.getSnapshot(),
            p = s.particles.filter((p: any) => p.alive);
          return {
            alive: p.length,
            gap:
              p.length === 2
                ? Math.hypot(
                    p[0].position.x - p[1].position.x,
                    p[0].position.y - p[1].position.y,
                  ) -
                  p[0].radius -
                  p[1].radius
                : null,
          };
        });
        expect(pair.alive).toBe(2);
        expect(pair.gap!).toBeGreaterThanOrEqual(-1e-5);
        bestGap = Math.min(bestGap, pair.gap!);
        if (pair.gap! < 0.02) touching++;
        if (touching === 20)
          await page.screenshot({
            path: `/private/tmp/orbit-level12-native-group-${device.width}.png`,
          });
      }
      console.log("Native Level 12 grouping", {
        device: device.width,
        touching,
        bestGap,
      });
      expect(touching).toBeGreaterThan(20);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
