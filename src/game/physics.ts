import type { Body, Checkpoint, Vec2 } from './types';
export const FIXED_STEP = 1 / 120;
// Keep the baseline helpers stable for generation and Gravity. Zen runs the same
// spatial integration steps in less real time, with velocity and force scaled together.
export const ZEN_SPEED_SCALE = 1.65;
export const ZEN_FORCE_SCALE = ZEN_SPEED_SCALE ** 2;
export const ZEN_FIXED_STEP = FIXED_STEP / ZEN_SPEED_SCALE;
export const OFFSCREEN_TIMEOUT_SECONDS = 6;
export const MAX_FLIGHT_SECONDS = 22;
export const WORLD_SIZE = 900;
export const WORLD_WIDTH = 1250;
export const VERIFIED_SPEED = 240;
export const AREA_STRENGTH_COEFFICIENT = 900;
export const SHIP_RADIUS = 5;
export const CHECKPOINT_ASSIST_STRENGTH = 1000000000;
export const CHECKPOINT_MAX_ACCELERATION = 1200;
export const CHECKPOINT_ASSIST_RANGE = 800;
export const CHECKPOINT_SOFTENING = 90;
export function bodyStrength(radius: number): number {
  return Number.isFinite(radius) && radius > 0 ? radius * radius * AREA_STRENGTH_COEFFICIENT : 0;
}
function validGravityScale(scale:number|undefined):number {return scale!==undefined&&Number.isFinite(scale)&&scale>0?scale:1;}
export function checkpointForceAt(position:Vec2,checkpoint:Checkpoint):Vec2 {
  if(!Number.isFinite(checkpoint.radius)||checkpoint.radius<=0)return {x:0,y:0};
  const dx=checkpoint.position.x-position.x,dy=checkpoint.position.y-position.y,square=dx*dx+dy*dy;
  const gravityScale=validGravityScale(checkpoint.gravityScale);
  const range=CHECKPOINT_ASSIST_RANGE*gravityScale;
  if(square===0||square>=range*range)return {x:0,y:0};
  const softening=CHECKPOINT_SOFTENING*gravityScale;
  const coefficient=CHECKPOINT_ASSIST_STRENGTH*gravityScale*gravityScale/Math.pow(square+softening*softening,1.5);
  const magnitude=coefficient*Math.sqrt(square),falloff=1-square/(range*range);
  const scale=coefficient*CHECKPOINT_MAX_ACCELERATION/(CHECKPOINT_MAX_ACCELERATION+magnitude)*falloff*falloff;
  return {x:dx*scale/gravityScale,y:dy*scale/gravityScale};
}
export function forceAt(position: Vec2, bodies: readonly Body[], checkpoint?:Checkpoint|null): Vec2 {
  let x = 0;
  let y = 0;
  for (const body of bodies) {
    const dx = body.position.x - position.x;
    const dy = body.position.y - position.y;
    const square = dx * dx + dy * dy;
    if (square < 0.000001) continue;
    const gravityScale=validGravityScale(body.gravityScale);
    const softening = Math.max(40 * gravityScale, body.radius * 0.75);
    const magnitude = (body.kind === 'attractor' ? 1 : -1) * bodyStrength(body.radius) / ((square + softening * softening) * gravityScale);
    const inverseDistance = 1 / Math.sqrt(square);
    x += dx * inverseDistance * magnitude;
    y += dy * inverseDistance * magnitude;
  }
  if(checkpoint){const goalForce=checkpointForceAt(position,checkpoint);x+=goalForce.x;y+=goalForce.y;}
  const magnitude = Math.hypot(x, y);
  const maxAcceleration=840/validGravityScale(checkpoint?.gravityScale);
  const scale = magnitude > maxAcceleration ? maxAcceleration / magnitude : 1;
  return { x: x * scale, y: y * scale };
}
export function distance(a: Vec2, b: Vec2): number { return Math.hypot(a.x - b.x, a.y - b.y); }
export function stepParticle(position: Vec2, velocity: Vec2, bodies: readonly Body[], dt = FIXED_STEP, checkpoint?:Checkpoint|null): { position: Vec2; velocity: Vec2 } {
  const force = forceAt(position, bodies, checkpoint);
  const nextVelocity = { x: velocity.x + force.x * dt, y: velocity.y + force.y * dt };
  return { position: { x: position.x + nextVelocity.x * dt, y: position.y + nextVelocity.y * dt }, velocity: nextVelocity };
}
export function stepZenParticle(position:Vec2,velocity:Vec2,bodies:readonly Body[],dt=ZEN_FIXED_STEP,checkpoint?:Checkpoint|null):{position:Vec2;velocity:Vec2} {
  const force=forceAt(position,bodies,checkpoint);
  const nextVelocity={x:velocity.x+force.x*ZEN_FORCE_SCALE*dt,y:velocity.y+force.y*ZEN_FORCE_SCALE*dt};
  return {position:{x:position.x+nextVelocity.x*dt,y:position.y+nextVelocity.y*dt},velocity:nextVelocity};
}
export function segmentCircleIntersection(from: Vec2, to: Vec2, center: Vec2, radius: number): number | null {
  // A segment outside one side of the circle's bounding box cannot contact it.
  // Keep the exact quadratic unchanged for every possible swept contact.
  const extent=Math.abs(radius);
  if((from.x<center.x-extent&&to.x<center.x-extent)||(from.x>center.x+extent&&to.x>center.x+extent)||(from.y<center.y-extent&&to.y<center.y-extent)||(from.y>center.y+extent&&to.y>center.y+extent))return null;
  const x = from.x - center.x;
  const y = from.y - center.y;
  const c = x * x + y * y - radius * radius;
  if (c <= 0) return 0;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const a = dx * dx + dy * dy;
  if (a < 1e-16) return null;
  const b = 2 * (x * dx + y * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}
export function launchSpeed(power: number): number {
  return Math.max(0, Math.min(1, power)) * 420;
}
export function zenLaunchSpeed(power:number):number {return launchSpeed(power)*ZEN_SPEED_SCALE;}
