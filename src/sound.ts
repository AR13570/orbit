import type { EngineEventKind } from "./game/types";
interface Voice {
  oscillators: OscillatorNode[];
  gains: GainNode[];
}
/** Quiet, original sine textures. Voices exist only for a finite gesture. */
export class OrbitSound {
  private context: AudioContext | null = null;
  private enabled = false;
  private voices = new Set<Voice>();
  private lastAcceleration = -Infinity;
  private readonly volume: number;
  constructor({ volume = 1 }: { volume?: number } = {}) {
    this.volume = Number.isFinite(volume)
      ? Math.max(0, Math.min(3, volume))
      : 1;
  }
  async unlock() {
    try {
      if (typeof AudioContext === "undefined") return;
      this.context ??= new AudioContext();
      await this.context.resume();
    } catch {
      /* Sound is optional, including browsers that block activation. */
    }
  }
  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      this.lastAcceleration = -Infinity;
      for (const voice of this.voices) this.stop(voice);
    }
  }
  play(kind: EngineEventKind) {
    if (kind === "restart") return;
    const shape =
      kind === "dock"
        ? { from: 164.81, to: 196, duration: 1.3, attack: 0.3, peak: 0.012 }
        : kind === "fail"
          ? { from: 110, to: 82.41, duration: 0.9, attack: 0.22, peak: 0.009 }
          : {
              from: 130.81,
              to: 174.61,
              duration: 0.8,
              attack: 0.16,
              peak: 0.012,
            };
    this.swell(shape);
  }
  accelerate(intensity: number) {
    const ctx = this.context;
    if (
      !Number.isFinite(intensity) ||
      intensity <= 0 ||
      !ctx ||
      ctx.currentTime - this.lastAcceleration < 0.8
    )
      return;
    if (
      this.swell({
        from: 87.31,
        to: 130.81 + Math.min(1, intensity) * 34,
        duration: 1.05,
        attack: 0.28,
        peak: 0.008 + Math.min(1, intensity) * 0.006,
      })
    )
      this.lastAcceleration = ctx.currentTime;
  }
  ambient({ from = 110, to = 108.5, peak = 0.005 } = {}) {
    this.swell({ from, to, duration: 6, attack: 2, peak });
  }
  private swell({
    from,
    to,
    duration,
    attack,
    peak,
  }: {
    from: number;
    to: number;
    duration: number;
    attack: number;
    peak: number;
  }) {
    const ctx = this.context;
    if (
      !this.enabled ||
      this.volume === 0 ||
      !ctx ||
      ctx.state !== "running" ||
      this.voices.size >= 3
    )
      return false;
    const voice: Voice = { oscillators: [], gains: [] };
    this.voices.add(voice);
    try {
      const time = ctx.currentTime;
      for (const [ratio, volume] of [
        [1, 1],
        [1.4983, 0.28],
      ]) {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        voice.oscillators.push(oscillator);
        voice.gains.push(gain);
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(from * ratio, time);
        oscillator.frequency.exponentialRampToValueAtTime(
          to * ratio,
          time + duration * 0.8,
        );
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(
          peak * volume * this.volume,
          time + attack,
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration - 0.06);
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
      return true;
    } catch {
      this.stop(voice, true);
      return false;
    }
  }
  private stop(voice: Voice, immediate = false) {
    const time = this.context?.currentTime ?? 0;
    for (const gain of voice.gains) {
      try {
        if (!immediate) {
          gain.gain.cancelAndHoldAtTime(time);
          gain.gain.linearRampToValueAtTime(0, time + 0.045);
        }
      } catch {
        /* Older audio implementations still stop the source below. */
      }
    }
    for (const oscillator of voice.oscillators) {
      try {
        oscillator.stop(time + (immediate ? 0 : 0.05));
      } catch {
        /* Already stopped. */
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
  destroy() {
    this.enabled = false;
    for (const voice of this.voices) this.stop(voice, true);
    void this.context?.close().catch(() => {});
    this.context = null;
    this.lastAcceleration = -Infinity;
  }
}
