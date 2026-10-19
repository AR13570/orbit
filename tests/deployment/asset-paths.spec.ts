import { expect, test } from "@playwright/test";
import { markTutorialSeen } from "../e2e/tutorial-fixture";

for (const device of [
  { width: 1280, height: 800, touch: false },
  { width: 390, height: 844, touch: true },
]) {
  test.describe(`${device.width}x${device.height} production deployment`, () => {
    test.use({
      viewport: device,
      hasTouch: device.touch,
      isMobile: device.touch,
    });
    test("loads all assets and both games under /orbit without relying on portfolio root assets", async ({
      page,
      request,
    }) => {
      const errors: string[] = [];
      const failures: string[] = [];
      const rootRequests: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (response) => {
        if (response.status() >= 400) failures.push(response.url());
      });
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        const path = url.pathname;
        if (path === "/orbit") {
          // The portfolio serves index.html at /orbit without a redirect.
          // Vite preview requires /orbit/, so emulate only that HTML mapping.
          url.pathname = "/orbit/";
          await route.fulfill({
            response: await route.fetch({ url: url.toString() }),
          });
          return;
        }
        if (
          /^\/(assets\/|fonts\/|orbit-mark\.svg|orbit\.svg|favicon\.ico)/.test(
            path,
          )
        ) {
          rootRequests.push(path);
          await route.abort();
        } else await route.continue();
      });
      await page.addInitScript(markTutorialSeen);
      await page.goto("/orbit");
      await expect(page.locator(".home-screen")).toBeVisible();
      const logo = page.locator(".home-brand img");
      await expect(logo).toHaveAttribute("src", "/orbit/orbit-mark.svg");
      await expect
        .poll(() =>
          logo.evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
          ),
        )
        .toBe(true);
      expect(
        await page.evaluate(async () => {
          await document.fonts.load('16px "Righteous"');
          return document.fonts.check('16px "Righteous"');
        }),
      ).toBe(true);
      const assets = await page.evaluate(() => [
        ...Array.from(
          document.querySelectorAll<HTMLLinkElement>(
            'link[rel="icon"], link[rel="preload"], link[rel="stylesheet"]',
          ),
          (link) => link.href,
        ),
        ...Array.from(
          document.querySelectorAll<HTMLScriptElement>("script[src]"),
          (script) => script.src,
        ),
      ]);
      for (const url of assets) {
        expect(new URL(url).pathname).toMatch(/^\/orbit\//);
        const response = await request.get(url);
        expect(response.ok(), url).toBe(true);
        expect(response.headers()["content-type"], url).not.toContain(
          "text/html",
        );
      }
      const fontRequests = await page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .map((entry) => new URL(entry.name).pathname)
          .filter((path) => path.endsWith(".ttf")),
      );
      expect(fontRequests).toContain("/orbit/fonts/Righteous-Regular.ttf");
      await expect(page.locator(".home-title-letter").last()).toHaveCSS(
        "opacity",
        "1",
      );
      await expect(page.locator(".home-mode").first()).toHaveCSS(
        "opacity",
        "1",
      );
      await page.screenshot({
        path: `/private/tmp/orbit-subpath-home-${device.width}.png`,
      });
      for (const mode of ["Gravity", "Odessey"]) {
        await page
          .getByRole("button", { name: `Play ${mode}`, exact: true })
          .click();
        await expect(
          page.getByLabel(
            mode === "Gravity"
              ? "Gravity orbital field"
              : "Slingshot flight field",
          ),
        ).toBeVisible();
        const headerLogo = page.locator(".game-header-mark");
        await expect(headerLogo).toHaveAttribute(
          "src",
          "/orbit/orbit-mark.svg",
        );
        await expect
          .poll(() =>
            headerLogo.evaluate(
              (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
            ),
          )
          .toBe(true);
        expect(new URL(page.url()).pathname).toMatch(/^\/orbit\/?$/);
        await page.reload();
        await expect(headerLogo).toBeVisible();
        await page
          .getByRole("button", { name: "Back to main menu", exact: true })
          .click();
      }
      await page
        .getByRole("button", { name: "Gravity creator", exact: true })
        .click();
      await expect(
        page.locator(".creator-actions .creator-primary"),
      ).toBeVisible();
      expect(rootRequests).toEqual([]);
      expect(failures).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}
