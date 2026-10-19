import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { getGravityLevel } from "../../src/gravity/campaign";
import {
  createState,
  fireFrom,
  goalProgress,
  step,
  objectiveText,
} from "../../src/gravity/simulation";
import {
  newDraft,
  parseDraft,
  toGravityLevel,
  loadDraft,
  loadLibrary,
  importDraft,
  exportDraft,
} from "../../src/gravity/creator/model";
import GravityCreator from "../../src/gravity/creator/GravityCreator";
import { gravityForceAt } from "../../src/gravity/physics";
import { gravityDifficulty } from "../../src/gravity/difficulty";
afterEach(() => {
  cleanup();
  localStorage.clear();
});
describe("untimed Gravity orbit goals", () => {
  it("completes after two full revolutions without waiting for a legacy 100-second hold", () => {
    const level = toGravityLevel(newDraft());
    const core = level.bodies[0];
    Object.assign(core, { radius: 96, strength: 12000000, softening: 180 });
    level.objective = { kind: "loop", count: 1, turns: 2, hold: 100 };
    level.requirements = [{ bodyId: core.id, count: 1, turns: 2 }];
    const position = { x: core.position.x + 190, y: core.position.y };
    const speed = Math.sqrt(-gravityForceAt(position, level.bodies).x * 190);
    const state = createState(level);
    expect(state.level.objective.hold).toBe(0);
    expect(level.objective.hold).toBe(100);
    expect(objectiveText(level)).not.toMatch(/hold|seconds/i);
    expect(fireFrom(state, position, { x: 0, y: speed })).toBe(true);
    // Cover a legacy state restored without createState normalization too.
    state.level.objective.hold = 100;
    let observedFirstRevolution = false;
    for (let n = 0; n < 120 * 60; n++) {
      step(state, 1 / 120);
      const progress = goalProgress(state);
      const winding = Math.abs(state.particles[0].orbits[core.id].localWinding);
      if (winding >= 2 * Math.PI && winding < 4 * Math.PI - 1e-9) {
        observedFirstRevolution = true;
        expect(progress.complete).toBe(false);
      }
      if (progress.complete) {
        expect(observedFirstRevolution).toBe(true);
        expect(winding).toBeGreaterThanOrEqual(4 * Math.PI - 1e-9);
        expect(state.elapsed).toBeLessThan(100);
        expect(progress.current).toBe(progress.target);
        expect(progress.hold).toBe(0);
        expect(progress.held).toBe(0);
        return;
      }
    }
    throw new Error("Expected two full revolutions without a timed hold");
  });
  it("normalizes legacy saved hold fields without rejecting otherwise valid v1 levels", () => {
    const draft = newDraft();
    draft.objective = { kind: "loop", count: 1, turns: 1, hold: 100 };
    expect(parseDraft(draft).objective.hold).toBe(0);
    expect(toGravityLevel(draft).objective.hold).toBe(0);
    localStorage.setItem("orbit-creator-draft", JSON.stringify(draft));
    localStorage.setItem("orbit-creator-levels", JSON.stringify([draft]));
    expect(loadDraft()?.objective.hold).toBe(0);
    expect(loadLibrary()[0].objective.hold).toBe(0);
    expect(importDraft(JSON.stringify(draft)).objective.hold).toBe(0);
    expect(JSON.parse(exportDraft(draft)).objective.hold).toBe(0);
    const withoutHold = JSON.parse(JSON.stringify(draft));
    delete withoutHold.objective.hold;
    expect(parseDraft(withoutHold).objective.hold).toBe(0);
  });
  it("has no timed objective fields or goal copy across campaign and endless levels", () => {
    expect(gravityDifficulty(10000)).not.toHaveProperty("hold");
    for (const index of [
      ...Array.from({ length: 45 }, (_, i) => i),
      45,
      60,
      75,
      90,
      10000,
    ]) {
      const level = getGravityLevel(42, index);
      expect(level.objective.hold).toBe(0);
      expect(objectiveText(level)).not.toMatch(/hold|seconds|\d+s\b/i);
    }
  });
  it("offers no hold objective control in the creator", () => {
    const draft = newDraft();
    draft.objective.kind = "loop";
    localStorage.setItem("orbit-creator-draft", JSON.stringify(draft));
    render(<GravityCreator onExit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose challenge" }));
    expect(screen.queryByText("Hold seconds")).toBeNull();
    expect(screen.queryByRole("button", { name: /hold/i })).toBeNull();
  });
});
