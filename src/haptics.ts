type VibrationDevice = { vibrate?: (duration: number) => boolean };

/** Gesture-scoped feedback. A tap or a pinch start is not yet a deliberate aim. */
export class AimHaptics {
  private touch = false;
  private acknowledged = false;
  constructor(
    private device: VibrationDevice = typeof navigator === "undefined"
      ? {}
      : navigator,
  ) {}
  begin(pointerType: string): void {
    this.touch = pointerType === "touch";
    this.acknowledged = false;
  }
  aim(distance: number, valid: boolean): void {
    if (!this.touch || this.acknowledged || !valid || distance < 8) return;
    this.acknowledged = true;
    this.pulse(6);
  }
  release(launched: boolean): void {
    if (this.touch && launched) this.pulse(10);
    this.cancel();
  }
  cancel(): void {
    this.touch = false;
    this.acknowledged = false;
  }
  private pulse(duration: number): void {
    try {
      this.device.vibrate?.(duration);
    } catch {
      // Vibration is optional and some browser/device policies reject it.
    }
  }
}
