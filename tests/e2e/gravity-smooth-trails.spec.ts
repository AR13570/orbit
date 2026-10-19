import { expect, test } from "@playwright/test";

test("Gravity trails fade continuously without seams in both themes and busy skies", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto("/");
  const results = await page.evaluate(async () => {
    const { createGravityRenderer } = await import("/src/gravity/renderer.ts");
    const { GravityEngine } = await import("/src/gravity/engine.ts");
    const { newDraft, toGravityLevel } =
      await import("/src/gravity/creator/model.ts");
    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:fixed;inset:0;width:900px;height:700px;z-index:999";
    document.body.append(canvas);
    const draft = newDraft();
    draft.bodies = [];
    const engine = new GravityEngine(42, toGravityLevel(draft));
    for (let i = 0; i < 128; i++)
      engine.launchFrom({ x: 780, y: 220 + i * 3 }, { x: 10, y: 0 });
    const state = engine.getSnapshot();
    state.elapsed = 1;
    for (const [i, particle] of state.particles.entries()) {
      particle.trail = Array.from({ length: 512 }, (_, n) => ({
        x: 120 + (n * 660) / 511,
        y: 220 + i * 3,
        time: 0.1 + (0.9 * n) / 511,
      }));
    }
    const all = state.particles;
    const renderer = createGravityRenderer(canvas);
    const measurements = [];
    for (const theme of ["dark", "light"]) {
      document.documentElement.dataset.theme = theme;
      for (const count of [1, 16]) {
        state.particles = all.slice(0, count);
        // Separate the first trail from the remaining trails for pixel inspection.
        for (let i = 1; i < count; i++)
          state.particles[i].trail.forEach((point) => {
            point.y = 300 + i * 12;
          });
        for (const dpr of [1, 2]) {
          renderer.resize(900, 700, dpr);
          renderer.render(state, [], 0, { paused: true, reducedMotion: true });
          const from = renderer.worldToScreen({ x: 120, y: 220 });
          const to = renderer.worldToScreen({ x: 780, y: 220 });
          const ctx = canvas.getContext("2d")!;
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const y = Math.floor(from.y * dpr);
          const brightness = (x: number) => {
            const offset = (y * canvas.width + x) * 4;
            const sum =
              pixels.data[offset] +
              pixels.data[offset + 1] +
              pixels.data[offset + 2];
            return theme === "dark" ? sum : 233 + 236 + 239 - sum;
          };
          let worstSeam = 0;
          for (
            let x = Math.ceil(from.x * dpr) + 30;
            x < Math.floor(to.x * dpr) - 30;
            x++
          )
            worstSeam = Math.max(
              worstSeam,
              Math.abs(
                brightness(x) - (brightness(x - 2) + brightness(x + 2)) / 2,
              ),
            );
          measurements.push({ theme, count, dpr, worstSeam });
        }
      }
    }
    document.documentElement.dataset.theme = "dark";
    state.particles = all;
    renderer.resize(900, 700, 1);
    const timings = [];
    for (let i = 0; i < 12; i++) {
      const start = performance.now();
      renderer.render(state, [], i / 60, { paused: true, reducedMotion: true });
      timings.push(performance.now() - start);
    }
    // Present a curved, colorful fixture for visual inspection as well.
    state.particles = all.slice(0, 8);
    for (const [i, particle] of state.particles.entries()) {
      particle.trail = Array.from({ length: 512 }, (_, n) => {
        const t = n / 511;
        return {
          x: 120 + t * 660,
          y: 160 + i * 40 + Math.sin(t * Math.PI * 1.3 + i * 0.3) * 80,
          time: 0.1 + 0.9 * t,
        };
      });
      particle.position = { ...particle.trail.at(-1)! };
    }
    renderer.render(state, [], 0, { paused: true, reducedMotion: true });
    return {
      measurements,
      meanFrame: timings.slice(2).reduce((sum, n) => sum + n, 0) / 10,
    };
  });
  console.log(
    "Smooth trail pixel and rendering checks",
    JSON.stringify(results),
  );
  for (const sample of results.measurements)
    expect(sample.worstSeam, JSON.stringify(sample)).toBeLessThanOrEqual(5);
  expect(results.meanFrame).toBeLessThan(30);
  await page.screenshot({ path: "/private/tmp/orbit-smooth-trails.png" });
});
