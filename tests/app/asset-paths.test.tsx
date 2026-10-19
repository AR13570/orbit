import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import GameHeader from "../../src/components/GameHeader";
import ModeChooser from "../../src/ModeChooser";

vi.mock("../../src/home/ModePreview", () => ({ default: () => null }));
vi.mock("gsap", () => ({
  gsap: { matchMedia: () => ({ add() {}, revert() {} }) },
}));
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

it.each(["/", "/orbit/"])(
  "loads every logo from the configured %s base",
  (base) => {
    vi.stubEnv("BASE_URL", base);
    const header = render(
      <GameHeader title="Gravity" onHome={() => {}}>
        Level 1
      </GameHeader>,
    );
    expect(header.container.querySelector("img")?.getAttribute("src")).toBe(
      `${base}orbit-mark.svg`,
    );
    header.unmount();
    const label = render(<GameHeader title="Odessey">Checkpoint 1</GameHeader>);
    expect(label.container.querySelector("img")?.getAttribute("src")).toBe(
      `${base}orbit-mark.svg`,
    );
    label.unmount();
    const home = render(<ModeChooser onSelect={() => {}} onHelp={() => {}} />);
    expect(
      home.container.querySelector(".home-brand img")?.getAttribute("src"),
    ).toBe(`${base}orbit-mark.svg`);
  },
);
