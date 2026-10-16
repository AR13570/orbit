import { describe, expect, it } from "vitest";
import { TutorialPractice } from "../../src/tutorial/practice";
import { tutorialSteps } from "../../src/tutorial/steps";
import { OrbitEngine } from "../../src/game/engine";
import { GravityEngine } from "../../src/gravity/engine";
describe("isolated tutorial practice", () => {
  it.each(["odessey", "gravity"] as const)(
    "%s introduces components before the authored practice levels",
    (mode) => {
      const model = new TutorialPractice(mode);
      const steps = tutorialSteps(mode);
      expect(steps.map((s) => s.id)).toEqual(
        mode === "odessey"
          ? [
              "intro",
              "forces",
              "checkpoint",
              "split",
              "launch",
              "practice-split",
            ]
          : ["intro", "forces", "orbit", "multiple", "launch"],
      );
      for (const step of steps.slice(0, 4)) {
        model.enterStage(step.id);
        expect(model.ready()).toBe(true);
        expect(model.launch()).toBe(false);
        model.update(5);
        expect(model.launches).toBe(0);
        expect(model.getParticles()).toHaveLength(0);
      }
      model.enterStage("launch");
      expect(model.ready()).toBe(false);
      expect(model.launch()).toBe(true);
      if (mode === "odessey") {
        expect(model.ready()).toBe(false);
        for (let i = 0; i < 4000 && !model.ready(); i++) model.update(1 / 60);
      }
      expect(model.ready()).toBe(true);
      expect(model.launches).toBe(1);
    },
  );
  it("starts Gravity with preview and launch aligned", () => {
    const model = new TutorialPractice("gravity");
    expect(model.gravity!.getSnapshot().aim).toEqual(model.aim);
    expect(model.preview().length).toBeGreaterThan(1);
    model.enterStage("launch");
    model.launch();
    const velocity = model.getParticles()[0].velocity;
    expect(Math.atan2(velocity.y, velocity.x)).toBeCloseTo(model.aim.angle, 10);
  });
  it("Back preserves the practice flight and freezes it during explanations", () => {
    const model = new TutorialPractice("odessey");
    model.enterStage("launch");
    model.launch();
    model.update(0.05);
    const particles = structuredClone(model.getParticles());
    model.enterStage("split");
    model.update(5);
    expect(model.getParticles()).toEqual(particles);
    expect(model.launch()).toBe(false);
  });
  it("never touches live engines during practice", () => {
    const odessey = new OrbitEngine(42),
      gravity = new GravityEngine(42);
    odessey.launch();
    gravity.launch();
    const before = [odessey.getSnapshot(), gravity.getSnapshot()];
    const model = new TutorialPractice("odessey");
    model.enterStage("launch");
    model.launch();
    for (let i = 0; i < 200; i++) model.update(1 / 60);
    expect([odessey.getSnapshot(), gravity.getSnapshot()]).toEqual(before);
  });
});

describe("authored Odessey lessons", () => {
  it("uses a thumb-sized magnet only near the split lesson's pull handle", () => {
    const model = new TutorialPractice("odessey");
    model.enterStage("practice-split");
    const suggested = model.suggestedAim();
    for (const range of [72, 160]) {
      const near = { angle: suggested.angle, power: suggested.power + 12 / range };
      const far = { angle: suggested.angle, power: suggested.power + 16 / range };
      expect(model.guidedAim(near, range)).toEqual(suggested);
      expect(model.guidedAim(far, range)).toBe(far);
      model.enterStage("launch");
      expect(model.guidedAim(near, range)).toBe(near);
      model.enterStage("practice-split");
    }
  });
  it("launches one ship and physically crashes when the player never branches", () => {
    const model = new TutorialPractice("odessey");
    model.enterStage("practice-split");
    model.toggleMode();
    expect(model.launch()).toBe(true);
    expect(model.getParticles()).toHaveLength(1);
    for (let i = 0; i < 3000; i++) model.update(1 / 60);
    expect(model.getParticles()).toHaveLength(1);
    expect(model.getParticles()[0].alive).toBe(false);
    expect(model.branches).toBe(0);
    expect(model.docks).toBe(0);
    expect(model.ready()).toBe(false);
  });
  it("accepts a genuine capture even when an alternative aim needs no split", () => {
    const model = new TutorialPractice("odessey");
    model.enterStage("practice-split");
    model.toggleMode();
    model.setAim(33 * Math.PI / 180, .575);
    model.launch();
    for (let i = 0; i < 3000 && !model.ready(); i++) model.update(1 / 60);
    expect(model.branches).toBe(0);
    expect(model.docks).toBeGreaterThan(0);
    expect(model.ready()).toBe(true);
  });
  it("requires a real checkpoint capture for the normal lesson", () => {
    const model = new TutorialPractice("odessey");
    model.enterStage("launch");
    expect(model.solution().paths[0].length).toBeGreaterThan(10);
    expect(model.ready()).toBe(false);
    model.launch();
    expect(model.ready()).toBe(false);
    for (let i = 0; i < 4000 && !model.ready(); i++) model.update(1 / 60);
    expect(model.docks).toBeGreaterThan(0);
    expect(model.ready()).toBe(true);
  });
  it("requires a useful branch and captures using the supplied timing", () => {
    const model = new TutorialPractice("odessey");
    model.enterStage("practice-split");
    expect(model.solution().paths.length).toBeGreaterThan(1);
    expect(model.solution().tapPoint).toBeDefined();
    expect(model.launchAllowed()).toBe(false);
    expect(model.launch()).toBe(false);
    expect(model.getParticles()).toHaveLength(0);
    expect(model.ready()).toBe(false);
    model.reset();
    model.toggleMode();
    model.launch();
    for (let i = 0; i < 4000 && model.flightElapsed < model.branchTime; i++)
      model.update(1 / 60);
    expect(model.branch()).toBe(true);
    expect(model.branch()).toBe(false);
    expect(model.getParticles()).toHaveLength(3);
    for (let i = 0; i < 4000 && !model.ready(); i++) model.update(1 / 60);
    expect(model.branches).toBe(1);
    expect(model.getParticles()[0].alive).toBe(false);
    expect(model.getParticles()[2].trail.at(-1)!.x).toBeGreaterThan(790);
    expect(model.ready()).toBe(true);
  });
});
