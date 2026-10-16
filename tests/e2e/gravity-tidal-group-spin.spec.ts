import { expect, test } from "@playwright/test";
import { wheelZoom } from "./zoom-fixture";

for (const fixture of [
  {
    name: "equal planets at orbit300",
    width: 1200,
    height: 800,
    touch: false,
    radius: 6,
    orbit: 300,
    heading: 0,
    secondSize: 1,
    launch: { x: 890, y: 450 },
  },
  {
    name: "unequal planets at orbit140",
    width: 390,
    height: 844,
    touch: true,
    radius: 4,
    orbit: 140,
    heading: Math.PI / 8,
    secondSize: 2,
    launch: { x: 450, y: 650 },
  },
]) {
  test(`native real-core tides do not stall ${fixture.name}`, async ({
    browser,
  }) => {
    test.setTimeout(120000);
    const context = await browser.newContext({
      viewport: { width: fixture.width, height: fixture.height },
      hasTouch: fixture.touch,
      isMobile: fixture.touch,
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
      await page.addInitScript(
        ({ radius, launch }) => {
          localStorage.setItem("orbit.sound-muted.v1", "true");
          localStorage.setItem("orbit.gravity.projectile-size.v1", "1");
          localStorage.setItem("orbit.gravity.particle-interaction.v1", "true");
          localStorage.setItem(
            "orbit-creator-draft",
            JSON.stringify({
              version: 1,
              id: "native-core-tides",
              name: "Core tides",
              launch,
              bodies: [
                {
                  id: "core",
                  kind: "attractor",
                  position: { x: 450, y: 450 },
                  radius: 24,
                  strength: 2800000,
                },
              ],
              objective: { kind: "none", count: 1, turns: 1, hold: 0 },
              physics: {
                planetRadius: radius,
                planetMass: 1,
                planetGravity: true,
                planetGravityStrength: 96000,
                planetCollisions: "soft",
                bodyCollisions: true,
                trailSeconds: 24,
              },
            }),
          );
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
              this.fillStyle === "#245f78"
            ) {
              const matrix = this.getTransform(),
                box = this.canvas.getBoundingClientRect(),
                dpr = this.canvas.width / box.width;
              (window as any).tidalTransform = {
                scale: matrix.a / dpr,
                tx: matrix.e / dpr + box.x,
                ty: matrix.f / dpr + box.y,
              };
            }
            return arc.call(this, x, y, r, start, end, anti);
          };
        },
        { radius: fixture.radius, launch: fixture.launch },
      );
      await page.clock.install();
      await page.clock.pauseAt(new Date());
      await page.goto("/?mode=creator&seed=42");
      const play = page.getByRole("button", { name: "Playtest", exact: true });
      await expect(play).toBeEnabled({ timeout: 5000 });
      await play.click();
      await expect(page.getByLabel("Gravity orbital field")).toBeVisible();
      await page.clock.runFor(32);
      await page.evaluate(async (url) => {
        const { GravityEngine } = await import(url),
          view = GravityEngine.prototype.getRenderSnapshot;
        GravityEngine.prototype.getRenderSnapshot = function () {
          (window as any).tidalEngine = this;
          return view.call(this);
        };
      }, moduleUrl);
      await page.clock.runFor(32);
      await wheelZoom(page, 0.5, {
        x: fixture.width * 0.6,
        y: fixture.height * 0.55,
      });
      const cdp = fixture.touch ? await context.newCDPSession(page) : undefined;
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
            const t = (window as any).tidalTransform,
              speed = Math.hypot(velocity.x, velocity.y);
            const length =
              gravityPullDistance(
                touch ? "touch" : "mouse",
                innerWidth,
                innerHeight,
                0.5,
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
          { position, velocity, touch: fixture.touch },
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
      const speed = Math.sqrt(
        (2800000 * fixture.orbit) / (fixture.orbit ** 2 + 1600),
      );
      await launch({ x: 450 + fixture.orbit, y: 450 }, { x: 0, y: speed });
      await page.clock.runFor(250);
      const first = await page.evaluate(
        () => (window as any).tidalEngine.getSnapshot().particles[0],
      );
      expect(first.radius).toBe(fixture.radius);
      const size = page.getByRole("slider", { name: "Projectile size" });
      if (fixture.secondSize === 2) {
        await size.focus();
        await page.keyboard.press("End");
        await expect(size).toHaveValue("2");
      }
      const separation = fixture.radius * (1 + fixture.secondSize) + 20;
      const angle =
        Math.atan2(first.position.y - 450, first.position.x - 450) +
        fixture.heading;
      await launch(
        {
          x: first.position.x + separation * Math.cos(angle),
          y: first.position.y + separation * Math.sin(angle),
        },
        { ...first.velocity },
      );
      await page.clock.runFor(16);
      const initial = await page.evaluate(() =>
        (window as any).tidalEngine.getSnapshot(),
      );
      const identities = initial.particles.map(
        ({ id, radius, mass, color, alive }: any) => ({
          id,
          radius,
          mass,
          color,
          alive,
        }),
      );
      expect(
        identities.map(({ radius, mass, alive }: any) => ({
          radius,
          mass,
          alive,
        })),
      ).toEqual([
        { radius: fixture.radius, mass: 1, alive: true },
        {
          radius: fixture.radius * fixture.secondSize,
          mass: fixture.secondSize ** 2,
          alive: true,
        },
      ]);
      await page.screenshot({
        path: `/private/tmp/orbit-tidal-spin-${fixture.orbit}-before.png`,
      });
      // Observe every normal render update without changing its physics calls. No app state is changed.
      await page.evaluate(() => {
        const probe = window as any,
          engine = probe.tidalEngine,
          update = engine.update.bind(engine);
        probe.tidalSamples = [];
        engine.update = function (dt: number) {
          update(dt);
          const s = engine.getRenderSnapshot(),
            [a, b] = s.particles;
          if (!a || !b || !a.alive || !b.alive) {
            probe.tidalSamples.push({ dead: true, time: s.elapsed });
            return;
          }
          const dx = b.position.x - a.position.x,
            dy = b.position.y - a.position.y,
            d = Math.hypot(dx, dy),
            mass = a.mass + b.mass;
          probe.tidalSamples.push({
            time: s.elapsed,
            angle: Math.atan2(dy, dx),
            omega:
              (dx * (b.velocity.y - a.velocity.y) -
                dy * (b.velocity.x - a.velocity.x)) /
              (d * d),
            gap: d - a.radius - b.radius,
            cx: (a.mass * a.position.x + b.mass * b.position.x) / mass,
            cy: (a.mass * a.position.y + b.mass * b.position.y) / mass,
            px: a.mass * a.velocity.x + b.mass * b.velocity.x,
            py: a.mass * a.velocity.y + b.mass * b.velocity.y,
          });
        };
      });
      // 100 wall seconds at the normal 1.2 playback rate is 120 physical seconds.
      await page.clock.runFor(100000);
      const result = await page.evaluate(() => ({
        state: (window as any).tidalEngine.getSnapshot(),
        samples: (window as any).tidalSamples,
      }));
      expect(result.samples.some((s: any) => s.dead)).toBe(false);
      expect(
        result.state.particles.map(
          ({ id, radius, mass, color, alive }: any) => ({
            id,
            radius,
            mass,
            color,
            alive,
          }),
        ),
      ).toEqual(identities);
      expect(result.state.level.bodies).toEqual(initial.level.bodies);
      const samples = result.samples as any[];
      const minima: Record<number, number> = {
        1: Infinity,
        3: Infinity,
        5: Infinity,
      };
      let previous = samples[0].angle,
        orientation = 0,
        previousOrbit = Math.atan2(samples[0].cy - 450, samples[0].cx - 450),
        orbitProgress = 0;
      let low = 0,
        longestLow = 0,
        minOmega = Infinity,
        maxMomentumChange = 0;
      let contactWindow: { time: number; angle: number }[] = [];
      for (let i = 0; i < samples.length; i++) {
        const m = samples[i];
        expect(m.gap).toBeGreaterThanOrEqual(-1e-6);
        orientation += Math.atan2(
          Math.sin(m.angle - previous),
          Math.cos(m.angle - previous),
        );
        previous = m.angle;
        const orbital = Math.atan2(m.cy - 450, m.cx - 450);
        orbitProgress += Math.atan2(
          Math.sin(orbital - previousOrbit),
          Math.cos(orbital - previousOrbit),
        );
        previousOrbit = orbital;
        maxMomentumChange = Math.max(
          maxMomentumChange,
          Math.hypot(m.px - samples[0].px, m.py - samples[0].py),
        );
        if (m.time - initial.elapsed < 5) continue;
        if (m.gap > 0.001) {
          contactWindow = [];
          low = 0;
          continue;
        }
        minOmega = Math.min(minOmega, Math.abs(m.omega));
        low =
          Math.abs(m.omega) < 0.01
            ? low + (i ? m.time - samples[i - 1].time : 0)
            : 0;
        longestLow = Math.max(longestLow, low);
        contactWindow.push({ time: m.time, angle: orientation });
        while (contactWindow.length > 1 && m.time - contactWindow[1].time >= 5)
          contactWindow.shift();
        for (const seconds of [1, 3, 5]) {
          const cutoff = m.time - seconds;
          const start = contactWindow.findLastIndex((v) => v.time <= cutoff);
          if (start < 0) continue;
          const window = contactWindow.slice(start);
          minima[seconds] = Math.min(
            minima[seconds],
            Math.max(...window.map((v) => v.angle)) -
              Math.min(...window.map((v) => v.angle)),
          );
        }
      }
      expect(samples.at(-1).time - initial.elapsed).toBeGreaterThan(119);
      expect(longestLow).toBeLessThan(0.1);
      for (const seconds of [1, 3, 5])
        expect(Number.isFinite(minima[seconds])).toBe(true);
      expect(minima[1]).toBeGreaterThan(0.02);
      expect(minima[3]).toBeGreaterThan(0.1);
      expect(minima[5]).toBeGreaterThan(0.15);
      expect(Math.abs(orbitProgress)).toBeGreaterThan(2 * Math.PI);
      expect(maxMomentumChange).toBeGreaterThan(20);
      console.info(
        JSON.stringify({
          fixture: fixture.name,
          minOmega,
          longestLow,
          minimumOrientationRanges: minima,
          orbitProgress,
        }),
      );
      await page.screenshot({
        path: `/private/tmp/orbit-tidal-spin-${fixture.orbit}-after.png`,
      });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
