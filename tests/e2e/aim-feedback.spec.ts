import { expect, test } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";

for (const mode of ["gravity", "odessey"]) {
  test(`${mode} touch feedback only accompanies deliberate aiming and successful shooting`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage(),
      cdp = await context.newCDPSession(page);
    try {
      await page.addInitScript(markTutorialSeen);
      await page.addInitScript(() => {
        const probe = window as typeof window & { vibrations: number[] };
        probe.vibrations = [];
        Object.defineProperty(navigator, "vibrate", {
          value: (duration: number) => {
            probe.vibrations.push(duration);
            return true;
          },
        });
      });
      await page.goto("/?seed=42");
      await page.evaluate(async (fixtureMode) => {
        const { createElement } = (
          await import("/node_modules/.vite/deps/react.js")
        ).default;
        const { createRoot } = (
          await import("/node_modules/.vite/deps/react-dom_client.js")
        ).default;
        document.getElementById("root")!.style.display = "none";
        const mount = document.createElement("div");
        document.body.append(mount);
        if (fixtureMode === "gravity") {
          const { default: GravityGame } =
            await import("/src/gravity/GravityGame.tsx");
          const { newDraft, toGravityLevel } =
            await import("/src/gravity/creator/model.ts");
          const draft = newDraft();
          draft.bodies = [];
          draft.physics = { planetGravity: true, bodyCollisions: true };
          createRoot(mount).render(
            createElement(GravityGame, {
              customLevel: toGravityLevel(draft),
              onExit() {},
            }),
          );
        } else {
          const { OdesseyGame } = await import("/src/App.tsx");
          createRoot(mount).render(createElement(OdesseyGame));
        }
      }, mode);
      const field = page.getByLabel(
        mode === "gravity" ? "Gravity orbital field" : "Slingshot flight field",
      );
      await expect(field).toBeVisible();
      const vibrations = () =>
        page.evaluate(
          () => (window as typeof window & { vibrations: number[] }).vibrations,
        );
      const start = { id: 1, x: 80, y: 300 },
        end = { ...start, x: 30 };
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [start],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [start, { id: 2, x: 250, y: 300 }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [end, { id: 2, x: 280, y: 300 }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      expect(await vibrations()).toEqual([]);
      // Reset a pinch-modified view before making the deliberate shot.
      await page.keyboard.press("0");
      await page.waitForTimeout(320);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [start],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [end],
      });
      expect(await vibrations()).toEqual([6]);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      expect(await vibrations()).toEqual([6, 10]);
      await page.screenshot({
        path: `/private/tmp/orbit-${mode}-touch-feedback.png`,
      });
    } finally {
      await context.close();
    }
  });
}

test("Gravity Full prediction retains distant progress while aim and crowded live world change", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { GravityEngine } = await import("/src/gravity/engine.ts");
    const { LiveGravityPreview } = await import("/src/gravity/live-preview.ts");
    const { newDraft, toGravityLevel } =
      await import("/src/gravity/creator/model.ts");
    const draft = newDraft();
    draft.bodies = [];
    draft.physics = {
      planetGravity: true,
      planetCollisions: "none",
      bodyCollisions: false,
      escapeDistance: 100000,
    };
    const engine = new GravityEngine(42, toGravityLevel(draft)),
      preview = new LiveGravityPreview();
    engine.setTimeScale(1);
    engine.setAiming(true);
    for (let i = 0; i < 96; i++)
      engine.launchFrom(
        { x: 100 + (i % 12) * 60, y: 100 + Math.floor(i / 12) * 90 },
        { x: i % 4, y: i % 3 },
      );
    engine.setAiming(true);
    let finished = 0,
      full = 0,
      prefix = 0,
      emptyFrames = 0,
      maxPoints = 0;
    const slices: number[] = [];
    const jobs: {
      seconds: number;
      job: ReturnType<typeof engine.beginPrediction>;
    }[] = [];
    for (let frame = 0; frame < 300; frame++) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      engine.update(1 / 60);
      engine.setLaunch(
        { x: 60, y: 750 },
        { angle: -0.1 + Math.sin(frame / 20) * 0.15, power: 0.3 },
      );
      const start = performance.now();
      const path = preview.update(
        (seconds) => {
          const job = engine.beginPrediction(seconds);
          jobs.push({ seconds, job });
          if (seconds === 20) full++;
          else prefix++;
          return job;
        },
        20,
        1 / 60,
        engine.getRenderSnapshot().aim,
      );
      slices.push(performance.now() - start);
      if (frame > 2 && path.length < 2) emptyFrames++;
      maxPoints = Math.max(maxPoints, path.length);
    }
    finished = jobs.filter(
      ({ seconds, job }) => seconds === 20 && job?.done,
    ).length;
    preview.cancel();
    return {
      finished,
      full,
      prefix,
      emptyFrames,
      maxPoints,
      meanSlice: slices.reduce((sum, n) => sum + n, 0) / slices.length,
      maxSlice: Math.max(...slices),
    };
  });
  console.log("Live Full assist crowd benchmark", result);
  expect(result.finished).toBeGreaterThan(0);
  expect(result.prefix).toBeGreaterThanOrEqual(8);
  expect(result.emptyFrames).toBe(0);
  expect(result.maxPoints).toBe(601);
  expect(result.meanSlice).toBeLessThan(10);
  expect(result.maxSlice).toBeLessThan(45);
});
