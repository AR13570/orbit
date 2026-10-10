import type { EngineEventKind } from "./game/types";
export class OrbitSound {
  private context: AudioContext | null = null;
  unlock() {
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => {});
    } catch {
      /* Sound is optional. */
    }
  }
  play(kind: EngineEventKind) {
    if (!this.context || this.context.state !== "running") return;
    try {
      const tones =
        kind === "dock"
          ? [440, 660, 880]
          : kind === "fail"
            ? [180, 100]
            : kind === "launch"
              ? [220, 440]
              : [330];
      tones.forEach((frequency, i) => {
        const ctx = this.context!;
        const oscillator = ctx.createOscillator(),
          gain = ctx.createGain();
        const time = ctx.currentTime + i * 0.075;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, time);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.045, time + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(time);
        oscillator.stop(time + 0.2);
      });
    } catch {
      /* Unsupported audio should never interrupt flight. */
    }
  }
  destroy() {
    void this.context?.close().catch(() => {});
    this.context = null;
  }
}
