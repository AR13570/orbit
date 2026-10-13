import { beforeEach, describe, expect, it } from "vitest";
import { GravityEngine } from "../../src/gravity/engine";
import {
  newDraft,
  parseDraft,
  layoutErrors,
  toGravityLevel,
  saveLevel,
  loadLibrary,
  saveDraft,
  loadDraft,
} from "../../src/gravity/creator/model";

beforeEach(() => localStorage.clear());
describe("custom Gravity levels", () => {
  it("defaults to no challenge, persists it and permits repeller-only or empty free-play designs", () => {
    const draft = newDraft();
    expect(draft.objective.kind).toBe("none");
    draft.bodies[0].kind = "repellent";
    expect(layoutErrors(draft)).toEqual([]);
    saveDraft(draft);
    saveLevel(draft);
    expect(loadDraft()?.objective.kind).toBe("none");
    expect(loadLibrary()[0].objective.kind).toBe("none");
    expect(toGravityLevel(draft).objective.kind).toBe("none");
    draft.bodies = [];
    expect(layoutErrors(draft)).toEqual([]);
    draft.objective.kind = "loop";
    expect(layoutErrors(draft).join(" ")).toMatch(/attractive/i);
  });
  it("keeps free play running after completed revolutions and allows more launches", () => {
    const draft = newDraft();
    const engine = new GravityEngine(42, toGravityLevel(draft));
    engine.setAim(0, Math.sqrt((1440000 * 200) / (200 * 200 + 1600)) / 420);
    engine.launch();
    for (let n = 0; n < 1440; n++) engine.update(1 / 120);
    expect(engine.getSnapshot().elapsed).toBeGreaterThan(11);
    expect(engine.getSnapshot().complete).toBe(false);
    expect(engine.getSnapshot().progress.complete).toBe(false);
    expect(engine.getSnapshot().held).toBe(0);
    expect(engine.launch()).toBe(true);
  });
  it("round trips a draft and rejects malformed or excessive stored data", () => {
    const draft = newDraft();
    expect(parseDraft(JSON.parse(JSON.stringify(draft)))).toEqual(draft);
    expect(parseDraft({ ...draft, interaction: true })).toEqual(draft);
    expect(() => parseDraft({ ...draft, launch: { x: NaN, y: 1 } })).toThrow();
    expect(() =>
      parseDraft({ ...draft, bodies: Array(9).fill(draft.bodies[0]) }),
    ).toThrow();
    expect(() =>
      parseDraft({
        ...draft,
        objective: { ...draft.objective, kind: "nested" },
      }),
    ).toThrow();
    expect(() =>
      parseDraft({ ...draft, bodies: [draft.bodies[0], draft.bodies[0]] }),
    ).toThrow();
  });
  it("explains invalid geometry and objective requirements", () => {
    const draft = newDraft();
    expect(layoutErrors(draft)).toEqual([]);
    draft.launch = { ...draft.bodies[0].position };
    expect(layoutErrors(draft).join(" ")).toMatch(/launcher/i);
    draft.objective.kind = "paired";
    expect(layoutErrors(draft).join(" ")).toMatch(/two/i);
  });
  it("stores drafts separately, updates a saved level and preserves other saved levels", () => {
    const a = newDraft(),
      b = newDraft();
    saveDraft(a);
    expect(loadDraft()).toEqual(a);
    saveLevel(a);
    saveLevel(b);
    saveLevel({ ...a, name: "Changed" });
    expect(loadLibrary()).toHaveLength(2);
    expect(loadLibrary().find((level) => level.id === a.id)?.name).toBe(
      "Changed",
    );
    localStorage.setItem("orbit-creator-draft", "{broken");
    expect(loadDraft()).toBeNull();
  });
  it("plays the supplied layout and keeps it for retries after success", () => {
    const draft = newDraft();
    draft.objective.kind = "loop";
    const level = toGravityLevel(draft);
    const engine = new GravityEngine(42, level);
    level.bodies[0].position.x = 1;
    expect(engine.getSnapshot().level.bodies[0].position.x).toBe(450);
    expect(engine.getSnapshot().level.launch).toEqual(draft.launch);
    engine.setAim(0, Math.sqrt((1440000 * 200) / (200 * 200 + 1600)) / 420);
    engine.launch();
    for (let n = 0; n < 120 * 12; n++) engine.update(1 / 120);
    expect(engine.getSnapshot().complete).toBe(true);
    engine.advance();
    engine.skip();
    expect(engine.getSnapshot().level.index).toBe(0);
    engine.retry();
    expect(engine.getSnapshot().complete).toBe(false);
    expect(engine.getSnapshot().particles).toEqual([]);
    expect(engine.getSnapshot().level.launch).toEqual(draft.launch);
  });
});
