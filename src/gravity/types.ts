import type { Aim, Body, Vec2, WorldBounds } from "../game/types";
export type PuzzleFamily = "loop" | "crowd" | "counter" | "paired" | "tour";
export interface GravityObjective {
  kind: PuzzleFamily | "none";
  count: number;
  turns: number;
  hold: number;
}
export interface WitnessShot extends Aim {
  time: number;
}
export interface GravityLevel {
  index: number;
  seed: number;
  family: GravityObjective["kind"];
  bounds: WorldBounds;
  launch: Vec2;
  bodies: Body[];
  objective: GravityObjective;
  /** A hidden verified sequence, never used by the player-facing renderer. */
  witness: WitnessShot[];
}
export interface OrbitTrack {
  angle: number;
  winding: number;
  localWinding: number;
  lapStart: number;
  lapBaseline: Record<string, number>;
}
export interface TrailPoint extends Vec2 {
  time: number;
}
export interface GravityParticle {
  id: number;
  position: Vec2;
  velocity: Vec2;
  alive: boolean;
  color: string;
  born: number;
  outside: number;
  trail: TrailPoint[];
  orbits: Record<string, OrbitTrack>;
}
export interface GravityState {
  level: GravityLevel;
  particles: GravityParticle[];
  elapsed: number;
  held: number;
  nextId: number;
  sampleClock: number;
}
export interface GoalProgress {
  current: number;
  target: number;
  held: number;
  hold: number;
  complete: boolean;
}
export interface GravitySnapshot extends GravityState {
  aim: Aim;
  complete: boolean;
  completedCount: number;
  progress: GoalProgress;
}
