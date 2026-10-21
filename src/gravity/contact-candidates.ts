import type { GravityParticle } from "./types";

export type ContactPair = readonly [GravityParticle, GravityParticle];
type Box = { left: number; right: number; top: number; bottom: number };

/** Reuse a conservative pair list while every current sweep fits its cached box. */
export class ContactCandidates {
  private boxes: Box[] = [];
  private pairs: ContactPair[] = [];
  neighbors = new Map<GravityParticle, GravityParticle[]>();
  constructor(private particles: GravityParticle[]) {}

  get(seconds: number): ContactPair[] {
    if (
      this.boxes.length === this.particles.length &&
      this.particles.every((p, i) => {
        if (!p.alive) return true;
        const box = this.boxes[i];
        const endX = p.position.x + p.velocity.x * seconds;
        const endY = p.position.y + p.velocity.y * seconds;
        // Include the contact solver's numerical surface tolerance when
        // deciding whether a cached sweep still fits its original envelope.
        const padding = p.radius + 1e-6;
        return (
          Math.min(p.position.x, endX) - padding >= box.left &&
          Math.max(p.position.x, endX) + padding <= box.right &&
          Math.min(p.position.y, endY) - padding >= box.top &&
          Math.max(p.position.y, endY) + padding <= box.bottom
        );
      })
    )
      return this.pairs;
    this.boxes = this.particles.map((p) => {
      const endX = p.position.x + p.velocity.x * seconds;
      const endY = p.position.y + p.velocity.y * seconds;
      const padding = p.radius * 2 + 1e-6;
      return {
        left: Math.min(p.position.x, endX) - padding,
        right: Math.max(p.position.x, endX) + padding,
        top: Math.min(p.position.y, endY) - padding,
        bottom: Math.max(p.position.y, endY) + padding,
      };
    });
    this.pairs = [];
    this.neighbors = new Map();
    for (let i = 0; i < this.particles.length; i++)
      for (let j = i + 1; j < this.particles.length; j++) {
        const a = this.boxes[i],
          b = this.boxes[j];
        if (
          a.left <= b.right &&
          a.right >= b.left &&
          a.top <= b.bottom &&
          a.bottom >= b.top
        ) {
          const a = this.particles[i],
            b = this.particles[j];
          this.pairs.push([a, b]);
          const neighbors = this.neighbors.get(a) ?? [];
          neighbors.push(b);
          this.neighbors.set(a, neighbors);
        }
      }
    return this.pairs;
  }
}
