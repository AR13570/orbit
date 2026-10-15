/** Global world coordinates. Positive angles turn clockwise on the canvas. */
export interface Vec2 { x: number; y: number }
export interface WorldBounds { x: number; y: number; width: number; height: number }
export type SectorFamily = 'staggered-binary' | 'three-step-slalom' | 'twin-well-entrance' | 'forked-approach' | 'split-exit' | 'alternating-corridor' | 'diagonal-ladder' | 'crescent-basin' | 'horseshoe-pocket' | 'unequal-binary' | 'separated-clusters' | 'opposing-banks' | 'outer-hairpin' | 'offset-paired-gates' | 'asymmetric-fan' | 'stepped-shelves' | 'triangular-islands' | 'sparse-anchors' | 'repellent-catch' | 'chained-binaries';
export type ChallengeValidation = 'geometric' | 'sampled';
export type GameStatus = 'aiming' | 'flying' | 'docked' | 'failed';
export type ShotCount = 1 | 3;
export type BodyKind = 'attractor' | 'repellent';
export interface Body { id: string; kind: BodyKind; position: Vec2; radius: number; strength: number; /** Scale softening and acceleration for longer formations at unchanged launch power. */ gravityScale?:number }
export interface Checkpoint { position: Vec2; radius: number; /** Scale the attraction field and acceleration independently of docking contact. */ gravityScale?:number }
export interface Aim { angle: number; power: number }
export interface ValidatedSolution { angle: number; power: number; speed: number; flightSeconds: number; path: Vec2[] }
export interface Sector {
  index: number;
  seed: number;
  width: number;
  height: number;
  bounds: WorldBounds;
  generation: { family: SectorFamily; fallback: boolean; validation?: ChallengeValidation; difficulty?:number };
  launch: Vec2;
  checkpoint: Checkpoint;
  bodies: Body[];
  /** Test-only verification metadata, never draw this route for players. */
  solution: ValidatedSolution;
}
export type DeepReadonly<T> = T extends readonly (infer Item)[] ? readonly DeepReadonly<Item>[] : T extends object ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> } : T;
export type StaticSector = DeepReadonly<Sector>;
export type SectorSnapshot = StaticSector;
export interface Particle { id: number; position: Vec2; velocity: Vec2; alive: boolean; /** Active seconds until expiry, present only while fully outside the viewport. */ offscreenRemaining?: number; trail: (Vec2 & { time?: number })[] }
export type EngineEventKind = 'launch' | 'dock' | 'fail' | 'restart';
export interface EngineEvent { id: number; kind: EngineEventKind }
export interface GameSnapshot {
  status: GameStatus;
  sector: SectorSnapshot;
  aim: Aim;
  /** User-selected firing mode, retained across checkpoints and restart/new seed. */
  shotCount: ShotCount;
  /** True only while a live mode-3 projectile can branch once on an in-flight tap. */
  canBranch: boolean;
  particles: Particle[];
  checkpointCount: number;
  message: string;
  elapsed: number;
  /** Active visual time, continuing after flight ends so tails can expire. */
  trailElapsed?: number;
  event: EngineEvent | null;
}
