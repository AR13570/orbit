import { expect, test, type Page } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";
async function boot(page: Page, mode = "odessey") {
  await page.addInitScript(markTutorialSeen);
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.arc,
      clear = CanvasRenderingContext2D.prototype.fillRect;
    const probe = window as typeof window & {
      assistDots: { x: number; y: number }[];
    };
    probe.assistDots = [];
    CanvasRenderingContext2D.prototype.fillRect = function (
      x,
      y,
      width,
      height,
    ) {
      if (this.canvas.classList.contains("scene-canvas") && x === 0 && y === 0)
        probe.assistDots = [];
      return clear.call(this, x, y, width, height);
    };
    CanvasRenderingContext2D.prototype.arc = function (
      x,
      y,
      r,
      start,
      end,
      anticlockwise,
    ) {
      if (
        this.canvas.classList.contains("scene-canvas") &&
        (this.fillStyle === "#8a0f4b" || this.fillStyle === "#7956cf")
      )
        probe.assistDots.push({ x, y });
      return original.call(this, x, y, r, start, end, anticlockwise);
    };
  });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto(`/?mode=${mode}&seed=42`);
  await page.clock.runFor(1000);
}
async function dots(page: Page) {
  return page.evaluate(
    () =>
      (window as typeof window & { assistDots: unknown[] }).assistDots.length,
  );
}
async function choose(page: Page, value: "Full" | "Partial") {
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Advanced", exact: true }).click();
  await page
    .getByRole("switch", { name: "Path assist", exact: true })
    .setChecked(value === "Full");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
}
async function held(
  page: Page,
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 6 });
  await page.clock.runFor(200);
}
async function pauseHeld(page: Page) {
  await page.keyboard.press("p");
  await page.mouse.up();
  await page.clock.runFor(100);
  await page.getByRole("button", { name: "Advanced", exact: true }).click();
}

