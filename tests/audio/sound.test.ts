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
async function advanceMusic(milliseconds: number) {
  let maximumActive = 0;
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 50) {
    for (const ctx of Context.all) {
      ctx.currentTime += 0.05;
      for (const oscillator of ctx.oscillators)
        if ((oscillator.stops.at(-1) ?? Infinity) <= ctx.currentTime)
          oscillator.onended?.();
    }
    await vi.advanceTimersByTimeAsync(50);
    maximumActive = Math.max(
      maximumActive,
      ...Context.all.map(
        (ctx) => ctx.oscillators.filter((node) => node.onended !== null).length,
      ),
    );
  }
  return maximumActive;
}

describe("ambient game sound lifecycle", () => {
  it.each(["launch", "dock", "fail", "acceleration", "ambient"] as const)(
    "amplifies %s envelopes per instance without changing their timing",
    async (cue) => {
      const quiet = await enabled();
      const louder = new OrbitSound({ volume: 3 });
      await louder.unlock();
      louder.setEnabled(true);
      for (const sound of [quiet, louder]) {
        if (cue === "acceleration") sound.accelerate(1);
        else if (cue === "ambient") sound.ambient();
        else sound.play(cue);
      }
      const [normal, amplified] = Context.all;
      expect(amplified.oscillators).toHaveLength(normal.oscillators.length);
      normal.gains.forEach((gain, index) => {
        const envelope = gain.gain.events;
        const louderEnvelope = amplified.gains[index].gain.events;
        expect(louderEnvelope.map(({ time }) => time)).toEqual(
          envelope.map(({ time }) => time),
        );
        expect(louderEnvelope[1].value).toBeCloseTo(envelope[1].value * 3, 6);
        expect(louderEnvelope.at(-1)?.value).toBe(0);
        expect(amplified.oscillators[index].type).toBe("sine");
        expect(amplified.oscillators[index].stops).toEqual(
          normal.oscillators[index].stops,
        );
      });
      quiet.destroy();
      louder.destroy();
    },
  );
  it.each([
    { volume: 100, peak: 0.036 },
    { volume: -1, peak: 0 },
    { volume: NaN, peak: 0.012 },
    { volume: Infinity, peak: 0.012 },
  ])(
    "bounds invalid volume $volume to a finite envelope",
    async ({ volume, peak }) => {
      const sound = new OrbitSound({ volume });
      await sound.unlock();
      sound.setEnabled(true);
      sound.play("launch");
      const values = Context.all[0].gains.flatMap((gain) =>
        gain.gain.events.map(({ value }) => value),
      );
      expect(values.every(Number.isFinite)).toBe(true);
      expect(Math.max(0, ...values)).toBeCloseTo(peak, 6);
      sound.destroy();
    },
  );
  it("plays a coherent warm melody over changing quiet chord support", async () => {
    const music = new GravityMusic();
    await music.play();
    const ctx = Context.all[0];
    expect(ctx.oscillators).toHaveLength(9);
    expect(ctx.oscillators[0].frequency.events[0].value).toBeCloseTo(293.66, 2);
    expect(ctx.oscillators[1].frequency.events[0].value).toBeCloseTo(587.32, 2);
    expect(ctx.oscillators[2].frequency.events[0].value).toBeCloseTo(880.98, 2);
    expect(ctx.gains[0].gain.events[1].time).toBeGreaterThanOrEqual(0.05);
    expect(ctx.gains[0].gain.events[1].value).toBeGreaterThan(0.02);
    expect(ctx.gains[0].gain.events[1].value).toBeLessThan(0.03);
    expect(ctx.gains[0].gain.events.at(-1)?.value).toBe(0);
    await advanceMusic(5900);
    const melody = ctx.oscillators.filter((_, index) =>
      ctx.gains[index].gain.events.some((event) => event.value > 0.015),
    );
    expect(
      melody.slice(0, 8).map((node) => node.frequency.events[0].value),
    ).toEqual([293.66, 369.99, 440, 369.99, 329.63, 369.99, 329.63, 293.66]);
    const gaps = melody
      .slice(1, 8)
      .map((node, index) => node.starts[0] - melody[index].starts[0]);
    expect(Math.max(...gaps)).toBeLessThan(1);
    expect(Math.min(...gaps)).toBeLessThan(0.4);
    const support = ctx.oscillators.filter((_, index) => {
      const attack = ctx.gains[index].gain.events.find(
        (event) => event.value > 0,
      );
      return attack && attack.time - ctx.oscillators[index].starts[0] > 0.4;
    });
    expect(support.map((node) => node.frequency.events[0].value)).toContain(
      146.83,
    );
    expect(support.map((node) => node.frequency.events[0].value)).toContain(
      196,
    );
    expect(
      ctx.oscillators.filter((node) => node.onended !== null).length,
    ).toBeLessThanOrEqual(24);
    music.destroy();
  });
  it("bounds musical voices even if ending callbacks are delayed", async () => {
    const music = new GravityMusic();
    await music.play();
    await vi.advanceTimersByTimeAsync(60000);
    expect(Context.all[0].oscillators.length).toBeLessThanOrEqual(24);
    music.destroy();
  });
  it("resolves the chord cycle and uses only one faint chime accent per cycle", async () => {
    const music = new GravityMusic();
    await music.play();
    expect(await advanceMusic(24000)).toBeLessThanOrEqual(24);
    const ctx = Context.all[0];
    const roots: number[] = [];
    const accents: number[] = [];
    ctx.oscillators.forEach((node, index) => {
      const attack = ctx.gains[index].gain.events[1];
      const attackDuration = attack.time - node.starts[0];
      if (Math.abs(attackDuration - 0.5) < 0.001 && attack.value > 0.004)
        roots.push(node.frequency.events[0].value);
      if (Math.abs(attackDuration - 0.06) < 0.001) accents.push(attack.value);
    });
    expect(roots).toEqual([146.83, 196, 123.47, 220, 146.83]);
    expect(accents).toEqual([0.002, 0.00035]);
    music.destroy();
  });
  it("retries blocked autoplay on the next trusted play attempt", async () => {
    let blocked = true;
    vi.stubGlobal(
      "AudioContext",
      class extends Context {
        async resume() {
          if (blocked) throw new Error("blocked");
          await super.resume();
        }
      },
    );
    const music = new GravityMusic();
    await music.play();
    await vi.advanceTimersByTimeAsync(10000);
    expect(Context.all[0].oscillators).toHaveLength(0);
    blocked = false;
    await music.play();
    expect(Context.all[0].oscillators).toHaveLength(9);
    music.destroy();
  });
  it("cancels pending activation and resumes with a single scheduler", async () => {
    const music = new GravityMusic();
    const pending = music.play();
    music.pause();
    await pending;
    expect(Context.all[0].oscillators).toHaveLength(0);
    await music.play();
    await music.play();
    expect(Context.all[0].oscillators).toHaveLength(9);
    await vi.advanceTimersByTimeAsync(800);
    expect(Context.all[0].oscillators).toHaveLength(12);
    music.destroy();
  });
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
