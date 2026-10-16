import { test, expect, type Page } from "@playwright/test";

type Mode = "odessey" | "gravity";
type Point = { x: number; y: number };
type Input = {
  start: (point: Point) => Promise<void>;
  move: (point: Point) => Promise<void>;
  end: () => Promise<void>;
  tap: (point: Point) => Promise<void>;
};

async function inputFor(page: Page, touch = false): Promise<Input> {
  if (!touch)
    return {
      start: async (p) => {
        await page.mouse.move(p.x, p.y);
        await page.mouse.down();
      },
      move: async (p) => {
        await page.mouse.move(p.x, p.y, { steps: 5 });
      },
      end: async () => {
        await page.mouse.up();
      },
      tap: async (p) => {
        await page.mouse.click(p.x, p.y);
      },
    };
  const cdp = await page.context().newCDPSession(page);
  const send = async (type: string, p?: Point) => {
    await cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: p ? [{ ...p, id: 1 }] : [],
    });
  };
  return {
    start: (p) => send("touchStart", p),
    move: (p) => send("touchMove", p),
    end: () => send("touchEnd"),
    tap: async (p) => {
      await send("touchStart", p);
      await page.clock.runFor(30);
      await send("touchEnd");
    },
  };
}

async function boot(page: Page, mode: Mode) {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto(`/?mode=${mode}&seed=42`);
  await page.clock.runFor(200);
  await expect(
    page.getByRole("dialog", {
      name: mode === "odessey" ? "How to play Odessey" : "How to play Gravity",
    }),
  ).toBeVisible();
}

async function guide(page: Page) {
  return page.locator(".practice-pull-guide line").evaluate((line) => ({
    start: {
      x: Number(line.getAttribute("x1")),
      y: Number(line.getAttribute("y1")),
    },
    end: {
      x: Number(line.getAttribute("x2")),
      y: Number(line.getAttribute("y2")),
    },
  }));
}

async function pullGuide(page: Page, input: Input) {
  await page.clock.runFor(1000);
  const points = await guide(page);
  const viewport = page.viewportSize()!;
  for (const p of [points.start, points.end]) {
    expect(p.x).toBeGreaterThan(8);
    expect(p.x).toBeLessThan(viewport.width - 8);
    expect(p.y).toBeGreaterThan(8);
    expect(p.y).toBeLessThan(viewport.height - 8);
  }
  await input.start(points.start);
  await input.move(points.end);
  await page.clock.runFor(50);
  await input.end();
  await page.clock.runFor(100);
}

async function ready(page: Page, name = "Continue", budget = 25000) {
  const button = page.getByRole("button", { name, exact: true });
  for (
    let elapsed = 0;
    elapsed < budget && !(await button.isEnabled());
    elapsed += 250
  )
    await page.clock.runFor(250);
  await expect(button).toBeEnabled();
}

async function advance(page: Page, next: string) {
  await ready(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.clock.runFor(400);
  await expect(page.locator(".walkthrough")).toHaveAttribute("data-step", next);
}

async function finish(page: Page, mode: Mode) {
  await ready(page, "Start playing");
  await page
    .getByRole("button", { name: "Start playing", exact: true })
    .click();
  await page.clock.runFor(50);
  await expect(page.locator(".walkthrough")).toHaveCount(0);
  expect(
    await page.evaluate(
      (mode) => localStorage.getItem(`orbit.walkthrough.${mode}.v1`),
      mode,
    ),
  ).toBe("complete");
  await expect(
    page.getByLabel(
      mode === "odessey" ? "Slingshot flight field" : "Gravity orbital field",
    ),
  ).toBeFocused();
}

async function introductions(page: Page, mode: Mode) {
  const next =
    mode === "odessey"
      ? ["forces", "checkpoint", "split", "launch"]
      : ["forces", "orbit", "multiple", "launch"];
  for (const step of next) {
    await expect(page.locator(".practice-pull-guide")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Continue", exact: true }),
    ).toBeEnabled();
    await advance(page, step);
  }
  await expect(
    page.getByRole("button", {
      name: mode === "odessey" ? "Continue" : "Start playing",
      exact: true,
    }),
  ).toBeDisabled();
  await page.clock.runFor(1000);
  await expect(
    page.getByLabel(`${mode === "odessey" ? "Odessey" : "Gravity"} practice field`),
  ).toHaveAttribute("aria-disabled", "false");
}

async function finishLessons(page: Page, input: Input, mode: Mode) {
  await expect(page.locator(".walkthrough-outline")).toHaveCount(0);
  if (mode === "odessey") {
    await expect(
      page.locator(".practice-solution-path").first(),
    ).toBeAttached();
    await pullGuide(page, input);
    await ready(page);
    await advance(page, "practice-split");
    await page.clock.runFor(1000);
    await expect(page.locator(".practice-mode-indicator")).toContainText(
      "Single",
    );
    await expect(page.locator(".practice-pull-guide")).toHaveCount(0);
    await expect(page.locator(".practice-solution-path")).toHaveCount(0);
    const bounds = (await page.getByLabel("Odessey practice field").boundingBox())!;
    const point = {
      x: bounds.x + bounds.width * 0.25,
      y: bounds.y + bounds.height * 0.28,
    };
    await input.start(point);
    await input.move({ x: point.x + 30, y: point.y });
    await input.end();
    await page.getByLabel("Odessey practice field").focus();
    await page.keyboard.press("Space");
    await page.clock.runFor(100);
    await expect(page.locator(".practice-mode-indicator")).toContainText(
      "Single",
    );
    await expect(
      page.getByRole("button", { name: "Start playing" }),
    ).toBeDisabled();
    await input.tap(point);
    await page.clock.runFor(80);
    await input.tap(point);
    await page.clock.runFor(1000);
    await expect(page.locator(".practice-mode-indicator")).toContainText(
      "Split ready",
    );
    await expect(page.getByLabel("Odessey practice field")).toHaveAttribute(
      "aria-disabled",
      "false",
    );
    await expect(page.locator(".practice-solution-path")).not.toHaveCount(0);
    await page.screenshot({
      path: "/private/tmp/orbit-tutorial-split-ready.png",
    });
    await pullGuide(page, input);
    for (
      let elapsed = 0;
      elapsed < 25000 &&
      !(await page.getByRole("status").innerText()).includes("Tap now");
      elapsed += 50
    )
      await page.clock.runFor(50);
    await expect(page.getByRole("status")).toContainText("Tap now");
    await input.tap(point);
  } else await pullGuide(page, input);
  await ready(page, "Start playing", 25000);
}

test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed())
    await page
      .screenshot({
        path: `/private/tmp/orbit-interactive-tutorial-${info.title.replace(/[^a-z0-9]+/gi, "-")}-failure.png`,
      })
      .catch(() => {});
});

