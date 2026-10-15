import { expect, test, type Page } from "@playwright/test";
import { markTutorialSeen } from "./tutorial-fixture";

// Keep native activation and scheduling, observing the actual WebAudio graph.
function instrumentAudio() {
  const NativeAudio = window.AudioContext;
  const envelopes = new WeakMap<AudioNode, { peak: number; at: number }>();
  const audit = {
    contexts: [] as AudioContext[],
    starts: 0,
    positiveRamps: 0,
    frequencies: [] as number[],
    types: [] as OscillatorType[],
    tones: [] as {
      frequency: number;
      peak: number;
      at: number;
      attack: number;
      duration: number;
    }[],
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
      const tone = { frequency: 0, peak: 0, at: 0, attack: 0, duration: 0 };
      let envelope: { peak: number; at: number } | undefined;
      const connect = node.connect;
      node.connect = ((...args: unknown[]) => {
        if (args[0] instanceof AudioNode) envelope = envelopes.get(args[0]);
        return Reflect.apply(connect, node, args);
      }) as typeof node.connect;
      const frequency = node.frequency.setValueAtTime.bind(node.frequency);
      node.frequency.setValueAtTime = (value, at) => {
        audit.frequencies.push(value);
        tone.frequency = value;
        return frequency(value, at);
      };
      const start = node.start.bind(node),
        stop = node.stop.bind(node),
        disconnect = node.disconnect.bind(node);
      node.start = (at = 0) => {
        audit.starts++;
        audit.types.push(node.type);
        tone.at = at;
        tone.peak = envelope?.peak ?? 0;
        tone.attack = (envelope?.at ?? at) - at;
        audit.tones.push(tone);
        start(at);
      };
      node.stop = (at = 0) => {
        audit.stops.push({ now: this.currentTime, at });
        tone.duration = at - tone.at;
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
      const envelope = { peak: 0, at: 0 };
      envelopes.set(gain, envelope);
      gain.gain.linearRampToValueAtTime = (value, at) => {
        if (value > 0) audit.positiveRamps++;
        if (value > envelope.peak) {
          envelope.peak = value;
          envelope.at = at;
        }
        return ramp(value, at);
      };
      return gain;
    }
  };
}
async function audit(page: Page) {
  return page.evaluate(() => {
    const value = (
      window as unknown as {
        audioAudit: {
          contexts: AudioContext[];
          starts: number;
          positiveRamps: number;
          frequencies: number[];
          types: OscillatorType[];
          tones: {
            frequency: number;
            peak: number;
            at: number;
            attack: number;
            duration: number;
          }[];
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
async function launch(page: Page) {
  const canvas = page.locator("canvas").first(),
    box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.65);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width * 0.55 - 95,
    box.y + box.height * 0.65 + 25,
    { steps: 5 },
  );
  await page.mouse.up();
}
async function expectMusic(page: Page) {
  await expect
    .poll(async () => (await audit(page)).positiveRamps)
    .toBeGreaterThan(0);
  expect(
    (await audit(page)).contexts.filter((state) => state === "running"),
  ).toHaveLength(1);
}
async function expectStopped(page: Page) {
  const paused = await audit(page);
  expect(paused.stops.some((stop) => stop.at - stop.now <= 0.09)).toBe(true);
  await page.waitForTimeout(350);
  expect((await audit(page)).starts).toBe(paused.starts);
  return paused.starts;
}
for (const mode of ["zen", "gravity"] as const) {
  test(`${mode} default ambient music starts on first keyboard interaction and stops with pause, mute and exit`, async ({
    page,
  }) => {
    await page.addInitScript(markTutorialSeen);
    await page.addInitScript(instrumentAudio);
    await page.goto(`/?mode=${mode}&seed=42`);
    await page.keyboard.press("Tab");
    await expectMusic(page);
    await launch(page);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Sound on", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const pausedStarts = await expectStopped(page);
    await page.getByRole("button", { name: "Sound on", exact: true }).click();
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await launch(page);
    await page.waitForTimeout(350);
    expect((await audit(page)).starts).toBe(pausedStarts);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByRole("button", { name: "Sound off", exact: true }).click();
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect
      .poll(async () => (await audit(page)).starts)
      .toBeGreaterThan(pausedStarts);
    expect(
      (await audit(page)).contexts.filter((state) => state === "running"),
    ).toHaveLength(1);
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

  test(`${mode} shared music has a warm melody, quiet support and faint accents without gameplay sounds`, async ({
    page,
  }) => {
    test.setTimeout(45000);
    await page.addInitScript(markTutorialSeen);
    await page.addInitScript(instrumentAudio);
    await page.goto("/?seed=42");
    const selectMode = () =>
      page
        .getByRole("button", {
          name: mode === "zen" ? /^Zen/ : /Gravity.*Build living/,
        })
        .click();
    await selectMode();
    await expectMusic(page);
    await expect
      .poll(async () => (await audit(page)).tones.length, { timeout: 10000 })
      .toBeGreaterThanOrEqual(24);
    const passive = await audit(page);
    const signature = (tones: typeof passive.tones) =>
      tones.slice(0, 24).map(({ frequency, peak, attack }) => ({
        frequency: Math.round(frequency * 100),
        peak: Math.round(peak * 1000000),
        attack: Math.round(attack * 1000),
      }));
    const melody = passive.tones.filter(
      (tone) =>
        tone.attack >= 0.03 && tone.attack <= 0.12 && tone.peak >= 0.012,
    );
    expect(
      new Set(melody.map((tone) => Math.round(tone.frequency))).size,
    ).toBeGreaterThanOrEqual(4);
    const melodyPeak = Math.max(...melody.map((tone) => tone.peak));
    expect(melodyPeak).toBeLessThanOrEqual(0.028);
    const support = passive.tones.filter(
      (tone) => tone.attack >= 0.35 && tone.frequency < 500,
    );
    expect(support.length).toBeGreaterThanOrEqual(3);
    expect(
      support.every((tone) => tone.peak > 0 && tone.peak <= melodyPeak * 0.3),
    ).toBe(true);

    // A fresh score must be identical when launch and retry events happen.
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page
      .getByRole("button", { name: "Choose mode", exact: true })
      .click();
    const offset = (await audit(page)).tones.length;
    await selectMode();
    await expectMusic(page);
    await launch(page);
    await page.keyboard.press("r");
    await launch(page);
    await expect
      .poll(async () => (await audit(page)).tones.length - offset, {
        timeout: 10000,
      })
      .toBeGreaterThanOrEqual(24);
    const played = (await audit(page)).tones.slice(offset);
    expect(signature(played)).toEqual(signature(passive.tones));
    const accent = (tones: typeof passive.tones) =>
      tones.filter(
        (tone) =>
          tone.attack >= 0.03 &&
          tone.attack <= 0.12 &&
          tone.frequency >= 400 &&
          tone.frequency < 700 &&
          tone.duration >= 1 &&
          tone.duration <= 3 &&
          tone.peak > 0 &&
          tone.peak <= 0.003,
      );
    await expect
      .poll(
        async () => accent((await audit(page)).tones.slice(offset)).length,
        { timeout: 30000 },
      )
      .toBeGreaterThan(0);
    const playing = await audit(page);
    expect(
      accent(playing.tones.slice(offset)).every(
        (tone) => tone.peak <= melodyPeak * 0.15,
      ),
    ).toBe(true);
    expect(playing.tones.every((tone) => tone.peak <= 0.028)).toBe(true);
    expect(playing.types.every((type) => type === "sine")).toBe(true);
    expect(
      playing.contexts.filter((state) => state === "running"),
    ).toHaveLength(1);
  });

  test(`${mode} tutorial stays silent until dismissed and replaying it pauses music`, async ({
    page,
  }) => {
    await page.addInitScript(instrumentAudio);
    await page.goto(`/?mode=${mode}&seed=42`);
    await page.keyboard.press("ArrowRight");
    expect((await audit(page)).starts).toBe(0);
    await page.keyboard.press("Escape");
    await launch(page);
    await expectMusic(page);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    const pausedStarts = await expectStopped(page);
    await page
      .getByRole("button", { name: "How to play", exact: true })
      .click();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(350);
    expect((await audit(page)).starts).toBe(pausedStarts);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
    expect((await audit(page)).starts).toBe(pausedStarts);
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect
      .poll(async () => (await audit(page)).starts)
      .toBeGreaterThan(pausedStarts);
  });
}
