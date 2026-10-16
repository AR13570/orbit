import { expect, test } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 504, height: 893 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`Odessey pans without launching and offers five-second offscreen recovery on ${viewport.width}x${viewport.height}`, async ({
    browser,
  }) => {
    const touch = viewport.width < 500 || viewport.height < 500;
    const context = await browser.newContext({
      viewport,
      hasTouch: touch,
      isMobile: touch,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let moduleUrl = "";
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/src/game/engine.ts")
        moduleUrl = request.url();
    });
    try {
      await page.addInitScript(markTutorialSeen);
      await page.addInitScript(() =>
        localStorage.setItem("orbit.sound-muted.v1", "true"),
      );
      await page.clock.install();
      await page.clock.pauseAt(new Date());
      await page.goto("/?mode=odessey&seed=42");
      await page.clock.runFor(100);
      await page.evaluate(async (url) => {
        const { OrbitEngine } = await import(url),
          original = OrbitEngine.prototype.setFlightBounds;
        OrbitEngine.prototype.setFlightBounds = function (view: any) {
          (window as any).odesseyView = { engine: this, view };
          return original.call(this, view);
        };
      }, moduleUrl);
      await page.clock.runFor(32);
      const before = await page.evaluate(() => (window as any).odesseyView.view);
      const field = page.getByLabel("Slingshot flight field");
      const cdp = touch ? await context.newCDPSession(page) : undefined;
      if (cdp) {
        const a = { id: 1, x: 140, y: viewport.height * 0.55 },
          b = { id: 2, x: 220, y: a.y };
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
          touchPoints: [
            { ...a, x: a.x + 40, y: a.y + 20 },
            { ...b, x: b.x + 40, y: b.y + 20 },
          ],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
      } else {
        await field.focus();
        await page.keyboard.down("Space");
        await page.mouse.move(viewport.width * 0.6, viewport.height * 0.6);
        await page.mouse.down();
        await page.mouse.move(
          viewport.width * 0.6 + 40,
          viewport.height * 0.6 + 20,
          { steps: 4 },
        );
        await page.mouse.up();
        await page.keyboard.up("Space");
      }
      await page.clock.runFor(100);
      const panned = await page.evaluate(() => ({
        view: (window as any).odesseyView.view,
        state: (window as any).odesseyView.engine.getSnapshot(),
        scroll: [scrollX, scrollY],
      }));
      expect(panned.state.status).toBe("aiming");
      expect(panned.state.particles).toEqual([]);
      expect(panned.view.width).toBeCloseTo(before.width, 5);
      if (viewport.width < viewport.height)
        expect(panned.view.x).toBeGreaterThan(before.x);
      else expect(panned.view.x).toBeLessThan(before.x);
      expect(panned.view.y).toBeLessThan(before.y);
      expect(panned.scroll).toEqual([0, 0]);
      await field.focus();
      for (let n = 0; n < 10; n++) await page.keyboard.press("+");
      await page.clock.runFor(50);
      expect(
        (await page.evaluate(() => (window as any).odesseyView.view.width)) /
          before.width,
      ).toBeCloseTo(1 / 1.2, 5);
      await page.keyboard.press("0");
      await page
        .getByRole("button", { name: "Reset level (R)", exact: true })
        .click();
      await page.clock.runFor(800);
      expect(await page.evaluate(() => (window as any).odesseyView.view)).toEqual(
        before,
      );
      const launch = async () => {
        const start = { x: viewport.width * 0.55, y: viewport.height * 0.55 };
        const reach = touch
          ? 72
          : Math.min(160, Math.max(72, viewport.width * 0.18 - 18));
        const end = { x: start.x + reach, y: start.y };
        if (cdp) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ id: 1, ...start }],
          });
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ id: 1, ...end }],
          });
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
        } else {
          await page.mouse.move(start.x, start.y);
          await page.mouse.down();
          await page.mouse.move(end.x, end.y);
          await page.mouse.up();
        }
        await page.evaluate(() => {
          const { engine, view } = (window as any).odesseyView;
          const particle = engine.state.particles[0];
          // A distant ship survives until its actual visible-screen deadline.
          particle.position = {
            x: view.x - 10000,
            y: view.y + view.height / 2,
          };
          particle.velocity = { x: -1, y: 0 };
        });
      };
      await launch();
      await page.clock.runFor(100);
      await expect(
        page.getByRole("button", { name: "Restart shot" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Restart shot" }),
      ).toHaveText("Restart");
      const remaining = await page.evaluate(
        () =>
          (window as any).odesseyView.engine.getSnapshot().particles[0]
            .offscreenRemaining,
      );
      expect(remaining).toBeGreaterThan(4.8);
      await page.screenshot({
        path: `/private/tmp/orbit-odessey-restart-${viewport.width}x${viewport.height}.png`,
        animations: "disabled",
      });
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page.clock.runFor(6000);
      expect(
        await page.evaluate(
          () =>
            (window as any).odesseyView.engine.getSnapshot().particles[0]
              .offscreenRemaining,
        ),
      ).toBe(remaining);
      await page.getByRole("button", { name: "Resume", exact: true }).click();
      await page.getByRole("button", { name: "Restart shot" }).click();
      await page.clock.runFor(100);
      await expect(page.getByRole("status")).toHaveText("Ready to pull");
      await expect(
        page.getByRole("button", { name: "Restart shot" }),
      ).toHaveCount(0);
      await launch();
      await page.clock.runFor(5100);
      expect(
        await page.evaluate(
          () => (window as any).odesseyView.engine.getSnapshot().status,
        ),
      ).toBe("failed");
      await expect(
        page.getByRole("button", { name: "Restart shot" }),
      ).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
