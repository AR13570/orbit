import { expect, type Page } from "@playwright/test";

/** Observe a real body's CSS-pixel radius from the rendered canvas, with no app state changes. */
export async function installZoomProbe(page: Page) {
  await page.addInitScript(() => {
    const probe = window as typeof window & {
      renderedBodyRadius?: number;
      renderedBodyCenter?: { x: number; y: number };
    };
    let captured = false;
    const fillRect = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
      if (this.canvas.classList.contains("scene-canvas") && x === 0 && y === 0)
        captured = false;
      return fillRect.call(this, x, y, w, h);
    };
    const arc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function (
      x,
      y,
      r,
      start,
      end,
      anti,
    ) {
      if (
        !captured &&
        this.canvas.classList.contains("scene-canvas") &&
        ["#303943", "#a95724", "#dedde5", "#8f4925"].includes(
          String(this.fillStyle),
        )
      ) {
        const transform = this.getTransform();
        const pixelRatio =
          this.canvas.width / this.canvas.getBoundingClientRect().width;
        probe.renderedBodyRadius =
          (r * Math.hypot(transform.a, transform.b)) / pixelRatio;
        const rect = this.canvas.getBoundingClientRect();
        probe.renderedBodyCenter = {
          x:
            rect.left +
            (transform.a * x + transform.c * y + transform.e) / pixelRatio,
          y:
            rect.top +
            (transform.b * x + transform.d * y + transform.f) / pixelRatio,
        };
        captured = true;
      }
      return arc.call(this, x, y, r, start, end, anti);
    };
  });
}

export async function bodyRadius(page: Page) {
  await page.clock.runFor(32);
  const radius = await page.evaluate(
    () =>
      (window as typeof window & { renderedBodyRadius?: number })
        .renderedBodyRadius,
  );
  expect(radius).toBeGreaterThan(0);
  return radius!;
}

export async function expectRenderedZoom(
  page: Page,
  baseline: number,
  zoom: number,
) {
  expect((await bodyRadius(page)) / baseline).toBeCloseTo(zoom, 3);
}

export async function expectNoZoomControls(page: Page) {
  await expect(
    page.getByRole("button", { name: /^(Zoom in|Zoom out|Reset zoom)$/ }),
  ).toHaveCount(0);
  await expect(page.getByRole("group", { name: "View zoom" })).toHaveCount(0);
  await expect(page.locator(".gameplay-zoom-controls")).toHaveCount(0);
}

export async function resetZoom(page: Page, fieldName: string) {
  await page.getByLabel(fieldName).focus();
  await page.keyboard.press("0");
  await page.clock.runFor(350);
}

export async function wheelZoom(
  page: Page,
  factor: number,
  point: { x: number; y: number },
) {
  await page.mouse.move(point.x, point.y);
  // The game caps each wheel event at 1000 units, so split larger ratios.
  const delta = -Math.log(factor) / 0.0012;
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / 900));
  for (let step = 0; step < steps; step++) {
    await page.mouse.wheel(0, delta / steps);
    await page.clock.runFor(32);
  }
}
