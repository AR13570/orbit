interface MusicVoice {
  oscillators: OscillatorNode[];
  gains: GainNode[];
}

// Four related eight-beat phrases: D, G, B minor, A, then home to D.
const PHRASES = [
  {
    chord: [146.83, 184.997, 220],
    melody: [293.66, 369.99, 440, 369.99, 329.63, 369.99, 329.63, 293.66],
  },
  {
    chord: [196, 246.94, 293.66],
    melody: [246.94, 293.66, 392, 369.99, 329.63, 293.66, 246.94, 293.66],
  },
  {
    chord: [123.47, 293.66, 369.99],
    melody: [369.99, 440, 493.88, 440, 369.99, 329.63, 369.99, 293.66],
  },
  {
    chord: [220, 277.18, 329.63],
    melody: [329.63, 369.99, 440, 329.63, 392, 369.99, 329.63, 277.18],
  },
];
const BEAT = 60 / 82;
const ONSETS = [0, 1, 1.5, 2, 3, 4, 5, 6];
const DYNAMICS = [0.9, 0.72, 0.8, 0.82, 0.72, 0.88, 0.7, 0.78];
type Instrument = "keys" | "support" | "chime";

/** A gentle composed tune, warm keys and changing chords, with rare chime accents. */
export class AmbientMusic {
  private context: AudioContext | null = null;
  private timer: number | null = null;
  private active = false;
  private generation = 0;
  private step = 0;
  private voices = new Set<MusicVoice>();

  async unlock() {
    try {
      if (typeof AudioContext === "undefined") return;
      this.context ??= new AudioContext();
      await this.context.resume();
    } catch {
      // A blocked autoplay attempt must remain retryable from a user gesture.
    }
  }

  async play() {
    if (this.active) return;
    const generation = ++this.generation;
    await this.unlock();
    if (generation !== this.generation || this.context?.state !== "running")
      return;
    this.active = true;
    this.phrase();
  }

  private phrase() {
    if (!this.active) return;
    const step = this.step++,
      note = step % ONSETS.length,
      phraseIndex = Math.floor(step / ONSETS.length) % PHRASES.length,
      phrase = PHRASES[phraseIndex];
    this.tone(phrase.melody[note], "keys", DYNAMICS[note]);
    if (note === 0)
      phrase.chord.forEach((frequency, index) =>
        this.tone(frequency, "support", index === 0 ? 1 : 0.65),
      );
    if (phraseIndex === 3 && note === 7)
      this.tone(phrase.melody[note] * 2, "chime", 1);
    const nextBeat = note === ONSETS.length - 1 ? 8 : ONSETS[note + 1];
    this.timer = window.setTimeout(
      () => this.phrase(),
      (nextBeat - ONSETS[note]) * BEAT * 1000,
    );
  }

  private tone(frequency: number, instrument: Instrument, strength: number) {
    const ctx = this.context;
    if (!ctx || ctx.state !== "running" || this.voices.size >= 8) return;
    const voice: MusicVoice = { oscillators: [], gains: [] };
    this.voices.add(voice);
    try {
      // Harmonic felt-key overtones soften quickly; the chords breathe underneath.
      const partials =
        instrument === "keys"
          ? [
              [1, 0.028, 0.055, 1.65],
              [2, 0.006, 0.055, 0.95],
              [3, 0.0012, 0.055, 0.6],
            ]
          : instrument === "support"
            ? [
                [1, 0.005, 0.5, 5.4],
                [2, 0.0012, 0.5, 4.8],
              ]
            : [
                [1, 0.002, 0.06, 2.4],
                [2.756, 0.00035, 0.06, 1.4],
              ];
      for (const [ratio, peak, attack, duration] of partials) {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        voice.oscillators.push(oscillator);
        voice.gains.push(gain);
        const time = ctx.currentTime;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency * ratio, time);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(peak * strength, time + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration - 0.1);
        gain.gain.linearRampToValueAtTime(0, time + duration);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
          oscillator.onended = null;
          if (voice.oscillators.every((node) => node.onended === null))
            this.voices.delete(voice);
        };
        oscillator.start(time);
        oscillator.stop(time + duration + 0.01);
      }
    } catch {
      this.stop(voice, true);
    }
  }

  private stop(voice: MusicVoice, immediate = false) {
    const time = this.context?.currentTime ?? 0;
    for (const gain of voice.gains) {
      try {
        gain.gain.cancelAndHoldAtTime(time);
        gain.gain.linearRampToValueAtTime(0, time + 0.04);
      } catch {
        // Stopping the oscillator still silences older audio implementations.
      }
    }
    for (const oscillator of voice.oscillators) {
      try {
        oscillator.stop(time + (immediate ? 0 : 0.05));
      } catch {
        // The source may already have ended.
      }
      if (immediate) {
        oscillator.onended = null;
        oscillator.disconnect();
      }
    }
    if (immediate) {
      for (const gain of voice.gains) gain.disconnect();
      this.voices.delete(voice);
    }
  }

  pause() {
    this.active = false;
    this.generation++;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    for (const voice of this.voices) this.stop(voice);
  }

  destroy() {
    this.pause();
    for (const voice of this.voices) this.stop(voice, true);
    void this.context?.close().catch(() => {});
    this.context = null;
  }
}
