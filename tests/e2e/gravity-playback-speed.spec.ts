import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { campaignBlueprint } from "../../src/gravity/campaign-design";
import { createState, fireFrom, step } from "../../src/gravity/simulation";
import {
  GRAVITY_SPEED_SCALE,
  GRAVITY_FIXED_STEP,
  gravityLaunchSpeed,
} from "../../src/gravity/physics";
import { fitGravityFrame } from "../../src/gravity/renderer";
import { worldToClient } from "../../src/render/coordinates";
import {
  gravityPullDistance,
  gravityPullFraction,
} from "../../src/gravity/input";
import { markTutorialSeen } from "./tutorial-fixture";

test("Gravity follows the 1.4x trajectory and restores normal pace after aiming", async ({
  page,
}) => {
  const viewport = { width: 1280, height: 800 };
  await page.setViewportSize(viewport);
  await page.addInitScript(markTutorialSeen);
  await page.addInitScript(() => {
    localStorage.setItem("orbit.theme.v1", "dark");
    const probe = window as any;
    let circle = { x: 0, y: 0 };
    const arc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function (
      x,
      y,
      r,
      start,
      end,
      anti,
    ) {
      circle = { x, y };
      return arc.call(this, x, y, r, start, end, anti);
    };
    const fill = CanvasRenderingContext2D.prototype.fill;
    CanvasRenderingContext2D.prototype.fill = function (...args: any[]) {
      if (
        this.canvas.classList.contains("scene-canvas") &&
        this.fillStyle === "#f5245c" &&
        this.globalAlpha === 1
      ) {
        const t = this.getTransform();
        const dpr =
          this.canvas.width / this.canvas.getBoundingClientRect().width;
        probe.pacePlanet = {
          x: (t.a * circle.x + t.c * circle.y + t.e) / dpr,
          y: (t.b * circle.x + t.d * circle.y + t.f) / dpr,
        };
      }
      return (fill as Function).apply(this, args);
    };
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  const path = process.env.PLAYWRIGHT_GAME_PATH ?? "/";
  await page.goto(`${path}?mode=gravity&seed=42`);
  await expect(page.getByLabel("Gravity orbital field")).toBeVisible();
  await page.clock.runFor(100);
  const level = campaignBlueprint(0);
  const shot = JSON.parse(
    readFileSync("src/gravity/campaign-witnesses.json", "utf8"),
  )["0"][0];
  level.launch = { ...shot.position };
  const { camera, area } = fitGravityFrame(
    level,
    viewport.width,
    viewport.height,
  );
  const project = (point: { x: number; y: number }) =>
    worldToClient(
      point,
      { left: area.x, top: area.y, width: area.width, height: area.height },
      camera,
    );
  const start = project(shot.position!);
  const reach =
    gravityPullDistance("mouse", viewport.width, viewport.height) *
    gravityPullFraction(shot.power);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(
    start.x - Math.cos(shot.angle) * reach,
    start.y - Math.sin(shot.angle) * reach,
  );
  await page.mouse.up();
  await expect(
    page.getByText("1 planet in motion", { exact: true }),
  ).toBeVisible();
  const expected = createState(level);
  fireFrom(expected, shot.position, {
    x: Math.cos(shot.angle) * gravityLaunchSpeed(shot.power),
    y: Math.sin(shot.angle) * gravityLaunchSpeed(shot.power),
  });
  let remainder = 0;
  const advance = async (aiming: boolean) => {
    remainder += GRAVITY_SPEED_SCALE * (aiming ? 0.65 : 1);
    while (remainder + 1e-9 >= GRAVITY_FIXED_STEP) {
      step(expected, GRAVITY_FIXED_STEP);
      remainder -= GRAVITY_FIXED_STEP;
    }
    await page.clock.runFor(1000);
    const actual = await page.evaluate(() => (window as any).pacePlanet);
    const position = project(expected.particles[0].position);
    expect(
      Math.hypot(actual.x - position.x, actual.y - position.y),
    ).toBeLessThan(4);
  };
  expect(GRAVITY_SPEED_SCALE).toBe(1.4);
  await advance(false);
  await page.mouse.move(1050, 350);
  await page.mouse.down();
  await page.mouse.move(990, 350);
  await advance(true);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await advance(false);
  expect(errors).toEqual([]);
});
