import { OrbitSound } from "../sound";
/** A very quiet, slowly breathing pad synthesized locally without recordings. */
export class GravityMusic {
  private sound = new OrbitSound();
  private timer: number | null = null;
  private active = false;
  private generation = 0;
  async play() {
    if (this.active) return;
    this.active = true;
    const generation = ++this.generation;
    await this.sound.unlock();
    if (!this.active || generation !== this.generation) return;
    this.sound.setEnabled(true);
    this.sound.ambient();
    this.timer = window.setInterval(() => this.sound.ambient(), 6500);
  }
  pause() {
    this.active = false;
    this.generation++;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.sound.setEnabled(false);
  }
  destroy() {
    this.pause();
    this.sound.destroy();
  }
}
