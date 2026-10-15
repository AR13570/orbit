interface AudioParticle {
  id: number;
  alive: boolean;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
}
export interface AccelerationCue {
  particleId: number;
  intensity: number;
}
interface Observation {
  time: number;
  speed: number;
}
interface Track {
  born: number;
  history: Observation[];
  position: { x: number; y: number };
  armed: boolean;
  lastCue: number;
}
/** Observes physical snapshot time, never frame timing or launch assignments. */
export class AccelerationSoundTracker {
  private tracks = new Map<number, Track>();
  private lastTime: number | null = null;
  private lastCue = -Infinity;
  reset() {
    this.tracks.clear();
    this.lastTime = null;
    this.lastCue = -Infinity;
  }
  sample(
    particles: readonly AudioParticle[],
    time: number,
  ): AccelerationCue | null {
    if (!Number.isFinite(time)) {
      this.reset();
      return null;
    }
    if (
      this.lastTime !== null &&
      (time < this.lastTime || time - this.lastTime > 0.25)
    )
      this.reset();
    if (this.lastTime !== null && time - this.lastTime < 0.045) return null;
    const dt = this.lastTime === null ? 0 : time - this.lastTime;
    this.lastTime = time;
    const live = new Set<number>();
    let strongest: AccelerationCue | null = null;
    for (const p of particles) {
      const speed = Math.hypot(p.velocity.x, p.velocity.y);
      if (!p.alive || !Number.isFinite(speed + p.position.x + p.position.y))
        continue;
      live.add(p.id);
      let track = this.tracks.get(p.id);
      const previous = track?.history.at(-1);
      if (
        !track ||
        !previous ||
        Math.hypot(
          p.position.x - track.position.x,
          p.position.y - track.position.y,
        ) >
          50 + Math.max(speed, previous.speed) * dt * 3
      ) {
        track = {
          born: time,
          history: [],
          position: { ...p.position },
          armed: true,
          lastCue: -Infinity,
        };
        this.tracks.set(p.id, track);
      }
      track.position = { ...p.position };
      track.history.push({ time, speed });
      while (track.history.length > 1 && time - track.history[0].time > 0.3)
        track.history.shift();
      const baseline = track.history[0];
      const span = time - baseline.time;
      if (time - track.born < 0.28 || span < 0.18) continue;
      const gain = speed - baseline.speed;
      const threshold = Math.max(28, baseline.speed * 0.16);
      if (gain < threshold * 0.35 && time - track.lastCue > 1.6)
        track.armed = true;
      if (!track.armed || gain < threshold || gain / span < 100) continue;
      const rises = track.history
        .slice(1)
        .map((point, i) => point.speed - track!.history[i].speed);
      // A collision or velocity reassignment must not supply the qualifying gain.
      if (
        rises.filter((rise) => rise > 1).length < 3 ||
        gain - Math.max(...rises) < threshold
      )
        continue;
      track.armed = false;
      track.lastCue = time;
      const intensity = Math.min(1, (gain / threshold) * 0.35);
      if (!strongest || intensity > strongest.intensity)
        strongest = { particleId: p.id, intensity };
    }
    for (const id of this.tracks.keys())
      if (!live.has(id)) this.tracks.delete(id);
    if (!strongest || time - this.lastCue < 0.8) return null;
    this.lastCue = time;
    return strongest;
  }
}
