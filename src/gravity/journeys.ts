import type { GravityLevel, GravityParticle } from "./types";

/** A flyby must sweep a real arc near each core, in order, on the same planet. */
export function updateJourney(
  level: GravityLevel,
  particle: GravityParticle,
): void {
  if (!level.journey || !particle.alive) return;
  const track = (particle.journey ??= { leg: 0, sweep: 0 });
  const leg = level.journey.legs[track.leg];
  if (!leg) return;
  const body = level.bodies.find((body) => body.id === leg.bodyId);
  if (!body) return;
  const dx = particle.position.x - body.position.x,
    dy = particle.position.y - body.position.y;
  const angle = Math.atan2(dy, dx);
  if (Math.hypot(dx, dy) > leg.radius) {
    track.angle = undefined;
    track.sweep = 0;
    return;
  }
  if (track.angle !== undefined)
    track.sweep += Math.atan2(
      Math.sin(angle - track.angle),
      Math.cos(angle - track.angle),
    );
  track.angle = angle;
  if (Math.abs(track.sweep) + 1e-9 >= leg.sweep) {
    track.leg++;
    track.sweep = 0;
    track.angle = undefined;
  }
}
