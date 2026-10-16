import { expect, test } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";
import { resetZoom, wheelZoom } from "./zoom-fixture";

for (const initialMode of ["zen", "gravity"] as const) {
  test(`Sound off and on survive reload and mode changes starting in ${initialMode}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(markTutorialSeen);
    await page.addInitScript(() => {
      const native = window.AudioContext;
      const probe = window as any;
      probe.audioContexts = 0;
      if (native)
        window.AudioContext = class extends native {
          constructor(options?: AudioContextOptions) {
            super(options);
            probe.audioContexts++;
          }
        };
    });
    await page.goto(`/?mode=${initialMode}&seed=42`);
    const pause = () =>
      page.getByRole("button", { name: "Pause", exact: true }).click();
    await pause();
    await expect(
      page.getByRole("button", { name: "Sound on", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Sound on", exact: true }).click();
    expect(
      await page.evaluate(() => localStorage.getItem("orbit.sound-muted.v1")),
    ).toBe("true");
    await page.reload();
    await pause();
    await expect(
      page.getByRole("button", { name: "Sound off", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(await page.evaluate(() => (window as any).audioContexts)).toBe(0);
    await page
      .getByRole("button", { name: "Choose mode", exact: true })
      .click();
    const other = initialMode === "zen" ? "gravity" : "zen";
    await page
      .getByRole("button", {
        name: other === "gravity" ? /^Gravity\s*Build/ : /^Zen\s*Follow/,
      })
      .click();
    await pause();
    await expect(
      page.getByRole("button", { name: "Sound off", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(await page.evaluate(() => (window as any).audioContexts)).toBe(0);
    await page.getByRole("button", { name: "Sound off", exact: true }).click();
    expect(
      await page.evaluate(() => localStorage.getItem("orbit.sound-muted.v1")),
    ).toBe("false");
    await page.reload();
    await pause();
    await expect(
      page.getByRole("button", { name: "Sound on", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("button", { name: "Choose mode", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: initialMode === "gravity" ? /^Gravity\s*Build/ : /^Zen\s*Follow/,
      })
      .click();
    await pause();
    await expect(
      page.getByRole("button", { name: "Sound on", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(errors).toEqual([]);
  });
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`Gravity outer boundary survives zoom and synchronizes before physics on ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let moduleUrl = "";
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/src/gravity/engine.ts")
        moduleUrl = request.url();
    });
    await page.addInitScript(markTutorialSeen);
    await page.addInitScript(() =>
      localStorage.setItem("orbit.sound-muted.v1", "true"),
    );
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.goto("/?mode=gravity&seed=42");
    await page.clock.runFor(100);
    expect(moduleUrl).not.toBe("");
    await page.evaluate(async (url) => {
      const { GravityEngine } = await import(url);
      const original = GravityEngine.prototype.setFlightBounds;
      GravityEngine.prototype.setFlightBounds = function (...args: any[]) {
        (window as any).boundsEngine = this;
        return original.apply(this, args);
      };
      const update = GravityEngine.prototype.update;
      (window as any).boundsBeforePhysics = [];
      GravityEngine.prototype.update = function (...args: any[]) {
        const state = this.getSnapshot();
        (window as any).boundsBeforePhysics.push({
          index: state.level.index,
          bounds: state.flightBounds,
        });
        return update.apply(this, args);
      };
    }, moduleUrl);
    await page.clock.runFor(32);
    const initialBounds = await page.evaluate(
      () => (window as any).boundsEngine.getSnapshot().flightBounds,
    );
    expect(initialBounds.width).toBeGreaterThan(0);
    await wheelZoom(page, 4, { x: viewport.width / 2, y: viewport.height / 2 });
    expect(
      await page.evaluate(
        () => (window as any).boundsEngine.getSnapshot().flightBounds,
      ),
    ).toEqual(initialBounds);
    await page.evaluate(() => {
      const engine = (window as any).boundsEngine;
      engine.retry();
      const state = engine.getSnapshot(),
        b = state.flightBounds,
        r = state.physics.planetRadius;
      const x = b.x + b.width,
        y = b.y + b.height / 2;
      // The first is invisible in the current close view but inside the outer view.
      engine.launchFrom({ x: x - 40, y }, { x: 0, y: 0 });
      // The second remains visible by a sliver of its physical disc.
      engine.launchFrom({ x: x + r - 0.1, y }, { x: -1, y: 0 });
      // Even a gravitationally bound inward-moving disc is gone beyond the outer edge.
      engine.launchFrom({ x: x + r + 1, y }, { x: -1, y: 0 });
    });
    await page.clock.runFor(32);
    expect(
      await page.evaluate(() =>
        (window as any).boundsEngine
          .getSnapshot()
          .particles.map((p: any) => p.alive),
      ),
    ).toEqual([true, true, false]);
    await resetZoom(page, "Gravity orbital field");
    expect(
      await page.evaluate(
        () =>
          (window as any).boundsEngine
            .getSnapshot()
            .particles.filter((p: any) => p.alive).length,
      ),
    ).toBe(2);
    await page.setViewportSize({
      width: viewport.height,
      height: viewport.width,
    });
    // ResizeObserver may run after a clock-driven frame; observe a new physical update.
    await expect
      .poll(async () => {
        await page.clock.runFor(32);
        return page.evaluate(() => {
          const live = (window as any).boundsEngine.getSnapshot().flightBounds;
          const stepped = (window as any).boundsBeforePhysics.at(-1).bounds;
          return JSON.stringify(stepped) === JSON.stringify(live);
        });
      })
      .toBe(true);
    const resized = await page.evaluate(() => ({
      live: (window as any).boundsEngine.getSnapshot().flightBounds,
      stepped: (window as any).boundsBeforePhysics.at(-1).bounds,
    }));
    expect(resized.live).not.toEqual(initialBounds);
    expect(resized.stepped).toEqual(resized.live);
    await page.evaluate(() => {
      const e = (window as any).boundsEngine;
      e.retry();
      // A multi-core layout has a different fit than the first two single-core fields.
      e.goTo(14);
    });
    await page.clock.runFor(32);
    const navigated = await page.evaluate(() => ({
      live: (window as any).boundsEngine.getSnapshot(),
      stepped: (window as any).boundsBeforePhysics.at(-1),
    }));
    expect(navigated.live.level.index).toBe(14);
    expect(navigated.stepped.index).toBe(14);
    expect(navigated.stepped.bounds).toEqual(navigated.live.flightBounds);
    expect(navigated.live.flightBounds).not.toEqual(resized.live);
    expect(errors).toEqual([]);
  });
}