for (const mode of ["odessey"] as ("odessey" | "gravity")[])
  for (const touch of [false, true])
    test(`${mode} completes authored practice using ${touch ? "touch" : "mouse"} launch`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: touch
          ? { width: 390, height: 844 }
          : { width: 1440, height: 900 },
        hasTouch: touch,
        isMobile: touch,
        reducedMotion: touch ? "reduce" : "no-preference",
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      try {
        await boot(page, mode);
        if (mode === "odessey" && !touch) {
          await page.clock.runFor(100);
          await page.screenshot({
            path: "/private/tmp/orbit-tutorial-intro-pulse-300ms.png",
          });
          await page.clock.runFor(600);
          await page.screenshot({
            path: "/private/tmp/orbit-tutorial-intro-pulse-900ms.png",
          });
        }
        await expect(
          page.getByRole("button", { name: /pause practice|resume practice/i }),
        ).toHaveCount(0);
        await page
          .getByLabel(`${mode === "odessey" ? "Odessey" : "Gravity"} practice field`)
          .focus();
        await page.keyboard.press("Space");
        await introductions(page, mode);
        const input = await inputFor(page, touch);
        await page.clock.runFor(500); // Let the smooth guide transition settle.
        const initial = await guide(page);
        if (touch) {
          await input.start(initial.start);
          await input.move(initial.end);
          await page.setViewportSize({ width: 844, height: 390 });
          await page.clock.runFor(100);
          await input.end();
          await page.clock.runFor(100);
          await expect(
            page.getByRole("button", {
              name: mode === "odessey" ? "Continue" : "Start playing",
              exact: true,
            }),
          ).toBeDisabled();
          await page.setViewportSize({ width: 390, height: 844 });
          await page.clock.runFor(1000);
        }
        await finishLessons(page, input, mode);
        await page.screenshot({
          path: `/private/tmp/orbit-interactive-tutorial-${mode}-${touch ? "touch" : "desktop"}-final.png`,
        });
        await finish(page, mode);
        await page.reload();
        await page.clock.runFor(100);
        await expect(page.locator(".walkthrough")).toHaveCount(0);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });

for (const mode of ["odessey"] as ("odessey" | "gravity")[])
  test(`${mode} practice replay freezes the live attempt and returns it intact`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem("orbit.walkthrough.odessey.v1", "complete");
      localStorage.setItem("orbit.walkthrough.gravity.v1", "complete");
    });
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.goto(`/?mode=${mode}&seed=42`);
    await page.clock.runFor(100);
    const live = page.getByLabel(
      mode === "odessey" ? "Slingshot flight field" : "Gravity orbital field",
    );
    await page.mouse.move(300, 450);
    await page.mouse.down();
    await page.mouse.move(460, 450, { steps: 5 });
    await page.mouse.up();
    await page.clock.runFor(mode === "odessey" ? 2137 : 150);
    const beforeStatus = await page
      .locator(".game-surface [role=status]")
      .innerText();
    expect(beforeStatus).toMatch(
      mode === "odessey" ? /flight|Offscreen/ : /1 \/ 12 projectiles/,
    );
    const countdown =
      mode === "odessey"
        ? await page.locator(".offscreen-countdown").innerText()
        : null;
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.clock.runFor(100);
    const beforePixels = await live.evaluate((canvas) =>
      (canvas as HTMLCanvasElement).toDataURL(),
    );
    await page
      .getByRole("button", { name: "How to play", exact: true })
      .click();
    await page.clock.runFor(150);
    await introductions(page, mode);
    await pullGuide(page, await inputFor(page));
    await page.clock.runFor(7500);
    await page.keyboard.press("r");
    expect(
      await live.evaluate((canvas) =>
        (canvas as HTMLCanvasElement).toDataURL(),
      ),
    ).toBe(beforePixels);
    await page.screenshot({
      path: `/private/tmp/orbit-interactive-tutorial-${mode}-live-replay.png`,
    });
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await page.clock.runFor(50);
    await expect(
      page.getByRole("dialog", { name: "Paused", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await page.clock.runFor(16);
    await expect(page.locator(".game-surface [role=status]")).toHaveText(
      beforeStatus,
    );
    if (countdown)
      await expect(page.locator(".offscreen-countdown")).toHaveText(countdown);
  });
