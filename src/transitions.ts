import type { GameStatus } from "./game/types";
export class FeedbackClock {
  private status: GameStatus = "aiming";
  private elapsed = 0;
  private handled = false;
  step(
    status: GameStatus,
    dt: number,
    active: boolean,
  ): "advance" | "retry" | null {
    if (status !== this.status) {
      this.status = status;
      this.elapsed = 0;
      this.handled = false;
    }
    if (!active || this.handled || !["docked", "failed"].includes(status))
      return null;
    this.elapsed += Math.max(0, dt);
    if (this.elapsed < 0.65) return null;
    this.handled = true;
    return status === "docked" ? "advance" : "retry";
  }
  reset() {
    this.status = "aiming";
    this.elapsed = 0;
    this.handled = false;
  }
}
