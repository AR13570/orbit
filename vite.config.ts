import { defineConfig } from "vitest/config";
export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? "/orbit/" : "/",
  server: { host: "0.0.0.0", port: 5173 },
  test: { environment: "jsdom", include: ["tests/**/*.test.{ts,tsx}"] },
}));
