import { expect, test, type Page } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";

async function boot(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(markTutorialSeen);
  let engineUrl = "";
  page.on("response", (response) => {
    if (new URL(response.url()).pathname === "/src/gravity/engine.ts")
      engineUrl = response.url();
  });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto("/?mode=gravity&seed=42");
  await page.clock.runFor(100);
  await page.evaluate(async (url) => {
    const { GravityEngine } = await import(url);
    const getRenderSnapshot = GravityEngine.prototype.getRenderSnapshot;
    GravityEngine.prototype.getRenderSnapshot = function () {
      (window as any).testParticleEngine = this;
      return getRenderSnapshot.call(this);
    };
  }, engineUrl);
  await page.clock.runFor(32);
}
async function options(page: Page, interaction: boolean, grouping: boolean) {
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Advanced", exact: true }).click();
  await page
    .getByRole("switch", { name: "Particle Interaction", exact: true })
    .setChecked(interaction);
  await page
    .getByRole("switch", { name: "Particle grouping", exact: true })
    .setChecked(grouping);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
}
async function seedPair(page: Page, approach: boolean) {
  await page.evaluate((approach) => {
    const e = (window as any).testParticleEngine;
    e.retry();
    e.setTimeScale(1);
    // Keep the real game's fitted view, but isolate particle forces and impacts.
    // No production debug hooks or replacement simulation are involved.
    for (const core of e.getLevel().bodies) core.strength = 0;
    e.setPhysics({ bodyCollisions: false });
    const core = e.getLevel().bodies[0].position;
    e.launchFrom(
      { x: core.x - 30, y: core.y + 220 },
      { x: approach ? 120 : 0, y: 20 },
    );
    e.launchFrom({ x: core.x + 30, y: core.y + 220 }, { x: 0, y: 20 });
  }, approach);
}
async function snapshot(page: Page) {
  return page.evaluate(() => {
    const s = (window as any).testParticleEngine.getSnapshot();
    return {
      physics: s.physics,
      particles: s.particles
        .filter((p: any) => p.alive)
        .map((p: any) => ({
          position: p.position,
          velocity: p.velocity,
          radius: p.radius,
        })),
    };
  });
}

test("nearby particles attract visibly before touching", async ({ page }) => {
  await boot(page);
  await options(page, true, false);
  await seedPair(page, false);
  await page.evaluate(() => {
    const particles = (window as any).testParticleEngine.getRenderSnapshot()
      .particles;
    particles[0].position.x -= 10;
    particles[1].position.x += 10;
  });
  await page.clock.runFor(500);
  const state = await snapshot(page);
  expect(state.particles).toHaveLength(2);
  const [a, b] = state.particles;
  const distance = Math.hypot(
    b.position.x - a.position.x,
    b.position.y - a.position.y,
  );
  expect(80 - distance).toBeGreaterThan(7);
  expect(distance).toBeGreaterThan(1.5 * (a.radius + b.radius));
});

test("interaction changes live trajectories while grouping stays off", async ({
  page,
}) => {
  await boot(page);
  await options(page, false, false);
  await seedPair(page, false);
  await page.clock.runFor(2000);
  const off = await snapshot(page);
  await options(page, true, false);
  await seedPair(page, false);
  await page.clock.runFor(2000);
  const on = await snapshot(page);
  expect(off.physics.planetGravity).toBe(false);
  expect(on.physics.planetGravity).toBe(true);
  expect(on.physics.planetCollisions).toBe("none");
  expect(off.particles).toHaveLength(2);
  expect(on.particles).toHaveLength(2);
  expect(
    on.particles[0].position.x - off.particles[0].position.x,
  ).toBeGreaterThan(10);
  expect(
    off.particles[1].position.x - on.particles[1].position.x,
  ).toBeGreaterThan(10);
});
test("grouping changes real impacts independently of mutual attraction", async ({
  page,
}) => {
  await boot(page);
  await options(page, false, false);
  await seedPair(page, true);
  await page.clock.runFor(1000);
  const off = await snapshot(page);
  await options(page, false, true);
  await seedPair(page, true);
  await page.clock.runFor(1000);
  const on = await snapshot(page);
  expect(on.physics.planetGravity).toBe(false);
  expect(on.physics.planetCollisions).toBe("soft");
  expect(off.particles).toHaveLength(2);
  expect(on.particles).toHaveLength(2);
  expect(off.particles[0].position.x).toBeGreaterThan(
    off.particles[1].position.x,
  );
  expect(off.particles[0].velocity.x).toBe(120);
  expect(off.particles[1].velocity.x).toBe(0);
  expect(on.particles[0].position.x).toBeLessThan(on.particles[1].position.x);
  expect(on.particles[1].position.x - on.particles[0].position.x).toBeCloseTo(
    on.particles[0].radius + on.particles[1].radius,
    6,
  );
  expect(on.particles[0].velocity.x).toBeCloseTo(60, 7);
  expect(on.particles[1].velocity.x).toBeCloseTo(60, 7);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.screenshot({
    path: "/private/tmp/orbit-particle-grouping-fixed.png",
  });
});

test("both switches let nearby moving particles gather into distinct touching surfaces", async ({
  page,
}) => {
  await boot(page);
  await options(page, true, true);
  await seedPair(page, false);
  await page.clock.runFor(2500);
  const state = await snapshot(page);
  expect(state.particles).toHaveLength(2);
  const [a, b] = state.particles;
  expect(
    Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y),
  ).toBeCloseTo(a.radius + b.radius, 5);
  expect(
    Math.hypot(b.velocity.x - a.velocity.x, b.velocity.y - a.velocity.y),
  ).toBeLessThan(5);
  const initialAngle = Math.atan2(
    b.position.y - a.position.y,
    b.position.x - a.position.x,
  );
  await page.clock.runFor(6000);
  const rotating = await snapshot(page);
  expect(rotating.particles).toHaveLength(2);
  const [p, q] = rotating.particles;
  const dx = q.position.x - p.position.x;
  const dy = q.position.y - p.position.y;
  const distance = Math.hypot(dx, dy);
  const omega =
    (dx * (q.velocity.y - p.velocity.y) - dy * (q.velocity.x - p.velocity.x)) /
    distance ** 2;
  expect(distance).toBeCloseTo(p.radius + q.radius, 4);
  expect(omega).toBeCloseTo(0.18, 3);
  expect(Math.abs(Math.atan2(dy, dx) - initialAngle)).toBeGreaterThan(0.5);
  await page.screenshot({
    path: "/private/tmp/orbit-particles-both-enabled.png",
  });
});
