import { test, expect } from "@playwright/test";
import { OrbitEngine } from "../../src/game/engine";
import { GravityEngine } from "../../src/gravity/engine";
import {
  contentBounds,
  fitFieldCamera,
  worldToClient,
} from "../../src/render/coordinates";
import { fitGravityFrame } from "../../src/gravity/renderer";

for (const viewport of [
  { width: 390, height: 844, seed: 42 },
  { width: 600, height: 960, seed: 42 },
  { width: 768, height: 1024, seed: 42 },
  { width: 320, height: 568, seed: 17 },
])
  for (const mode of ["zen", "gravity"] as const) {
    test(`${mode} mobile launcher has real full-power room and rotation preserves play ${viewport.width}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport,
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      try {
        await page.clock.install();
        await page.clock.pauseAt(new Date());
        await page.goto(`/?mode=${mode}&seed=${viewport.seed}`);
        await page.clock.runFor(100);
        const canvas = page.getByLabel(
          mode === "zen" ? "Slingshot flight field" : "Gravity orbital field",
        );
        const zen = new OrbitEngine(viewport.seed).getSnapshot().sector;
        const gravity = new GravityEngine(viewport.seed).getSnapshot().level;
        function framing(width: number, height: number) {
          if (mode === "gravity") {
            const { camera, area } = fitGravityFrame(
              gravity,
              width,
              height,
              true,
            );
            return {
              camera,
              point: worldToClient(
                gravity.launch,
                {
                  left: area.x,
                  top: area.y,
                  width: area.width,
                  height: area.height,
                },
                camera,
              ),
            };
          }
          const bounds = contentBounds([
            ...zen.bodies.map((body) => ({
              position: body.position,
              radius: body.radius + 24,
            })),
            { position: zen.launch, radius: 0 },
            {
              position: zen.checkpoint.position,
              radius: zen.checkpoint.radius + 12,
            },
          ]);
          const camera = fitFieldCamera(
            bounds,
            zen.launch,
            width,
            height,
            undefined,
            zen.checkpoint,
            true,
          );
          return {
            camera,
            point: worldToClient(
              zen.launch,
              { left: 0, top: 0, width, height },
              camera,
            ),
          };
        }
        const portrait = framing(viewport.width, viewport.height);
        expect(portrait.point.x).toBeGreaterThanOrEqual(90 - 1e-8);
        expect(portrait.point.x - 72).toBeGreaterThanOrEqual(17);
        await page.screenshot({
          path: `/private/tmp/orbit-mobile-${mode}-portrait-${viewport.width}.png`,
        });
        const cdp = await context.newCDPSession(page);
        async function touch(
          type: "touchStart" | "touchMove" | "touchEnd",
          point?: { x: number; y: number },
        ) {
          await cdp.send("Input.dispatchTouchEvent", {
            type,
            touchPoints: point ? [{ ...point, id: 1 }] : [],
          });
        }
        // Pull from the actual visible launcher, rather than a spacious remote anchor.
        await touch("touchStart", portrait.point);
        await touch("touchMove", {
          x: portrait.point.x - 72,
          y: portrait.point.y,
        });
        await page.clock.runFor(50);
        await page.screenshot({
          path: `/private/tmp/orbit-mobile-${mode}-full-pull-${viewport.width}.png`,
        });
        await touch("touchEnd");
        await expect(page.getByRole("status")).toHaveText(
          mode === "zen" ? "In flight" : "1 / 12 projectiles in flight",
        );
        const rotated = { width: viewport.height, height: viewport.width };
        await page.setViewportSize(rotated);
        await page.clock.runFor(16);
        await expect(canvas).toHaveJSProperty("width", rotated.width * 2);
        await expect(page.getByRole("status")).toHaveText(
          mode === "zen" ? "In flight" : "1 / 12 projectiles in flight",
        );
        await page.getByRole("button", { name: "Reset level (R)" }).tap();
        await page.clock.runFor(750);
        const landscape = framing(rotated.width, rotated.height);
        if (viewport.width === 390)
          expect(landscape.camera.scale).toBeGreaterThan(portrait.camera.scale);
        expect(landscape.point.x - 72).toBeGreaterThan(16);
        await page.screenshot({
          path: `/private/tmp/orbit-mobile-${mode}-landscape-${viewport.width}.png`,
        });
        // A rotation while holding a pull must not release a stale shot.
        await touch("touchStart", landscape.point);
        await touch("touchMove", {
          x: landscape.point.x - 72,
          y: landscape.point.y,
        });
        await page.setViewportSize(viewport);
        await page.clock.runFor(50);
        await touch("touchEnd");
        await expect(page.getByRole("status")).toHaveText(
          mode === "zen" ? "Ready to pull" : "0 / 12 projectiles in flight",
        );
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }
