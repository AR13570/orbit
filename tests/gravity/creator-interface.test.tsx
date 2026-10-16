import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GravityEngine } from "../../src/gravity/engine";
import GravityCreator from "../../src/gravity/creator/GravityCreator";
import {
  levelShareUrl,
  loadDraft,
  loadLibrary,
  newDraft,
  toGravityLevel,
  saveDraft,
} from "../../src/gravity/creator/model";
import type { GravityLevel } from "../../src/gravity/types";
vi.mock("../../src/gravity/GravityGame", () => ({
  default: ({
    customLevel,
    customName,
    onExit,
  }: {
    customLevel: GravityLevel;
    customName: string;
    onExit: () => void;
  }) => (
    <div>
      <p>Playing {customName}</p>
      <p>{customLevel.bodies.length} test bodies</p>
      <p>{customLevel.bodies[0].strength} test strength</p>
      <p>{customLevel.objective.kind} test objective</p>
      <button onClick={onExit}>Back to editor</button>
    </div>
  ),
}));
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("orbit.walkthrough.zen.v1", "complete");
  localStorage.setItem("orbit.walkthrough.gravity.v1", "complete");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function setup() {
  return render(<GravityCreator onExit={() => {}} />);
}
function field() {
  const svg = screen.getByLabelText("Level design field");
  vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 900,
    height: 900,
  } as DOMRect);
  return svg;
}
function pointer(
  target: Element,
  type: string,
  x: number,
  y: number,
  id = 1,
  primary = true,
  pointerType = "mouse",
) {
  const e = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
  Object.defineProperties(e, {
    pointerId: { value: id },
    isPrimary: { value: primary },
    pointerType: { value: pointerType },
  });
  fireEvent(target, e);
}
function addBody(kind = "attractor", x = 200, y = 200) {
  fireEvent.click(
    screen.getByRole("button", {
      name: kind === "attractor" ? "Add attractor" : "Add repeller",
    }),
  );
  const svg = field();
  pointer(svg, "pointerdown", x, y);
  pointer(svg, "pointerup", x, y);
}
function rename(name: string) {
  fireEvent.click(screen.getByRole("button", { name: "Rename level" }));
  fireEvent.change(screen.getByLabelText("Level name"), {
    target: { value: name },
  });
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
}
describe("canvas Gravity creator", () => {
  it("offers soft contacts by default and saves a player's explicit collision choice", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Sandbox settings" }));
    const collisions = screen.getByRole("combobox", {
      name: "Planet collisions",
    }) as HTMLSelectElement;
    expect(collisions.value).toBe("soft");
    expect(screen.getByRole("option", { name: "Surface contact" })).toBeTruthy();
    fireEvent.change(collisions, { target: { value: "elastic" } });
    expect(loadDraft()?.physics?.planetCollisions).toBe("elastic");
    fireEvent.change(collisions, { target: { value: "soft" } });
    expect(loadDraft()?.physics?.planetCollisions).toBe("soft");
  });
  it("consumes a portable sky link once and preserves later edits on creator reentry and reload", () => {
    const shared = newDraft();
    shared.name = "Shared sky";
    const url = new URL(
      levelShareUrl(shared, "http://localhost/?mode=creator"),
    );
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    let view = setup();
    expect(loadDraft()?.name).toBe("Shared sky");
    expect(new URLSearchParams(window.location.search).has("sky")).toBe(false);
    rename("My latest sky");
    view.unmount();
    view = setup();
    expect(
      screen.getByRole("button", { name: "Rename level" }).textContent,
    ).toContain("My latest sky");
    expect(loadDraft()?.name).toBe("My latest sky");
    view.unmount();
    window.history.replaceState({}, "", "/?mode=creator");
    setup();
    expect(
      screen.getByRole("button", { name: "Rename level" }).textContent,
    ).toContain("My latest sky");
    expect(loadDraft()?.name).toBe("My latest sky");
    window.history.replaceState({}, "", "/");
  });
  it("gives added and duplicated attractive cores goals while retaining edited paired counts", () => {
    setup();
    addBody("attractor", 200, 200);
    fireEvent.click(screen.getByRole("button", { name: "Choose challenge" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "An orbit around each body",
        exact: true,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Increase core 1 planets" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Increase core 1 planets" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Done", exact: true }));
    addBody("attractor", 650, 200);
    expect(loadDraft()?.requirements?.map((goal) => goal.count)).toEqual([
      3, 1, 1,
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Duplicate body" }));
    const draft = loadDraft()!;
    expect(draft.requirements?.map((goal) => goal.count)).toEqual([3, 1, 1, 1]);
    expect(
      new GravityEngine(42, toGravityLevel(draft)).getSnapshot().progress
        .target,
    ).toBe(6);
    fireEvent.click(
      screen.getByRole("button", { name: "Playtest", exact: true }),
    );
    expect(screen.getByText("4 test bodies")).toBeTruthy();
  });
  it("restores paired goals after all configured cores are removed and new ones are placed", () => {
    setup();
    addBody("attractor", 200, 200);
    fireEvent.click(screen.getByRole("button", { name: "Choose challenge" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "An orbit around each body",
        exact: true,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Increase core 1 planets" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Done", exact: true }));
    for (let i = 0; i < 2; i++) {
      fireEvent.click(
        screen.getByRole("button", { name: "Attractor 1 on field" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Delete body" }));
    }
    expect(loadDraft()?.requirements).toEqual([]);
    addBody("attractor", 200, 200);
    addBody("attractor", 650, 200);
    const draft = loadDraft()!;
    expect(draft.requirements?.map((goal) => goal.count)).toEqual([1, 1]);
    expect(
      new GravityEngine(42, toGravityLevel(draft)).getSnapshot().progress
        .target,
    ).toBe(2);
    expect(
      (
        screen.getByRole("button", {
          name: "Playtest",
          exact: true,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
  it("toggles the selected body type directly in its bar without changing size or gravity", () => {
    setup();
    fireEvent.click(
      screen.getByRole("button", { name: "Attractor 1 on field" }),
    );
    const original = loadDraft()!.bodies[0];
    fireEvent.click(screen.getByRole("button", { name: "Change to repeller" }));
    expect(loadDraft()?.bodies[0]).toEqual({ ...original, kind: "repellent" });
    fireEvent.click(
      screen.getByRole("button", { name: "Change to attractor" }),
    );
    expect(loadDraft()?.bodies[0]).toEqual(original);
    expect(screen.queryByRole("button", { name: "Object actions" })).toBeNull();
    expect(screen.queryByRole("menu")).toBeNull();
  });
  it("starts with no challenge and can switch back to it, hiding challenge controls and preserving it for play", () => {
    setup();
    expect(
      screen.getByRole("button", { name: "Choose challenge" }).textContent,
    ).toContain("No challenge");
    fireEvent.click(screen.getByRole("button", { name: "Choose challenge" }));
    expect(
      screen
        .getByRole("button", { name: "No challenge", exact: true })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.queryByRole("button", { name: "Increase revolutions" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Complete a revolution",
        exact: true,
      }),
    );
    expect(
      screen.getByRole("button", { name: "Increase revolutions" }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "No challenge", exact: true }),
    );
    expect(
      screen.queryByRole("button", { name: "Increase revolutions" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Save level" }));
    expect(loadLibrary()[0].objective.kind).toBe("none");
    fireEvent.click(screen.getByRole("button", { name: "Playtest" }));
    expect(screen.getByText("none test objective")).toBeTruthy();
  });
  it("snaps a dragged body to another object's axis, keeps the grab offset, and clears guides on release", () => {
    setup();
    const svg = field();
    pointer(
      screen.getByRole("button", { name: "Attractor 1 on field" }),
      "pointerdown",
      460,
      445,
    );
    pointer(svg, "pointermove", 464, 295);
    expect(loadDraft()?.bodies[0].position).toEqual({ x: 450, y: 300 });
    expect(screen.getByTestId("creator-alignment-x").getAttribute("x1")).toBe(
      "450",
    );
    expect(screen.queryByTestId("creator-alignment-y")).toBeNull();
    pointer(svg, "pointerup", 464, 295);
    expect(loadDraft()?.bodies[0].position).toEqual({ x: 450, y: 300 });
    expect(screen.queryByTestId("creator-alignment-x")).toBeNull();
  });
  it("snaps each axis to the nearest other object and releases outside the threshold", () => {
    const draft = newDraft();
    draft.bodies.push({
      ...draft.bodies[0],
      id: "body-2",
      position: { x: 480, y: 300 },
    });
    saveDraft(draft);
    setup();
    const svg = field();
    pointer(
      screen.getByRole("button", { name: "Attractor 1 on field" }),
      "pointerdown",
      450,
      450,
    );
    pointer(svg, "pointermove", 477, 645);
    expect(loadDraft()?.bodies[0].position).toEqual({ x: 480, y: 650 });
    expect(screen.getByTestId("creator-alignment-x")).toBeTruthy();
    expect(screen.getByTestId("creator-alignment-y")).toBeTruthy();
    pointer(svg, "pointermove", 463, 630);
    expect(loadDraft()?.bodies[0].position).toEqual({ x: 463, y: 630 });
    expect(screen.queryByTestId("creator-alignment-x")).toBeNull();
    expect(screen.queryByTestId("creator-alignment-y")).toBeNull();
    pointer(svg, "pointerup", 463, 630);
  });
  it("uses the same screen distance for touch snapping in a letterboxed mobile field and clears guides on cancellation", () => {
    setup();
    const svg = field();
    vi.mocked(svg.getBoundingClientRect).mockReturnValue({
      left: 10,
      top: 20,
      width: 900,
      height: 450,
    } as DOMRect);
    pointer(
      screen.getByRole("button", { name: "Launcher on field" }),
      "pointerdown",
      460,
      345,
      1,
      true,
      "touch",
    );
    pointer(svg, "pointermove", 469, 320, 1, true, "touch");
    expect(loadDraft()?.launch).toEqual({ x: 450, y: 600 });
    expect(screen.getByTestId("creator-alignment-x")).toBeTruthy();
    pointer(svg, "pointercancel", 469, 320, 1, true, "touch");
    expect(screen.queryByTestId("creator-alignment-x")).toBeNull();
    pointer(svg, "pointermove", 600, 320, 1, true, "touch");
    expect(loadDraft()?.launch).toEqual({ x: 450, y: 600 });
    fireEvent.keyDown(
      screen.getByRole("button", { name: "Launcher on field" }),
      { key: "ArrowRight", shiftKey: true },
    );
    expect(loadDraft()?.launch).toEqual({ x: 451, y: 600 });
  });
  it("toggles floating popovers with a complete pointer click on their trigger", () => {
    setup();
    fireEvent.click(
      screen.getByRole("button", { name: "Attractor 1 on field" }),
    );
    for (const name of ["Choose challenge", "Saved levels", "Rename level"]) {
      const trigger = screen.getByRole("button", { name });
      pointer(trigger, "pointerdown", 0, 0);
      fireEvent.click(trigger);
      expect(
        screen.queryByRole("dialog") ?? screen.queryByRole("menu"),
      ).toBeTruthy();
      pointer(trigger, "pointerdown", 0, 0);
      fireEvent.click(trigger);
      expect(
        screen.queryByRole("dialog") ?? screen.queryByRole("menu"),
      ).toBeNull();
    }
  });
  it("keeps an edge resize stable when the body shifts inward and the pointer is released", () => {
    const draft = newDraft();
    draft.bodies[0].radius = 16;
    draft.bodies[0].position = { x: 16, y: 450 };
    saveDraft(draft);
    setup();
    const svg = field();
    fireEvent.click(
      screen.getByRole("button", { name: "Attractor 1 on field" }),
    );
    pointer(
      screen.getByRole("slider", { name: "Body size" }),
      "pointerdown",
      60,
      450,
    );
    pointer(svg, "pointermove", 100, 450);
    pointer(svg, "pointerup", 100, 450);
    expect(loadDraft()?.bodies[0].radius).toBe(56);
    expect(loadDraft()?.bodies[0].position).toEqual({ x: 56, y: 450 });
  });
  it("shows a canvas and floating tools, placing the selected object where the field is tapped", () => {
    setup();
    expect(screen.queryByLabelText("X position")).toBeNull();
    expect(screen.queryByLabelText("Selected object")).toBeNull();
    expect(screen.queryByRole("slider")).toBeNull();
    addBody("repellent", 250, 250);
    expect(loadDraft()?.bodies[1].kind).toBe("repellent");
    expect(loadDraft()?.bodies[1].position).toEqual({ x: 250, y: 250 });
    expect(screen.getByRole("slider", { name: "Body size" })).toBeTruthy();
    expect(
      screen.getByRole("slider", { name: "Gravity strength" }),
    ).toBeTruthy();
  });
  it("drags body size and gravity independently and saves both for playtesting", () => {
    setup();
    const svg = field();
    fireEvent.click(
      screen.getByRole("button", { name: "Attractor 1 on field" }),
    );
    const original = loadDraft()!.bodies[0];
    pointer(
      screen.getByRole("slider", { name: "Body size" }),
      "pointerdown",
      514,
      450,
    );
    pointer(svg, "pointermove", 534, 450);
    pointer(svg, "pointerup", 534, 450);
    expect(loadDraft()?.bodies[0].radius).toBe(60);
    expect(loadDraft()?.bodies[0].strength).toBe(original.strength);
    pointer(
      screen.getByRole("slider", { name: "Gravity strength" }),
      "pointerdown",
      450,
      310,
    );
    pointer(svg, "pointermove", 450, 260);
    pointer(svg, "pointerup", 450, 260);
    const edited = loadDraft()!.bodies[0];
    expect(edited.strength).toBeGreaterThan(original.strength);
    expect(edited.radius).toBe(60);
    fireEvent.click(screen.getByRole("button", { name: "Save level" }));
    expect(loadLibrary()[0].bodies[0]).toEqual(edited);
    fireEvent.click(screen.getByRole("button", { name: "Playtest" }));
    expect(screen.getByText(`${edited.strength} test strength`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to editor" }));
    expect(
      screen
        .getByRole("slider", { name: "Body size" })
        .getAttribute("aria-valuenow"),
    ).toBe("60");
  });
  it("duplicates and deletes directly in the bar, preserving size and pull", () => {
    setup();
    const body = screen.getByRole("button", { name: "Attractor 1 on field" });
    fireEvent.click(body);
    fireEvent.click(screen.getByRole("button", { name: "Duplicate body" }));
    const draft = loadDraft()!;
    expect(draft.bodies).toHaveLength(2);
    expect(draft.bodies[1].radius).toBe(draft.bodies[0].radius);
    expect(draft.bodies[1].strength).toBe(draft.bodies[0].strength);
    expect(draft.bodies[1].position).not.toEqual(draft.bodies[0].position);
    fireEvent.click(screen.getByRole("button", { name: "Change to repeller" }));
    expect(loadDraft()?.bodies[1].kind).toBe("repellent");
    fireEvent.click(screen.getByRole("button", { name: "Delete body" }));
    expect(loadDraft()?.bodies).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Launcher on field" }));
    expect(screen.queryByRole("button", { name: "Duplicate body" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete body" })).toBeNull();
  });
  it("selects on touch or right-click with direct bar actions and no menu", () => {
    vi.useFakeTimers();
    setup();
    const svg = field();
    const body = screen.getByRole("button", { name: "Attractor 1 on field" });
    pointer(body, "pointerdown", 450, 450, 1, true, "touch");
    act(() => vi.advanceTimersByTime(550));
    pointer(svg, "pointerup", 450, 450, 1, true, "touch");
    fireEvent.click(body);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Duplicate body" })).toBeTruthy();
    fireEvent.contextMenu(body, { clientX: 450, clientY: 450 });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Delete body" })).toBeTruthy();
  });
  it("maps dragging correctly in a rectangular mobile field and cancels secondary touch", () => {
    setup();
    const svg = field();
    vi.mocked(svg.getBoundingClientRect).mockReturnValue({
      left: 10,
      top: 20,
      width: 900,
      height: 450,
    } as DOMRect);
    pointer(
      screen.getByRole("button", { name: "Launcher on field" }),
      "pointerdown",
      465,
      345,
    );
    pointer(svg, "pointermove", 495, 375);
    pointer(svg, "pointerup", 495, 375);
    expect(loadDraft()?.launch).toEqual({ x: 510, y: 710 });
    pointer(
      screen.getByRole("button", { name: "Launcher on field" }),
      "pointerdown",
      490,
      375,
    );
    pointer(svg, "pointerdown", 100, 100, 2, false, "touch");
    pointer(svg, "pointermove", 530, 375);
    pointer(svg, "pointerup", 530, 375);
    expect(loadDraft()?.launch).toEqual({ x: 510, y: 710 });
  });
  it("offers keyboard sizing and objective buttons while blocking invalid challenges", () => {
    setup();
    fireEvent.click(
      screen.getByRole("button", { name: "Attractor 1 on field" }),
    );
    fireEvent.keyDown(screen.getByRole("slider", { name: "Body size" }), {
      key: "ArrowRight",
    });
    fireEvent.keyDown(
      screen.getByRole("slider", { name: "Gravity strength" }),
      { key: "ArrowUp" },
    );
    expect(loadDraft()?.bodies[0].radius).toBe(41);
    fireEvent.click(screen.getByRole("button", { name: "Choose challenge" }));
    fireEvent.click(
      screen.getByRole("button", { name: "An orbit around each body" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("alert").textContent).toContain("at least two");
    expect(
      (screen.getByRole("button", { name: "Playtest" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    addBody();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("restores drafts, preserves edits on current-level loads, and respects saved-level deletion", () => {
    const view = setup();
    rename("First sky");
    fireEvent.click(screen.getByRole("button", { name: "Save level" }));
    fireEvent.keyDown(
      screen.getByRole("button", { name: "Launcher on field" }),
      { key: "ArrowRight" },
    );
    view.unmount();
    setup();
    expect(loadDraft()?.launch.x).toBe(460);
    fireEvent.click(screen.getByRole("button", { name: "Saved levels" }));
    fireEvent.click(screen.getByRole("button", { name: /First sky1 bodies/ }));
    expect(loadDraft()?.launch.x).toBe(460);
    fireEvent.click(screen.getByRole("button", { name: "Saved levels" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete First sky" }));
    fireEvent.click(screen.getByRole("button", { name: "+ New level" }));
    expect(loadLibrary().some((level) => level.name === "First sky")).toBe(
      false,
    );
  });
  it("reports unavailable browser storage", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Save level" }));
    expect(screen.getByRole("alert").textContent).toContain(
      "could not be saved",
    );
  });
});
