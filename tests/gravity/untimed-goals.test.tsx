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
import { gravityDifficulty } from "../../src/gravity/difficulty";
afterEach(() => {
  cleanup();
  localStorage.clear();
});
describe("untimed Gravity orbit goals", () => {
  it("completes on the first valid orbit even when legacy data requests a 100 second hold", () => {
    const level = getGravityLevel(42, 0);
    level.objective.hold = 100;
    const state = createState(level),
      shot = level.witness[0];
    expect(state.level.objective.hold).toBe(0);
    expect(level.objective.hold).toBe(100);
    expect(objectiveText(level)).not.toMatch(/hold|seconds/i);
    fireFrom(state, shot.position!, shot.velocity!);
    // Also cover a legacy state restored without passing through createState normalization.
    state.level.objective.hold = 100;
    for (let n = 0; n < 120 * 15; n++) {
      step(state, 1 / 120);
      const progress = goalProgress(state);
      if (progress.current === progress.target) {
        expect(progress.complete).toBe(true);
        expect(progress.hold).toBe(0);
        expect(progress.held).toBe(0);
        return;
      }
    }
    throw new Error("Expected a valid completed orbit");
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