test("both modes share saved path assist and Full draws longer actual aimed trajectories", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await boot(page);
  const aim = await page.evaluate(async () => {
    const { OrbitEngine } = await import("/src/game/engine.ts");
    const engine = new OrbitEngine(42);
    let best = { angle: 0, power: 0.5, length: 0 };
    for (const angle of [-1, -0.5, 0, 0.5, 1, 2, 3])
      for (const power of [0.25, 0.5, 0.8]) {
        engine.setAim(angle, power);
        const path = engine.predict(22)[0];
        if (path?.length > best.length)
          best = { angle, power, length: path.length };
      }
    return best;
  });
  const start = { x: 600, y: 600 },
    end = {
      x: start.x - Math.cos(aim.angle) * aim.power * 160,
      y: start.y - Math.sin(aim.angle) * aim.power * 160,
    };
  await choose(page, "Full");
  await held(page, start, end);
  const odesseyFull = await dots(page);
  await page.screenshot({
    path: "/private/tmp/orbit-path-assist-odessey-full.png",
  });
  await pauseHeld(page);
  await page
    .getByRole("switch", { name: "Path assist", exact: true })
    .uncheck();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await held(page, start, end);
  const odesseyPartial = await dots(page);
  await page.screenshot({
    path: "/private/tmp/orbit-path-assist-odessey-partial.png",
  });
  expect(odesseyFull).toBeGreaterThan(odesseyPartial * 2);
  await pauseHeld(page);
  await page.getByRole("button", { name: "Choose mode", exact: true }).click();
  await page.getByRole("button", { name: /(?:Play|Continue) Gravity/ }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Advanced", exact: true }).click();
  await expect(
    page.getByRole("switch", { name: "Path assist", exact: true }),
  ).toHaveAttribute("aria-checked", "false");
  await page.getByRole("switch", { name: "Path assist", exact: true }).check();
  await page.reload();
  await page.clock.runFor(1000);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Advanced", exact: true }).click();
  await expect(
    page.getByRole("switch", { name: "Path assist", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  const { start: gravityStart, end: gravityEnd } = await page.evaluate(
    async () => {
      const { getGravityLevel } = await import("/src/gravity/campaign.ts"),
        { fitGravityFrame } = await import("/src/gravity/renderer.ts"),
        { worldToClient } = await import("/src/render/coordinates.ts");
      const level = getGravityLevel(42, 0),
        core = level.bodies.find((body) => body.kind === "attractor")!;
      const radius = 75,
        speed = Math.sqrt(
          (core.strength * radius) / (radius * radius + 40 * 40),
        );
      const { camera, area } = fitGravityFrame(
        level,
        window.innerWidth,
        window.innerHeight,
        false,
      );
      const start = worldToClient(
        { x: core.position.x + radius, y: core.position.y },
        { left: area.x, top: area.y, width: area.width, height: area.height },
        camera,
      );
      return {
        start,
        end: { x: start.x, y: start.y - Math.sqrt(speed / 420) * 180 },
      };
    },
  );
  await held(page, gravityStart, gravityEnd);
  const gravityFull = await dots(page);
  await page.screenshot({
    path: "/private/tmp/orbit-path-assist-gravity-full.png",
  });
  await pauseHeld(page);
  await page
    .getByRole("switch", { name: "Path assist", exact: true })
    .uncheck();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await held(page, gravityStart, gravityEnd);
  const gravityPartial = await dots(page);
  await page.screenshot({
    path: "/private/tmp/orbit-path-assist-gravity-partial.png",
  });
  expect(gravityFull).toBeGreaterThan(gravityPartial * 4);
  await pauseHeld(page);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.clock.runFor(32);
  expect(await dots(page)).toBe(0);
  await expect(page.locator(".game-surface [role=status]")).toHaveText(
    "0 planets in motion",
  );
  console.log("Path assist visible dots", {
    odesseyFull,
    odesseyPartial,
    gravityFull,
    gravityPartial,
  });
});

test("mobile Full assist cancels on pinch and keeps comfortable settings targets", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage(),
    cdp = await context.newCDPSession(page);
  try {
    await boot(page, "gravity");
    await choose(page, "Full");
    const start = { id: 1, x: 140, y: 370 };
    // Preserve an orbiting trajectory so pinch cancellation begins with a long Full preview.
    const orbitPower = 0.558;
    const end = { ...start, x: start.x + 96 * Math.sqrt(orbitPower) };
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [start],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [end],
    });
    await page.clock.runFor(100);
    expect(await dots(page)).toBeGreaterThan(30);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [end, { id: 2, x: 220, y: 370 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [end],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...end, x: end.x + 20 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.clock.runFor(32);
    expect(await dots(page)).toBe(0);
    await expect(page.locator(".game-surface [role=status]")).toHaveText(
      "0 planets in motion",
    );
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByRole("button", { name: "Advanced", exact: true }).click();
    await page.clock.runFor(250);
    const box = (await page
      .getByRole("switch", { name: "Path assist", exact: true })
      .boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(50);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    await page
      .getByRole("switch", { name: "Path assist", exact: true })
      .uncheck();
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await page.clock.runFor(32);
    expect(await dots(page)).toBe(0);
  } finally {
    await context.close();
  }
});

test("128-planet Full prediction finishes a genuinely long path in bounded responsive slices", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { GravityEngine } = await import("/src/gravity/engine.ts"),
      { getGravityLevel } = await import("/src/gravity/campaign.ts"),
      { createGravityRenderer } = await import("/src/gravity/renderer.ts");
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;inset:0;width:390px;height:844px";
    document.body.append(canvas);
    const renderer = createGravityRenderer(canvas);
    renderer.resize(390, 844, 2);
    const engine = new GravityEngine(42, getGravityLevel(42, 14));
    engine.setPhysics({
      planetGravity: true,
      planetCollisions: "none",
      bodyCollisions: false,
      trailSeconds: 30,
      escapeDistance: 100000,
    });
    for (let i = 0; i < 128; i++)
      engine.launchFrom(
        { x: 90 + (i % 16) * 48, y: 130 + Math.floor(i / 16) * 80 },
        { x: ((i % 3) - 1) * 15, y: ((i % 5) - 2) * 8 },
      );
    for (let i = 0; i < 96; i++) engine.update(0.25);
    engine.setLaunch({ x: 130, y: 650 }, { angle: Math.PI, power: 0.3 });
    const partial = engine.predict(0.6),
      job = engine.beginPrediction(10)!;
    const slices: number[] = [],
      frames: number[] = [];
    let count = 0;
    while (!job.done && count++ < 300) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      const frame = performance.now();
      engine.update(1 / 60);
      const start = performance.now();
      job.advance(5);
      slices.push(performance.now() - start);
      renderer.render(engine.getRenderSnapshot(), job.path, count / 60, {
        paused: false,
        reducedMotion: false,
        pull: { x: 50, y: 0 },
        pathAssist: "full",
      });
      frames.push(performance.now() - frame);
    }
    const results = {
      done: job.done,
      points: job.path.length,
      partialPoints: partial.length,
      slices: slices.length,
      maxSlice: Math.max(...slices),
      meanSlice: slices.reduce((sum, n) => sum + n, 0) / slices.length,
      meanFrame: frames.reduce((sum, n) => sum + n, 0) / frames.length,
      active: engine
        .getRenderSnapshot()
        .particles.filter((planet) => planet.alive).length,
    };
    job.cancel();
    renderer.destroy();
    canvas.remove();
    return results;
  });
  console.log("Full path assist 128-planet benchmark", JSON.stringify(result));
  expect(result.done).toBe(true);
  expect(result.active).toBe(128);
  expect(result.points).toBeGreaterThan(result.partialPoints * 10);
  expect(result.slices).toBeGreaterThan(1);
  expect(result.meanSlice).toBeLessThan(8);
  expect(result.maxSlice).toBeLessThan(35);
  expect(result.meanFrame).toBeLessThan(30);
});
