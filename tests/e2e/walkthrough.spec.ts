import { test, expect, type Page, type CDPSession } from "@playwright/test";
async function touch(
  cdp: CDPSession,
  type: "touchStart" | "touchMove" | "touchEnd",
  point?: { x: number; y: number },
) {
  await cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: point ? [{ ...point, id: 1 }] : [],
  });
}
async function guide(page: Page) {
  const line = page.locator(".practice-pull-guide line");
  await expect(line).toBeAttached();
  await expect(page.locator(".walkthrough-spotlight")).toBeVisible();
  return {
    start: {
      x: Number(await line.getAttribute("x1")),
      y: Number(await line.getAttribute("y1")),
    },
    end: {
      x: Number(await line.getAttribute("x2")),
      y: Number(await line.getAttribute("y2")),
    },
  };
}
async function drag(page: Page, cdp: CDPSession, capture?: string) {
  await page.clock.runFor(1000);
  const { start, end } = await guide(page);
  await touch(cdp, "touchStart", start);
  for (let n = 1; n <= 8; n++)
    await touch(cdp, "touchMove", {
      x: start.x + ((end.x - start.x) * n) / 8,
      y: start.y + ((end.y - start.y) * n) / 8,
    });
  await page.clock.runFor(80);
  if (capture) await page.screenshot({ path: capture });
  await touch(cdp, "touchEnd");
  await page.clock.runFor(100);
}
async function ready(page: Page, name = "Continue") {
  const button = page.getByRole("button", { name, exact: true });
  for (let n = 0; n < 250 && (await button.isDisabled()); n++)
    await page.clock.runFor(100);
  await expect(button).toBeEnabled();
}
async function introductions(page: Page, mode = "zen") {
  for (let n = 0; n < 4; n++) {
    await expect(page.locator(".practice-pull-guide")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Continue", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.clock.runFor(350);
  }
  await expect(page.locator(".walkthrough")).toHaveAttribute(
    "data-step",
    "launch",
  );
  await expect(
    page.getByRole("button", {
      name: mode === "zen" ? "Continue" : "Start playing",
      exact: true,
    }),
  ).toBeDisabled();
  await page.clock.runFor(1000);
  await expect(
    page.getByLabel(`${mode === "zen" ? "Zen" : "Gravity"} practice field`),
  ).toHaveAttribute("aria-disabled", "false");
}
async function learn(
  page: Page,
  cdp: CDPSession,
  mode: string,
  prefix?: string,
) {
  await introductions(page, mode);
  await expect(page.locator(".walkthrough-outline")).toHaveCount(0);
  if (mode === "zen")
    await expect(
      page.locator(".practice-solution-path").first(),
    ).toBeAttached();
  await page.clock.runFor(500);
  await drag(page, cdp, prefix && `${prefix}-launch-aim.png`);
  if (mode === "zen") {
    await ready(page);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.clock.runFor(700);
    await expect(page.locator(".walkthrough")).toHaveAttribute(
      "data-step",
      "practice-split",
    );
    await page.clock.runFor(500);
    await expect(page.locator(".practice-mode-indicator")).toContainText(
      "Single",
    );
    await expect(page.locator(".practice-pull-guide")).toHaveCount(0);
    await expect(page.locator(".practice-solution-path")).toHaveCount(0);
    const bounds = (await page.getByLabel("Zen practice field").boundingBox())!;
    const point = {
      x: bounds.x + bounds.width * 0.25,
      y: bounds.y + bounds.height * 0.28,
    };
    await touch(cdp, "touchStart", point);
    await touch(cdp, "touchEnd");
    await page.clock.runFor(80);
    await touch(cdp, "touchStart", point);
    await touch(cdp, "touchEnd");
    await page.clock.runFor(1000);
    await expect(page.locator(".practice-mode-indicator")).toContainText(
      "Split ready",
    );
    await expect(page.getByLabel("Zen practice field")).toHaveAttribute(
      "aria-disabled",
      "false",
    );
    await drag(page, cdp);
    for (
      let n = 0;
      n < 500 &&
      !(await page.getByRole("status").innerText()).includes("Tap now");
      n++
    )
      await page.clock.runFor(50);
    await expect(page.getByRole("status")).toContainText("Tap now");
    await touch(cdp, "touchStart", point);
    await touch(cdp, "touchEnd");
  }
  await ready(page, "Start playing");
  if (prefix) await page.screenshot({ path: `${prefix}-launch.png` });
  await page
    .getByRole("button", { name: "Start playing", exact: true })
    .click();
  await page.clock.runFor(350);
}
for (const mode of ["zen", "gravity"] as const)
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 320, height: 568 },
    { width: 768, height: 1024 },
  ])
    test(`${mode} learns by real touch actions in one stable practice sky ${viewport.width}x${viewport.height}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport,
        hasTouch: true,
        isMobile: true,
        reducedMotion: viewport.width === 320 ? "reduce" : "no-preference",
      });
      const page = await context.newPage(),
        cdp = await context.newCDPSession(page);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      try {
        await page.clock.install();
        await page.clock.pauseAt(new Date());
        await page.goto(`/?mode=${mode}&seed=42`);
        await page.clock.runFor(200);
        await expect(
          page.getByRole("button", { name: "Continue", exact: true }),
        ).toBeEnabled();
        const field = page.getByLabel(
          `${mode === "zen" ? "Zen" : "Gravity"} practice field`,
        );
        await field.focus();
        await expect(field).toBeFocused();
        await expect(page.locator(".game-surface")).toHaveAttribute(
          "inert",
          "",
        );
        if (viewport.width === 320)
          expect(
            await page
              .locator(".walkthrough-copy")
              .evaluate((el) => getComputedStyle(el).transitionDuration),
          ).toBe("0s");
        await learn(
          page,
          cdp,
          mode,
          `/private/tmp/orbit-interactive-tutorial-${mode}-${viewport.width}x${viewport.height}`,
        );
        await expect(page.locator(".walkthrough")).toHaveCount(0);
        expect(
          await page.evaluate(
            (mode) => localStorage.getItem(`orbit.walkthrough.${mode}.v1`),
            mode,
          ),
        ).toBe("complete");
        await page.reload();
        await page.clock.runFor(100);
        await expect(page.locator(".walkthrough")).toHaveCount(0);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
test("passive introductions ignore accidental input before the capture lessons", async ({
  page,
}) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto("/?mode=zen&seed=42");
  await page.clock.runFor(200);
  await page.getByLabel("Zen practice field").focus();
  await page.keyboard.press("Space");
  await page.mouse.move(150, 200);
  await page.mouse.down();
  await page.mouse.move(220, 200);
  await page.mouse.up();
  await introductions(page);
  await page.getByLabel("Zen practice field").focus();
  await page.keyboard.press("Space");
  await page.clock.runFor(100);
  await ready(page);
  await expect(page.locator(".walkthrough")).toHaveAttribute(
    "data-step",
    "launch",
  );
});
test("background and resize cancel held input and practice resumes automatically", async ({
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
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.goto("/?mode=zen&seed=42");
    await page.clock.runFor(200);
    await introductions(page);
    let points = await guide(page);
    await touch(cdp, "touchStart", points.start);
    await touch(cdp, "touchMove", points.end);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.clock.runFor(100);
    await touch(cdp, "touchEnd");
    await expect(
      page.getByRole("button", { name: "Continue", exact: true }),
    ).toBeDisabled();
    points = await guide(page);
    await touch(cdp, "touchStart", points.start);
    await touch(cdp, "touchMove", points.end);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.clock.runFor(4000);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => false,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await touch(cdp, "touchEnd");
    await page.clock.runFor(100);
    await expect(
      page.getByRole("button", { name: /pause practice|resume practice/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Continue", exact: true }),
    ).toBeDisabled();
    await drag(page, cdp);
    await page.getByLabel("Zen practice field").focus();
    await page.keyboard.press("p");
    await ready(page);
    await expect(
      page.getByRole("button", { name: /pause practice|resume practice/i }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
});
for (const mode of ["zen", "gravity"] as const)
  test(`${mode} isolated practice preserves an existing live flight`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      hasTouch: true,
      isMobile: true,
    });
    await context.addInitScript(() => {
      localStorage.setItem("orbit.walkthrough.zen.v1", "complete");
      localStorage.setItem("orbit.walkthrough.gravity.v1", "complete");
    });
    const page = await context.newPage(),
      cdp = await context.newCDPSession(page);
    try {
      await page.clock.install();
      await page.clock.pauseAt(new Date());
      await page.goto(`/?mode=${mode}&seed=42`);
      await page.clock.runFor(100);
      await touch(cdp, "touchStart", { x: 750, y: 450 });
      await touch(cdp, "touchMove", { x: 822, y: 450 });
      await touch(cdp, "touchEnd");
      await page.clock.runFor(800);
      const before = await page.getByRole("status").textContent();
      const countdown =
        mode === "zen"
          ? await page.locator(".offscreen-countdown").textContent()
          : null;
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page
        .getByRole("button", { name: "How to play", exact: true })
        .click();
      await page.clock.runFor(200);
      await page.clock.runFor(12000);
      await learn(page, cdp, mode);
      await expect(page.getByRole("status")).toHaveText(before!);
      if (countdown)
        await expect(page.locator(".offscreen-countdown")).toHaveText(
          countdown,
        );
    } finally {
      await context.close();
    }
  });
test("Skip survives a mode remount when storage reads work but writes fail", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Quota", "QuotaExceededError");
    };
  });
  await page.goto("/?mode=zen&seed=42");
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Choose mode", exact: true }).click();
  await page.getByRole("button", { name: /Zen/ }).click();
  await expect(page.locator(".walkthrough")).toHaveCount(0);
});
test("Escape saves dismissal independently for both modes", async ({
  page,
}) => {
  await page.goto("/?mode=zen&seed=42");
  await expect(
    page.getByRole("dialog", { name: "How to play Zen" }),
  ).toBeVisible();
  await page.getByRole("heading", { name: "Your ship" }).focus();
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(() => localStorage.getItem("orbit.walkthrough.zen.v1")),
  ).toBe("skipped");
  await page.goto("/?mode=gravity&seed=42");
  await expect(
    page.getByRole("dialog", { name: "How to play Gravity" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.reload();
  await expect(page.locator(".walkthrough")).toHaveCount(0);
});

test("unavailable storage still permits dismissal and same-page mode revisits", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Denied", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Denied", "SecurityError");
    };
  });
  await page.goto("/?mode=gravity&seed=42");
  await expect(
    page.getByRole("dialog", { name: "How to play Gravity" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Choose mode", exact: true }).click();
  await page.getByRole("button", { name: /^Gravity Build/ }).click();
  await expect(page.locator(".walkthrough")).toHaveCount(0);
});

test("force introduction keeps body cores uniform during emphasis", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto("/?mode=zen&seed=42");
  await page.clock.runFor(900);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.clock.runFor(425);
  await expect(page.locator(".walkthrough")).toHaveAttribute(
    "data-step",
    "forces",
  );
  await expect(
    page.locator(".walkthrough-spotlight mask, .walkthrough-spotlight rect"),
  ).toHaveCount(0);
  await page.screenshot({
    path: "/private/tmp/orbit-tutorial-forces-midpulse.png",
  });
  await page.clock.runFor(650);
  await page.screenshot({
    path: "/private/tmp/orbit-tutorial-forces-settled.png",
  });
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeEnabled();
  expect(errors).toEqual([]);
});
