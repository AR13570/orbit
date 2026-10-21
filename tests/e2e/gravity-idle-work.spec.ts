import { expect, test } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`frozen Gravity stops canvas and snapshot work but refreshes changes at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(markTutorialSeen);
    await page.addInitScript(() => {
      localStorage.setItem("orbit.sound-muted.v1", "true");
      const probe = window as any;
      probe.paints = 0;
      probe.snapshots = 0;
      const fill = CanvasRenderingContext2D.prototype.fillRect;
      CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
        if (
          this.canvas.classList.contains("scene-canvas") &&
          x === 0 &&
          y === 0
        )
          probe.paints++;
        return fill.call(this, x, y, w, h);
      };
    });
    let engineUrl = "";
    page.on("response", (r) => {
      if (new URL(r.url()).pathname === "/src/gravity/engine.ts")
        engineUrl = r.url();
    });
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.goto("/?mode=gravity&seed=42");
    await page.clock.runFor(100);
    await page.evaluate(async (url) => {
      const { GravityEngine } = await import(url);
      const original = GravityEngine.prototype.getRenderSnapshot;
      GravityEngine.prototype.getRenderSnapshot = function (...args) {
        (window as any).snapshots++;
        return original.apply(this, args);
      };
    }, engineUrl);
    const reset = () =>
      page.evaluate(() => {
        (window as any).paints = 0;
        (window as any).snapshots = 0;
      });
    const counts = () =>
      page.evaluate(() => ({
        paints: (window as any).paints,
        snapshots: (window as any).snapshots,
      }));
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.clock.runFor(100);
    await reset();
    await page.clock.runFor(2000);
    expect(await counts()).toEqual({ paints: 0, snapshots: 0 });
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await page.clock.runFor(100);
    expect((await counts()).paints).toBe(1);
    const background = () =>
      page
        .locator("canvas.scene-canvas")
        .evaluate((c: HTMLCanvasElement) =>
          Array.from(c.getContext("2d")!.getImageData(0, 0, 1, 1).data),
        );
    expect(await background()).toEqual([233, 236, 239, 255]);
    await reset();
    await page.evaluate(() => {
      localStorage.setItem("orbit.theme.v1", "dark");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "orbit.theme.v1",
          newValue: "dark",
        }),
      );
    });
    await page.clock.runFor(100);
    expect((await counts()).paints).toBe(1);
    expect(await background()).toEqual([0, 0, 0, 255]);
    await reset();
    await page.setViewportSize({
      width: viewport.width + 20,
      height: viewport.height,
    });
    // Viewport resize / ResizeObserver delivery uses a real browser frame even
    // while application animation frames are controlled by the virtual clock.
    await expect
      .poll(async () => {
        await page.clock.runFor(100);
        return (await counts()).paints;
      })
      .toBeGreaterThanOrEqual(1);
    await reset();
    await page.clock.runFor(1000);
    expect(await counts()).toEqual({ paints: 0, snapshots: 0 });
    await page.getByRole("button", { name: "Advanced", exact: true }).click();
    await page
      .getByRole("switch", { name: "Particle grouping", exact: true })
      .check();
    await page.clock.runFor(100);
    expect((await counts()).paints).toBe(1);
    await reset();
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await page.clock.runFor(1000);
    const active = await counts();
    expect(active.paints).toBeGreaterThan(50);
    expect(active.snapshots).toBe(active.paints);
    console.log("Gravity active vs paused work", {
      viewport,
      active,
      paused: { paints: 0, snapshots: 0 },
    });
  });
}
