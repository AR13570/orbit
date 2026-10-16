import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1200, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`Gravity practice preserves unequal planets through contact on ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let engineModuleUrl = "";
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/src/gravity/engine.ts")
        engineModuleUrl = request.url();
    });
    await page.clock.install({ time: new Date("2026-10-15T00:00:00Z") });
    await page.clock.pauseAt(new Date("2026-10-15T00:00:01Z"));
    await page.goto("/?mode=gravity&seed=42");
    await page.clock.runFor(1000);
    expect(engineModuleUrl).not.toBe("");
    await page.evaluate(async (moduleUrl) => {
      const { GravityEngine } = await import(moduleUrl);
      const probe = window as any;
      const original = GravityEngine.prototype.launch;
      GravityEngine.prototype.launch = function () {
        probe.practiceEngine = this;
        return original.call(this);
      };
    }, engineModuleUrl);
    const practice = page.getByLabel("Gravity practice field");
    await practice.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.evaluate(() => {
      const probe = window as any;
      const engine = probe.practiceEngine;
      engine.retry();
      engine.setTimeScale(1);
      engine.launchFrom({ x: 410, y: 650 }, { x: 0, y: 0 });
      probe.closestPlanets = Infinity;
      probe.minimumSurvivors = 2;
      const update = engine.update.bind(engine);
      engine.update = (dt: number) => {
        update(dt);
        const particles = engine.getRenderSnapshot().particles;
        probe.minimumSurvivors = Math.min(
          probe.minimumSurvivors,
          particles.filter((p: any) => p.alive).length,
        );
        probe.closestPlanets = Math.min(
          probe.closestPlanets,
          Math.hypot(
            particles[0].position.x - particles[1].position.x,
            particles[0].position.y - particles[1].position.y,
          ),
        );
      };
      probe.drawnPlanets = {};
      const arc = CanvasRenderingContext2D.prototype.arc;
      CanvasRenderingContext2D.prototype.arc = function (
        x,
        y,
        radius,
        start,
        end,
        anti,
      ) {
        if (
          this.canvas.classList.contains("gravity-guide-field") &&
          ["#cf315c", "#007c9e"].includes(String(this.fillStyle))
        )
          probe.drawnPlanets[String(this.fillStyle)] = { x, y, radius };
        return arc.call(this, x, y, radius, start, end, anti);
      };
    });
    const size = page.getByRole("slider", { name: "Projectile size" });
    await size.focus();
    await page.keyboard.press("End");
    await expect(size).toHaveValue("2");
    await page.evaluate(() =>
      (window as any).practiceEngine.launchFrom(
        { x: 470, y: 650 },
        { x: 0, y: 0 },
      ),
    );
    await page.clock.runFor(2000);
    const result = await page.evaluate(() => {
      const probe = window as any;
      return {
        minimumSurvivors: probe.minimumSurvivors,
        closest: probe.closestPlanets,
        particles: probe.practiceEngine
          .getSnapshot()
          .particles.map(({ alive, radius, mass }: any) => ({
            alive,
            radius,
            mass,
          })),
        drawn: probe.drawnPlanets,
      };
    });
    expect(result.minimumSurvivors).toBe(2);
    expect(result.closest).toBeGreaterThanOrEqual(24 - 1e-7);
    expect(result.closest).toBeLessThan(25);
    expect(result.particles).toEqual([
      { alive: true, radius: 8, mass: 1 },
      { alive: true, radius: 16, mass: 4 },
    ]);
    expect(Object.keys(result.drawn).sort()).toEqual(["#007c9e", "#cf315c"]);
    await page.screenshot({
      path: `/private/tmp/orbit-guide-planets-survive-${viewport.width}x${viewport.height}.png`,
    });
    expect(errors).toEqual([]);
  });
}
