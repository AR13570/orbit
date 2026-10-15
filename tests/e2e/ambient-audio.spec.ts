import { expect, test } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";

// Instrument native WebAudio, rather than replacing its scheduling or activation behavior.
function instrumentAudio() {
  const NativeAudio = window.AudioContext;
  const audit = {
    contexts: [] as AudioContext[],
    starts: 0,
    positiveRamps: 0,
    frequencies: [] as number[],
    stops: [] as { now: number; at: number }[],
    disconnects: 0,
  };
  Object.assign(window, { audioAudit: audit });
  window.AudioContext = class extends NativeAudio {
    constructor(options?: AudioContextOptions) {
      super(options);
      audit.contexts.push(this);
    }
    createOscillator() {
      const node = super.createOscillator();
      const frequency = node.frequency.setValueAtTime.bind(node.frequency);
      node.frequency.setValueAtTime = (value, at) => {
        audit.frequencies.push(value);
        return frequency(value, at);
      };
      const start = node.start.bind(node),
        stop = node.stop.bind(node),
        disconnect = node.disconnect.bind(node);
      node.start = (at = 0) => {
        audit.starts++;
        start(at);
      };
      node.stop = (at = 0) => {
        audit.stops.push({ now: this.currentTime, at });
        stop(at);
      };
      node.disconnect = () => {
        audit.disconnects++;
        disconnect();
      };
      return node;
    }
    createGain() {
      const gain = super.createGain(),
        ramp = gain.gain.linearRampToValueAtTime.bind(gain.gain);
      gain.gain.linearRampToValueAtTime = (value, at) => {
        if (value > 0) audit.positiveRamps++;
        return ramp(value, at);
      };
      return gain;
    }
  };
}
async function audit(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const value = (
      window as unknown as {
        audioAudit: {
          contexts: AudioContext[];
          starts: number;
          positiveRamps: number;
          frequencies: number[];
          stops: { now: number; at: number }[];
          disconnects: number;
        };
      }
    ).audioAudit;
    return {
      ...value,
      contexts: value.contexts.map((context) => context.state),
    };
  });
}
for (const mode of ["zen", "gravity"]) {
  test(`${mode} native audio stays muted until enabled and stops with pause, mute and exit`, async ({
    page,
  }) => {
    await page.addInitScript(markTutorialSeen);
    await page.addInitScript(instrumentAudio);
    await page.goto(`/?mode=${mode}&seed=42`);
    const launch = async () => {
      const canvas = page.locator("canvas").first(),
        box = (await canvas.boundingBox())!;
      await page.mouse.move(
        box.x + box.width * 0.55,
        box.y + box.height * 0.55,
      );
      await page.mouse.down();
      await page.mouse.move(
        box.x + box.width * 0.55 - 95,
        box.y + box.height * 0.55 + 25,
        { steps: 5 },
      );
      await page.mouse.up();
    };
    await launch();
    expect((await audit(page)).starts).toBe(0);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByRole("button", { name: "Sound off", exact: true }).click();
    expect((await audit(page)).starts).toBe(0);
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await page.keyboard.press("r");
    await launch();
    await expect
      .poll(async () => (await audit(page)).positiveRamps)
      .toBeGreaterThan(0);
    expect(
      (await audit(page)).contexts.every((state) => state === "running"),
    ).toBe(true);
    await expect.poll(async () => (await audit(page)).frequencies).toContain(130.81);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    const paused = await audit(page);
    expect(paused.stops.some((stop) => stop.at - stop.now <= 0.055)).toBe(true);
    await page.waitForTimeout(180);
    expect((await audit(page)).starts).toBe(paused.starts);
    await page.getByRole("button", { name: "Sound on", exact: true }).click();
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await page.keyboard.press("r");
    await launch();
    await page.waitForTimeout(180);
    expect((await audit(page)).starts).toBe(paused.starts);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page
      .getByRole("button", { name: "Choose mode", exact: true })
      .click();
    await expect
      .poll(async () =>
        (await audit(page)).contexts.every((state) => state === "closed"),
      )
      .toBe(true);
    expect((await audit(page)).disconnects).toBeGreaterThan(0);
  });
}

test("real gravity speed gains drive a bounded native WebAudio swell", async ({
  page,
}) => {
  await page.addInitScript(markTutorialSeen);
  await page.addInitScript(instrumentAudio);
  await page.goto("/?mode=gravity&seed=42");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Sound off", exact: true }).click();
  const result = await page.evaluate(async () => {
    // Vite serves the same application modules used by the game.
    // @ts-expect-error browser-only Vite module URL
    const { GravityEngine } = await import("/src/gravity/engine.ts");
    // @ts-expect-error browser-only Vite module URL
    const { AccelerationSoundTracker } =
      await import("/src/audio/acceleration.ts");
    // @ts-expect-error browser-only Vite module URL
    const { OrbitSound } = await import("/src/sound.ts");
    const engine = new GravityEngine(42, {
      index: 0,
      seed: 42,
      family: "loop",
      bounds: { x: -600, y: -600, width: 1200, height: 1200 },
      launch: { x: -240, y: 0 },
      bodies: [
        {
          id: "well",
          kind: "attractor",
          position: { x: 0, y: 0 },
          radius: 20,
          strength: 50000000,
        },
      ],
      objective: { kind: "none", count: 0, turns: 0, hold: 0 },
      witness: [],
    });
    const tracker = new AccelerationSoundTracker(),
      sound = new OrbitSound();
    await sound.unlock();
    sound.setEnabled(true);
    engine.launchFrom({ x: -240, y: 0 }, { x: 100, y: 0 });
    let cues = 0;
    for (let i = 0; i < 65; i++) {
      engine.update(1 / 120 / engine.getRenderSnapshot().timeScale);
      const state = engine.getRenderSnapshot(),
        cue = tracker.sample(state.particles, state.elapsed);
      if (cue) {
        cues++;
        sound.accelerate(cue.intensity);
      }
    }
    const native = (
      window as unknown as {
        audioAudit: {
          starts: number;
          positiveRamps: number;
          contexts: AudioContext[];
        };
      }
    ).audioAudit;
    const evidence = {
      cues,
      starts: native.starts,
      positiveRamps: native.positiveRamps,
      running: native.contexts.every((context) => context.state === "running"),
    };
    sound.destroy();
    return evidence;
  });
  expect(result.cues).toBeGreaterThan(0);
  expect(result.starts).toBe(2);
  expect(result.positiveRamps).toBe(2);
  expect(result.running).toBe(true);
});
