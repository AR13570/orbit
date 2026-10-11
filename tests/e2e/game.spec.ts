import { test, expect, type Page } from "@playwright/test";
import { OrbitEngine } from "../../src/game/engine";
import {
  fitFieldCamera,
  visibleWorldBounds,
} from "../../src/render/coordinates";
import {
  FIXED_STEP,
  SHIP_RADIUS,
  launchSpeed,
  segmentCircleIntersection,
  stepParticle,
} from "../../src/game/physics";
import type { SectorSnapshot, WorldBounds } from "../../src/game/types";

// Deliberately omit the optional checkpoint force for this counterfactual only.
function unassistedGoalPass(
  sector: SectorSnapshot,
  bounds: WorldBounds,
  angle: number,
  power: number,
) {
  let position = { ...sector.launch };
  const speed = launchSpeed(power);
  let velocity = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
  let closestDistance = Infinity,
    passedGoal = false;
  for (let n = 0; n < 22 / FIXED_STEP; n++) {
    const next = stepParticle(position, velocity, sector.bodies, FIXED_STEP);
    const dock = segmentCircleIntersection(
      position,
      next.position,
      sector.checkpoint.position,
      sector.checkpoint.radius + SHIP_RADIUS,
    );
    let collision = Infinity;
    for (const body of sector.bodies) {
      const hit = segmentCircleIntersection(
        position,
        next.position,
        body.position,
        body.radius + SHIP_RADIUS,
      );
      if (hit !== null) collision = Math.min(collision, hit);
    }
    const dx = next.position.x - position.x,
      dy = next.position.y - position.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared
      ? Math.max(
          0,
          Math.min(
            1,
            ((sector.checkpoint.position.x - position.x) * dx +
              (sector.checkpoint.position.y - position.y) * dy) /
              lengthSquared,
          ),
        )
      : 0;
    closestDistance = Math.min(
      closestDistance,
      Math.hypot(
        position.x + t * dx - sector.checkpoint.position.x,
        position.y + t * dy - sector.checkpoint.position.y,
      ),
    );
    if (
      dx > 0 &&
      position.x <= sector.checkpoint.position.x &&
      next.position.x >= sector.checkpoint.position.x &&
      (sector.checkpoint.position.x - position.x) / dx < collision
    )
      passedGoal = true;
    if (dock !== null && dock < collision)
      return { docked: true, closestDistance, passedGoal };
    if (
      collision < Infinity ||
      next.position.x < bounds.x + SHIP_RADIUS ||
      next.position.x > bounds.x + bounds.width - SHIP_RADIUS ||
      next.position.y < bounds.y + SHIP_RADIUS ||
      next.position.y > bounds.y + bounds.height - SHIP_RADIUS
    )
      return { docked: false, closestDistance, passedGoal };
    ({ position, velocity } = next);
  }
  return { docked: false, closestDistance, passedGoal };
}
async function pull(
  page: Page,
  angle: number,
  power: number,
  fullDistance = 160,
  capture?: string,
) {
  const v = page.viewportSize()!;
  const x = v.width * 0.55,
    y = v.height * 0.55;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(
    x - Math.cos(angle) * power * fullDistance,
    y - Math.sin(angle) * power * fullDistance,
    { steps: 8 },
  );
  if (capture) {
    await page.waitForTimeout(60);
    await page.screenshot({ path: capture });
  }
  await page.mouse.up();
}
async function ready(page: Page) {
  await expect(page.getByRole("status")).toHaveText("Ready to pull");
}
async function runUntilStatus(page: Page, status: string, limit = 30000) {
  for (let elapsed = 0; elapsed < limit; elapsed += 100) {
    if ((await page.getByRole("status").textContent()) === status) return;
    await page.clock.runFor(100);
  }
  await expect(page.getByRole("status")).toHaveText(status);
}
async function paintedField(page: Page) {
  await expect
    .poll(async () =>
      page.getByLabel("Slingshot flight field").evaluate((element) => {
        const canvas = element as HTMLCanvasElement;
        const context = canvas.getContext("2d");
        if (!context || canvas.width < 4 || canvas.height < 4) return false;
        // A resize clears the bitmap even while the DOM already says ready.
        // Opaque ground in all corners proves the renderer painted it again.
        return [
          [1, 1],
          [canvas.width - 2, 1],
          [1, canvas.height - 2],
          [canvas.width - 2, canvas.height - 2],
        ].every(([x, y]) => {
          const [r, g, b, a] = context.getImageData(x, y, 1, 1).data;
          return r === 233 && g === 236 && b === 239 && a === 255;
        });
      }),
    )
    .toBe(true);
}
async function pauseNewSeed(page: Page) {
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "New seed", exact: true }).click();
}
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 844, height: 390 },
]) {
  test(`full-viewport release controls ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/?seed=42");
    await ready(page);
    expect(
      await page
        .locator("input[type=range],header,footer,aside,.power-indicator")
        .count(),
    ).toBe(0);
    await expect(
      page.getByRole("button", { name: "Launch", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("ORBIT", { exact: true })).toHaveCount(0);
    const box = await page.getByLabel("Slingshot flight field").boundingBox();
    expect(box!.x).toBe(0);
    expect(box!.y).toBe(0);
    expect(box!.width).toBe(viewport.width);
    expect(box!.height).toBe(viewport.height);
    const pause = await page
      .getByRole("button", { name: "Pause", exact: true })
      .boundingBox();
    expect(pause!.width).toBeGreaterThanOrEqual(44);
    expect(pause!.height).toBeGreaterThanOrEqual(44);
    expect(pause!.x + pause!.width).toBeLessThanOrEqual(viewport.width);
    expect(pause!.y).toBeGreaterThanOrEqual(0);
    await paintedField(page);
    await page.screenshot({
      path: `test-results/redesign-${viewport.width}x${viewport.height}.png`,
    });
    await page.mouse.click(viewport.width * 0.5, viewport.height * 0.5);
    await ready(page);
    const solution = new OrbitEngine(42).getSnapshot().sector.solution;
    await pull(
      page,
      solution.angle,
      solution.power,
      viewport.width <= 760 ? 120 : 160,
    );
    await expect(page.getByRole("status")).toHaveText("In flight");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
    await page.getByRole("button", { name: "How to play" }).click();
    await expect(
      page.getByRole("dialog", { name: "How to play" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close help" }).click();
    await page.getByRole("button", { name: "Reset shot" }).click();
    await ready(page);
    await pauseNewSeed(page);
    expect(errors).toEqual([]);
  });
}
for (const journeyViewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`two gesture flights automatically advance checkpoints ${journeyViewport.width}x${journeyViewport.height}`, async ({
    page,
  }) => {
    test.setTimeout(65000);
    await page.setViewportSize(journeyViewport);
    await page.goto("/?seed=42");
    await ready(page);
    const engine = new OrbitEngine(42);
    for (let index = 0; index < 2; index++) {
      const s = engine.getSnapshot();
      const angle = s.sector.solution.angle,
        power = s.sector.solution.power;
      engine.setAim(angle, power);
      engine.launch();
      for (let n = 0; n < 22 * 120; n++) engine.update(1 / 120);
      expect(engine.getSnapshot().status).toBe("docked");
      await pull(
        page,
        angle,
        power,
        journeyViewport.width <= 760 ? 120 : 160,
        index === 0
          ? `test-results/redesign-pull-${journeyViewport.width}.png`
          : undefined,
      );
      await expect(page.getByRole("status")).toHaveText("In flight");
      await expect(
        page.getByLabel(`Checkpoint ${index + 1}`, { exact: true }),
      ).toBeVisible({ timeout: 28000 });
      await ready(page);
      await page.waitForTimeout(750);
      if (index === 0 && journeyViewport.width === 1440) {
        await page.screenshot({
          path: "test-results/redesign-checkpoint-1-1440.png",
        });
      }
      engine.advance();
    }
    await expect(page.getByLabel("Checkpoint 3", { exact: true })).toHaveCount(
      0,
    );
    await page.screenshot({
      path: `test-results/redesign-progressed-${journeyViewport.width}.png`,
    });
  });
}

test("opening near-straight bypass collides before timeout while the curved gesture docks", async ({
  page,
}) => {
  const viewport = { width: 1440, height: 900 };
  const reference = new OrbitEngine(42);
  const sector = reference.getSnapshot().sector;
  reference.setFlightBounds(
    visibleWorldBounds(
      fitFieldCamera(
        sector.bounds,
        sector.launch,
        viewport.width,
        viewport.height,
      ),
      viewport.width,
      viewport.height,
    ),
  );
  const bearing = Math.atan2(
    sector.checkpoint.position.y - sector.launch.y,
    sector.checkpoint.position.x - sector.launch.x,
  );
  const shortcutAngle = bearing - 0.075;
  reference.setAim(shortcutAngle, 0.975);
  reference.launch();
  for (
    let step = 0;
    step < 6 * 120 && reference.getSnapshot().status === "flying";
    step++
  )
    reference.update(FIXED_STEP);
  const collision = reference.getSnapshot();
  expect(collision.status).toBe("failed");
  expect(collision.elapsed).toBeLessThan(1);
  expect(collision.particles[0].offscreenRemaining).toBeUndefined();
  expect(
    sector.bodies.some(
      (body) =>
        Math.abs(
          Math.hypot(
            collision.particles[0].position.x - body.position.x,
            collision.particles[0].position.y - body.position.y,
          ) -
            body.radius -
            SHIP_RADIUS,
        ) < 1e-6,
    ),
  ).toBe(true);
  const contact = sector.solution.path.at(-1)!;
  const chord = {
    x: contact.x - sector.launch.x,
    y: contact.y - sector.launch.y,
  };
  const bend = Math.max(
    ...sector.solution.path.map(
      (point) =>
        Math.abs(
          (point.x - sector.launch.x) * chord.y -
            (point.y - sector.launch.y) * chord.x,
        ) / Math.hypot(chord.x, chord.y),
    ),
  );
  expect(bend).toBeGreaterThanOrEqual(80);

  await page.setViewportSize(viewport);
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto("/?seed=42");
  await page.clock.runFor(100);
  await ready(page);
  await pull(page, shortcutAngle, 0.975);
  await page.clock.runFor((collision.elapsed - 0.12) * 1000);
  await expect(page.getByRole("status")).toHaveText("In flight");
  await page.clock.runFor(240);
  await expect(page.getByRole("status")).toHaveText("Preparing another shot.");
  await expect(page.locator(".offscreen-countdown")).toHaveCount(0);
  await expect(page.getByLabel("Checkpoint 0", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/redesign-shortcut-obstacle-contact.png",
  });
  await page.clock.runFor(750);
  await ready(page);
  await pull(page, sector.solution.angle, sector.solution.power);
  await page.clock.runFor(600);
  await expect(page.getByRole("status")).toHaveText("In flight");
  await page.screenshot({
    path: "test-results/redesign-curved-detour-desktop.png",
  });
  await runUntilStatus(page, "Ready to pull");
  await expect(page.getByLabel("Checkpoint 1", { exact: true })).toBeVisible();
});

test("continuous free play retains progress through five misses and another checkpoint", async ({
  page,
}) => {
  test.setTimeout(65000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto("/?seed=42");
  await page.clock.runFor(100);
  await ready(page);
  await expect(page.locator(".life-meter,.life-dot,.scene-score")).toHaveCount(
    0,
  );
  const reference = new OrbitEngine(42);
  expect(reference.getSnapshot().sector.checkpoint.radius).toBe(45);
  await page.screenshot({ path: "/private/tmp/orbit-freeplay-checkpoint.png" });
  const first = reference.getSnapshot().sector.solution;
  await pull(page, first.angle, first.power);
  await runUntilStatus(page, "Ready to pull");
  await expect(page.getByLabel("Checkpoint 1", { exact: true })).toBeVisible({
    timeout: 28000,
  });
  await ready(page);
  await page.clock.runFor(750);
  reference.setAim(first.angle, first.power);
  reference.launch();
  for (let n = 0; n < 22 * 120; n++) reference.update(1 / 120);
  expect(reference.getSnapshot().status).toBe("docked");
  reference.advance();
  for (let miss = 0; miss < 5; miss++) {
    const sector = reference.getSnapshot().sector;
    const angle =
      miss === 0
        ? Math.atan2(
            sector.checkpoint.position.y - sector.launch.y,
            sector.checkpoint.position.x - sector.launch.x,
          )
        : Math.PI;
    await pull(page, angle, 1);
    await runUntilStatus(page, "Preparing another shot.");
    await expect(page.getByRole("status")).toHaveText(
      "Preparing another shot.",
      { timeout: 10000 },
    );
    await page.clock.runFor(750);
    await ready(page);
    await expect(
      page.getByLabel("Checkpoint 1", { exact: true }),
    ).toBeVisible();

    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  const second = reference.getSnapshot().sector.solution;
  await pull(page, second.angle, second.power);
  await runUntilStatus(page, "Ready to pull");
  await expect(page.getByLabel("Checkpoint 2", { exact: true })).toBeVisible({
    timeout: 28000,
  });

  await ready(page);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "New seed", exact: true }).click();
  await ready(page);
  await expect(page.getByLabel("Checkpoint 0", { exact: true })).toBeVisible();
  await pull(page, 0, 0.8);
  await expect(page.getByRole("status")).toHaveText("In flight");
});
test("resize and pause cancel held pulls without firing", async ({ page }) => {
  await page.goto("/?seed=42");
  await ready(page);
  await page.mouse.move(500, 400);
  await page.mouse.down();
  await page.mouse.move(420, 400);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.mouse.up();
  await ready(page);
  await page.mouse.move(500, 200);
  await page.mouse.down();
  await page.mouse.move(420, 200);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).click();
  await ready(page);
});
test("real touch drag releases to fire and ignores additional touch", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await page.goto("/?seed=42");
    await ready(page);
    const solution = new OrbitEngine(42).getSnapshot().sector.solution;
    const pullPoint = {
      x: 240 - Math.cos(solution.angle) * solution.power * 120,
      y: 480 - Math.sin(solution.angle) * solution.power * 120,
    };
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 240, y: 480, id: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ ...pullPoint, id: 1 }],
    });
    await ready(page);
    await page.screenshot({ path: "test-results/redesign-touch-pull.png" });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { ...pullPoint, id: 1 },
        { x: 300, y: 650, id: 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { ...pullPoint, id: 1 },
        { x: 320, y: 680, id: 2 },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [{ x: 320, y: 680, id: 2 }],
    });
    await ready(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(page.getByRole("status")).toHaveText("In flight");
    await page.getByRole("button", { name: "Pause", exact: true }).tap();
    await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
    await page.getByRole("button", { name: "Reset shot" }).tap();
    await ready(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 240, y: 480, id: 3 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 160, y: 500, id: 3 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await ready(page);
    await page.screenshot({ path: "test-results/redesign-touch.png" });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 240, y: 480, id: 4 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 160, y: 480, id: 4 }],
    });
    await page.setViewportSize({ width: 844, height: 390 });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await ready(page);
    await page.screenshot({
      path: "test-results/redesign-touch-landscape.png",
    });
  } finally {
    await context.close();
  }
});
test("denser seeded scene has no page errors", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?seed=137");
  await ready(page);
  await page.screenshot({ path: "test-results/redesign-dense.png" });
});

test("offscreen flight survives exit, freezes while paused and retries once after six active seconds", async ({
  page,
}) => {
  const viewport = { width: 1440, height: 900 };
  await page.setViewportSize(viewport);
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto("/?seed=42");
  await page.clock.runFor(50);
  await ready(page);
  const reference = new OrbitEngine(42),
    sector = reference.getSnapshot().sector,
    camera = fitFieldCamera(
      sector.bounds,
      sector.launch,
      viewport.width,
      viewport.height,
    );
  const bounds = visibleWorldBounds(camera, viewport.width, viewport.height);
  reference.setFlightBounds(bounds);
  reference.setAim(Math.PI, 1);
  reference.launch();
  let canonicalTime = 0,
    outsideTime = 0,
    expiryTime = 0;
  for (let n = 0; n < 22 * 120; n++) {
    reference.update(1 / 120);
    const snapshot = reference.getSnapshot();
    if (
      !canonicalTime &&
      snapshot.particles[0].position.x < sector.bounds.x &&
      snapshot.status === "flying"
    )
      canonicalTime = (n + 1) / 120;
    if (!outsideTime && snapshot.particles[0].offscreenRemaining !== undefined)
      outsideTime = (n + 1) / 120;
    if (snapshot.status === "failed") {
      expiryTime = (n + 1) / 120;
      break;
    }
  }
  expect(canonicalTime).toBeGreaterThan(0);
  expect(outsideTime).toBeGreaterThan(canonicalTime + 0.06);
  expect(expiryTime - outsideTime).toBeGreaterThanOrEqual(5.98);
  expect(expiryTime - outsideTime).toBeLessThanOrEqual(6.02);
  expect(reference.getSnapshot().particles[0].position.x).toBeLessThan(
    bounds.x + 8,
  );
  await pull(page, Math.PI, 1);
  await page.clock.runFor((canonicalTime + 0.03) * 1000);
  await expect(page.getByRole("status")).toHaveText("In flight");
  await page.screenshot({ path: "test-results/redesign-visible-boundary.png" });
  await page.clock.runFor((outsideTime - canonicalTime + 0.2) * 1000);
  const countdown = page.locator(".offscreen-countdown");
  await expect(countdown).toHaveText("Offscreen · 6s");
  await expect(page.getByRole("status")).toHaveText(
    "Offscreen. Six seconds to return.",
  );
  await page.screenshot({
    path: "test-results/redesign-offscreen-countdown.png",
  });
  await page.clock.runFor(1100);
  await expect(countdown).toHaveText("Offscreen · 5s");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.clock.runFor(8000);
  await expect(countdown).toHaveCount(0);
  await page.getByRole("button", { name: "How to play" }).click();
  await expect(page.getByRole("dialog", { name: "How to play" })).toContainText(
    "six seconds",
  );
  await page.clock.runFor(3000);
  await page.getByRole("button", { name: "Close help" }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(countdown).toHaveText("Offscreen · 5s");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(3000);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(100);
  await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
  await expect(countdown).toHaveCount(0);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(countdown).toHaveText("Offscreen · 5s");
  await page.clock.runFor(4300);
  await expect(countdown).toHaveText("Offscreen · 1s");
  await page.clock.runFor(500);
  await expect(page.getByRole("status")).toHaveText("Preparing another shot.");
  await expect(countdown).toHaveCount(0);
  await page.clock.runFor(400);
  await expect(page.getByRole("status")).toHaveText("Preparing another shot.");
  await page.clock.runFor(400);
  await ready(page);
  await page.clock.runFor(2000);
  await ready(page);
  await expect(page.getByLabel("Checkpoint 0", { exact: true })).toBeVisible();
});

test("real generated gravity flight returns from offscreen and clears its countdown", async ({
  page,
}) => {
  const viewport = { width: 1440, height: 900 };
  await page.setViewportSize(viewport);
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto("/?seed=42");
  await page.clock.runFor(100);
  await ready(page);
  const reference = new OrbitEngine(42);
  const sector = reference.getSnapshot().sector;
  const bounds = visibleWorldBounds(
    fitFieldCamera(
      sector.bounds,
      sector.launch,
      viewport.width,
      viewport.height,
    ),
    viewport.width,
    viewport.height,
  );
  reference.setFlightBounds(bounds);
  reference.setAim(-1.1, 1);
  reference.launch();
  let outsideAt = 0,
    returnedAt = 0;
  for (let step = 0; step < 22 * 120; step++) {
    reference.update(1 / 120);
    const snapshot = reference.getSnapshot();
    if (snapshot.status !== "flying") break;
    if (snapshot.particles[0].offscreenRemaining !== undefined)
      outsideAt ||= (step + 1) / 120;
    else if (outsideAt) {
      returnedAt = (step + 1) / 120;
      break;
    }
  }
  expect(outsideAt).toBeGreaterThan(0);
  expect(returnedAt - outsideAt).toBeGreaterThan(0.35);
  expect(returnedAt - outsideAt).toBeLessThan(6);
  await pull(page, -1.1, 1);
  await page.clock.runFor((outsideAt + 0.1) * 1000);
  await expect(page.locator(".offscreen-countdown")).toHaveText(
    "Offscreen · 6s",
  );
  await expect(page.getByRole("status")).toHaveText(
    "Offscreen. Six seconds to return.",
  );
  await page.clock.runFor((returnedAt - outsideAt + 0.05) * 1000);
  await expect(page.locator(".offscreen-countdown")).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText("In flight");
  await expect(page.getByLabel("Checkpoint 0", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/redesign-offscreen-return.png" });
});

test("actual touch portrait flight docks and automatically prepares the next launcher", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto("/?seed=42");
    await ready(page);
    const reference = new OrbitEngine(42),
      solution = reference.getSnapshot().sector.solution;
    const cdp = await context.newCDPSession(page);
    const origin = { x: 240, y: 480 },
      distance = solution.power * 120;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...origin, id: 1 }],
    });
    for (let n = 1; n <= 8; n++)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: origin.x - (Math.cos(solution.angle) * distance * n) / 8,
            y: origin.y - (Math.sin(solution.angle) * distance * n) / 8,
            id: 1,
          },
        ],
      });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(page.getByRole("status")).toHaveText("In flight");
    await page.waitForTimeout(1200);
    await page.screenshot({ path: "test-results/redesign-touch-flight.png" });
    await expect(page.getByLabel("Checkpoint 1", { exact: true })).toBeVisible({
      timeout: 28000,
    });

    await ready(page);
    await page.waitForTimeout(750);
    await page.screenshot({
      path: "test-results/redesign-touch-next-launcher.png",
    });
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("mouse selects split mode, launches one piece and taps in flight to branch once", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?seed=42");
  await ready(page);
  await page.mouse.dblclick(600, 400, { delay: 60 });
  await expect(page.getByText("Split mode", { exact: true })).toHaveText(
    "Split mode",
  );
  await ready(page);
  await page.mouse.move(600, 400);
  await page.mouse.down();
  const solution = new OrbitEngine(42).getSnapshot().sector.solution;
  await page.mouse.move(
    600 - Math.cos(solution.angle) * solution.power * 160,
    400 - Math.sin(solution.angle) * solution.power * 160,
    { steps: 8 },
  );
  await page.waitForTimeout(60);
  await page.screenshot({
    path: "/private/tmp/orbit-split-preview-desktop.png",
  });
  await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText("In flight");
  await page.waitForTimeout(200);
  await page.screenshot({
    path: "/private/tmp/orbit-initial-flight-desktop.png",
  });
  // An out-and-back drag during flight is not a split tap.
  await page.mouse.move(600, 400);
  await page.mouse.down();
  await page.mouse.move(625, 400);
  await page.mouse.move(600, 400);
  await page.mouse.up();
  await expect(page.getByText("Shot split", { exact: true })).toHaveCount(0);
  await page.mouse.click(600, 400);
  await expect(page.getByText("Shot split", { exact: true })).toHaveText(
    "Shot split",
  );
  await page.waitForTimeout(200);
  await page.screenshot({
    path: "/private/tmp/orbit-branched-flight-desktop.png",
  });
  await page.mouse.dblclick(600, 400, { delay: 50 });
  await expect(page.getByText("Single shooter", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Reset shot" }).click();
  await ready(page);
  await page.mouse.dblclick(600, 400, { delay: 60 });
  await expect(page.getByText("Single shooter", { exact: true })).toHaveText(
    "Single shooter",
  );
  await ready(page);
});

test("actual touch selects split mode and branches only on a valid in-flight tap", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await page.goto("/?seed=42");
    await ready(page);
    const cdp = await context.newCDPSession(page);
    const touch = async (
      type: string,
      points: { x: number; y: number; id: number }[],
    ) =>
      cdp.send("Input.dispatchTouchEvent", {
        type: type as "touchStart" | "touchMove" | "touchEnd" | "touchCancel",
        touchPoints: points,
      });
    for (let n = 0; n < 2; n++) {
      await touch("touchStart", [{ x: 240, y: 480, id: n + 1 }]);
      await touch("touchEnd", []);
    }
    await expect(page.getByText("Split mode", { exact: true })).toHaveText(
      "Split mode",
    );
    await ready(page);
    await touch("touchStart", [{ x: 240, y: 480, id: 3 }]);
    const solution = new OrbitEngine(42).getSnapshot().sector.solution;
    for (let n = 1; n <= 8; n++)
      await touch("touchMove", [
        {
          x: 240 - (Math.cos(solution.angle) * solution.power * 120 * n) / 8,
          y: 480 - (Math.sin(solution.angle) * solution.power * 120 * n) / 8,
          id: 3,
        },
      ]);
    await page.waitForTimeout(60);
    await page.screenshot({
      path: "/private/tmp/orbit-split-preview-touch.png",
    });
    await touch("touchEnd", []);
    await expect(page.getByRole("status")).toHaveText("In flight");
    await page.waitForTimeout(200);
    await page.screenshot({
      path: "/private/tmp/orbit-initial-flight-touch.png",
    });
    await touch("touchStart", [{ x: 240, y: 480, id: 6 }]);
    await touch("touchMove", [{ x: 265, y: 480, id: 6 }]);
    await touch("touchMove", [{ x: 240, y: 480, id: 6 }]);
    await touch("touchEnd", []);
    await touch("touchStart", [{ x: 240, y: 480, id: 7 }]);
    await touch("touchCancel", []);
    await expect(page.getByText("Shot split", { exact: true })).toHaveCount(0);
    await touch("touchStart", [{ x: 240, y: 480, id: 8 }]);
    await touch("touchEnd", []);
    await expect(page.getByText("Shot split", { exact: true })).toHaveText(
      "Shot split",
    );
    await page.waitForTimeout(200);
    await page.screenshot({
      path: "/private/tmp/orbit-branched-flight-touch.png",
    });
    for (let n = 0; n < 2; n++) {
      await touch("touchStart", [{ x: 240, y: 480, id: 9 + n }]);
      await touch("touchEnd", []);
    }
    await expect(page.getByText("Single shooter", { exact: true })).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: "Pause", exact: true }).tap();
    await page.getByRole("button", { name: "Reset shot" }).tap();
    await ready(page);
    // Pause clears a first tap, so one tap after resuming cannot toggle.
    await touch("touchStart", [{ x: 240, y: 480, id: 4 }]);
    await touch("touchEnd", []);
    await page.getByRole("button", { name: "Pause", exact: true }).tap();
    await page.getByRole("button", { name: "Resume" }).tap();
    await touch("touchStart", [{ x: 240, y: 480, id: 5 }]);
    await touch("touchEnd", []);
    await expect(page.getByText("Single shooter", { exact: true })).toHaveCount(
      0,
    );
    await ready(page);
  } finally {
    await context.close();
  }
});

test("blue checkpoint gravity captures a near miss using the predicted real gesture", async ({
  page,
}) => {
  test.setTimeout(30000);
  const viewport = { width: 1440, height: 900 };
  let assisted: {
    seed: number;
    angle: number;
    power: number;
    missDistance: number;
  } | null = null;
  search: for (const seed of [42, 17, 137, 7, 11, 3, 28, 63]) {
    const reference = new OrbitEngine(seed);
    const sector = reference.getSnapshot().sector;
    const bounds = visibleWorldBounds(
      fitFieldCamera(
        sector.bounds,
        sector.launch,
        viewport.width,
        viewport.height,
      ),
      viewport.width,
      viewport.height,
    );
    reference.setFlightBounds(bounds);
    for (const factor of [1, 0.8, 1.2, 0.65]) {
      for (const offset of [
        0, 0.08, -0.08, 0.14, -0.14, 0.22, -0.22, 0.32, -0.32, 0.45, -0.45,
      ]) {
        const angle = sector.solution.angle + offset;
        const power = Math.max(
          0.15,
          Math.min(1, sector.solution.power * factor),
        );
        const unassisted = unassistedGoalPass(sector, bounds, angle, power);
        if (
          unassisted.docked ||
          !unassisted.passedGoal ||
          unassisted.closestDistance < 120 ||
          unassisted.closestDistance > 400
        )
          continue;
        reference.setAim(angle, power);
        const prediction = reference.predict(1.6);
        expect(prediction).toHaveLength(1);
        reference.launch();
        for (let n = 0; n < 192; n++) reference.update(FIXED_STEP);
        // Also compare terminal contact when strong pull captures before 1.6s.
        expect(reference.getSnapshot().particles[0].position.x).toBeCloseTo(
          prediction[0].at(-1)!.x,
          7,
        );
        expect(reference.getSnapshot().particles[0].position.y).toBeCloseTo(
          prediction[0].at(-1)!.y,
          7,
        );
        for (
          let elapsed = 1.6;
          elapsed < 22 && reference.getSnapshot().status === "flying";
          elapsed += 0.1
        )
          reference.update(0.1);
        if (reference.getSnapshot().status === "docked") {
          assisted = {
            seed,
            angle,
            power,
            missDistance: unassisted.closestDistance,
          };
          break search;
        }
        reference.retry();
      }
    }
  }
  expect(
    assisted,
    "Strong goal pull must rescue a clear generated pass that misses by at least 120 world units",
  ).not.toBeNull();
  expect(assisted!.missDistance).toBeGreaterThanOrEqual(120);
  console.info("Goal-assisted fixture", assisted);
  await page.setViewportSize(viewport);
  await page.goto(`/?seed=${assisted!.seed}`);
  await ready(page);
  await pull(
    page,
    assisted!.angle,
    assisted!.power,
    160,
    "/private/tmp/orbit-blue-goal-prediction.png",
  );
  await expect(page.getByRole("status")).toHaveText("In flight");
  await expect(page.getByLabel("Checkpoint 1", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await ready(page);
  await page.waitForTimeout(750);
  await page.screenshot({ path: "/private/tmp/orbit-blue-goal-captured.png" });
});
