import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrbitSound } from "../../src/sound";
import { GravityMusic } from "../../src/gravity/music";

class Param {
  value = 0;
  events: { kind: string; value: number; time: number }[] = [];
  setValueAtTime(value: number, time: number) {
    this.events.push({ kind: "set", value, time });
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.events.push({ kind: "ramp", value, time });
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.events.push({ kind: "exp", value, time });
  }
  cancelScheduledValues(time: number) {
    this.events = this.events.filter((event) => event.time < time);
  }
  cancelAndHoldAtTime(time: number) {
    this.cancelScheduledValues(time);
  }
}
class Node {
  disconnected = false;
  connect(_target: unknown) {}
  disconnect() {
    this.disconnected = true;
  }
}
class Gain extends Node {
  gain = new Param();
}
class Oscillator extends Node {
  type = "sine";
  frequency = new Param();
  starts: number[] = [];
  stops: number[] = [];
  onended: (() => void) | null = null;
  start(time: number) {
    this.starts.push(time);
  }
  stop(time: number) {
    this.stops.push(time);
  }
}
class Context {
  static all: Context[] = [];
  state = "suspended";
  currentTime = 0;
  destination = new Node();
  oscillators: Oscillator[] = [];
  gains: Gain[] = [];
  constructor() {
    Context.all.push(this);
  }
  async resume() {
    this.state = "running";
  }
  async close() {
    this.state = "closed";
  }
  async suspend() {
    this.state = "suspended";
  }
  createOscillator() {
    const node = new Oscillator();
    this.oscillators.push(node);
    return node;
  }
  createGain() {
    const node = new Gain();
    this.gains.push(node);
    return node;
  }
}
beforeEach(() => {
  Context.all = [];
  vi.stubGlobal("AudioContext", Context);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function enabled() {
  const sound = new OrbitSound();
  sound.unlock();
  sound.setEnabled(true);
  await Promise.resolve();
  return sound;
}

describe("ambient game sound lifecycle", () => {
  it("schedules a soft launch only when enabled and unlocked", async () => {
    const sound = new OrbitSound();
    sound.play("launch");
    expect(Context.all).toHaveLength(0);
    sound.unlock();
    await Promise.resolve();
    sound.play("launch");
    expect(Context.all[0].oscillators).toHaveLength(0);
    sound.setEnabled(true);
    sound.play("launch");
    const ctx = Context.all[0];
    expect(ctx.oscillators.length).toBeGreaterThan(0);
    const peak = Math.max(
      ...ctx.gains.flatMap((gain) =>
        gain.gain.events.map((event) => event.value),
      ),
    );
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThanOrEqual(0.025);
    expect(
      ctx.gains.some((gain) =>
        gain.gain.events.some(
          (event) =>
            event.kind === "ramp" && event.value > 0 && event.time >= 0.1,
        ),
      ),
    ).toBe(true);
    sound.destroy();
  });
  it("bounds acceleration voices and ignores invalid intensity", async () => {
    const sound = await enabled();
    sound.accelerate(NaN);
    expect(Context.all[0].oscillators).toHaveLength(0);
    for (let i = 0; i < 128; i++) sound.accelerate(1);
    expect(Context.all[0].oscillators.length).toBeLessThanOrEqual(2);
    expect(Context.all[0].oscillators.length).toBeGreaterThan(0);
    Context.all[0].currentTime = 1;
    for (let i = 0; i < 128; i++) sound.play("launch");
    expect(Context.all[0].oscillators.length).toBeLessThanOrEqual(6);
    sound.destroy();
  });
  it("fades and stops voices on pause or mute and cannot schedule while disabled", async () => {
    const sound = await enabled();
    sound.accelerate(0.6);
    const ctx = Context.all[0];
    ctx.currentTime = 0.2;
    sound.setEnabled(false);
    expect(ctx.oscillators.every((osc) => osc.stops.at(-1)! <= 0.26)).toBe(
      true,
    );
    const count = ctx.oscillators.length;
    sound.play("dock");
    sound.accelerate(1);
    expect(ctx.oscillators).toHaveLength(count);
    for (const osc of ctx.oscillators) osc.onended?.();
    expect(
      [...ctx.oscillators, ...ctx.gains].every((node) => node.disconnected),
    ).toBe(true);
    sound.destroy();
    expect(ctx.state).toBe("closed");
  });
  it("disconnects ended voices and closes active voices on destroy", async () => {
    const sound = await enabled();
    sound.play("dock");
    const ctx = Context.all[0];
    for (const osc of ctx.oscillators) osc.onended?.();
    expect(
      [...ctx.oscillators, ...ctx.gains].every((node) => node.disconnected),
    ).toBe(true);
    sound.play("fail");
    sound.destroy();
    expect(ctx.state).toBe("closed");
    expect(
      [...ctx.oscillators, ...ctx.gains].every((node) => node.disconnected),
    ).toBe(true);
  });
  it("tolerates missing and blocked audio without scheduling", async () => {
    vi.stubGlobal("AudioContext", undefined);
    const missing = new OrbitSound();
    expect(() => {
      missing.unlock();
      missing.setEnabled(true);
      missing.play("launch");
      missing.destroy();
    }).not.toThrow();
    vi.stubGlobal(
      "AudioContext",
      class extends Context {
        async resume() {
          throw new Error("blocked");
        }
      },
    );
    const blocked = new OrbitSound();
    blocked.unlock();
    blocked.setEnabled(true);
    await Promise.resolve();
    blocked.accelerate(1);
    expect(Context.all[0].oscillators).toHaveLength(0);
    blocked.destroy();
  });
  it("stops ambient scheduling and disconnects the pad when paused or destroyed", async () => {
    const music = new GravityMusic();
    await music.play();
    expect(Context.all[0].oscillators.length).toBeGreaterThan(0);
    music.pause();
    const count = Context.all[0].oscillators.length;
    await vi.advanceTimersByTimeAsync(20000);
    expect(Context.all[0].oscillators).toHaveLength(count);
    music.destroy();
    expect(Context.all[0].state).toBe("closed");
    expect(
      [...Context.all[0].oscillators, ...Context.all[0].gains].every(
        (node) => node.disconnected,
      ),
    ).toBe(true);
  });
});
