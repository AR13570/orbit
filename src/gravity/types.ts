import type { Aim, Body, Vec2, WorldBounds } from "../game/types";
export type { Aim, Body, Vec2, WorldBounds } from "../game/types";
export type PuzzleFamily = "loop" | "crowd" | "counter" | "paired" | "tour";
export type PlanetCollisionPolicy = "none" | "soft" | "elastic" | "merge";
export interface GravityPhysicsOptions {
  planetGravity?: boolean;
  planetCollisions?: PlanetCollisionPolicy;
  bodyCollisions?: boolean;
  planetMass?: number;
  planetRadius?: number;
  /** World gravitational constant used between moving planets. */
  planetGravityStrength?: number;
  trailSeconds?: number;
  /** Distance beyond the field, only unbound outward planets are removed. */
  escapeDistance?: number;
}
export interface GravityPhysicsSettings {
  planetGravity: boolean;
  planetCollisions: PlanetCollisionPolicy;
  bodyCollisions: boolean;
  planetMass: number;
  planetRadius: number;
  planetGravityStrength: number;
  trailSeconds: number;
  escapeDistance: number;
}
export interface GravityOrbitRequirement {
  bodyId: string;
  count: number;
  turns?: number;
  /** Positive angles turn clockwise in Canvas world coordinates. */
  direction?: "either" | "clockwise" | "counterclockwise";
}
export interface GravityObjective {
  kind: PuzzleFamily | "none";
  count: number;
  turns: number;
  hold: number;
}
export interface WitnessShot extends Aim {
  time: number;
  position?: Vec2;
  velocity?: Vec2;
}
export interface GravityWellMotion {
  bodyId: string;
  kind: "circle" | "oscillate";
  center: Vec2;
  radius?: number;
  amplitude?: Vec2;
  period: number;
  /** Radians at physical time zero. */
  phase?: number;
}
export interface GravityLevel {
  index: number;
  seed: number;
  family: GravityObjective["kind"];
  bounds: WorldBounds;
  launch: Vec2;
  bodies: Body[];
  objective: GravityObjective;
  requirements?: GravityOrbitRequirement[];
  /** One planet must curve around these cores in this order. Progress is never pooled. */
  journey?: { legs: { bodyId: string; radius: number; sweep: number }[] };
  /** Each qualifying planet must complete a shared outer orbit around every core. */
  sharedOrbit?: string[];
  sharedCounter?: boolean;
  /** Extra room for authored outer orbits and flybys in the default camera. */
  orbitPadding?: number;
  physics?: GravityPhysicsOptions;
  motions?: GravityWellMotion[];
  title?: string;
  layout?: string;
  source?: "campaign" | "procedural";
  mechanics?: string[];
  /** A hidden verified sequence, never used by the player-facing renderer. */
  witness: WitnessShot[];
}
export type GravityLevelProvider = (
  seed: number,
  index: number,
) => GravityLevel;
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
  mass: number;
  radius: number;
  /** Size chosen at launch, retained for legibility when the camera zooms out. */
  projectileSize?: number;
  alive: boolean;
  color: string;
  born: number;
  outside: number;
  trail: TrailPoint[];
  orbits: Record<string, OrbitTrack>;
  journey?: { leg: number; sweep: number; angle?: number };
}
export interface GravityState {
  /** Opt-in gameplay torque history. Absent in pure authored/reference worlds. */
  groupSpin?: {
    groups: Record<string, number>;
    /** Last qualified direction, used only when current angular momentum is negligible. */
    directions?: Record<string, number>;
    physicsKey?: string;
  };
  /** Full canvas world rectangle at the outermost gameplay zoom, when a UI is attached. */
  flightBounds?: WorldBounds;
  /** Optional for standalone authored simulations, which use the default size. */
  projectileSize?: number;
  level: GravityLevel;
  physics: GravityPhysicsSettings;
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
  bodies?: { bodyId: string; current: number; target: number }[];
}
export interface GravitySnapshot extends GravityState {
  aim: Aim;
  launchPosition: Vec2;
  paused: boolean;
  timeScale: number;
  complete: boolean;
  completedCount: number;
  progress: GoalProgress;
}
