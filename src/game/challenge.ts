import { FIXED_STEP,launchSpeed,segmentCircleIntersection,SHIP_RADIUS,stepParticle } from './physics';
import type { Body,Checkpoint,ValidatedSolution,Vec2 } from './types';
export interface ChallengeLayout { launch:Vec2; checkpoint:Checkpoint; bodies:readonly Body[] }
export interface SearchBudget { remaining:number }
export type ProbeEnding='collision'|'dock'|'unresolved';
export interface ProbeResult { ending:ProbeEnding; path:Vec2[] }
export const CHALLENGE_POWERS=[0.8,0.85,0.9,0.95,1] as const;
export const CHALLENGE_OFFSETS=[0,-0.025,0.025,-0.05,0.05] as const;
/** No edge or clock failure: unresolved is conservatively rejected, never difficulty evidence. */
export function probeFlight(layout:ChallengeLayout,angle:number,power:number,bodyForces=true,budget?:SearchBudget,sample=false):ProbeResult {
 const speed=launchSpeed(power);let position={...layout.launch},velocity={x:Math.cos(angle)*speed,y:Math.sin(angle)*speed};
 const path:Vec2[]=sample?[{...position}]:[];
 for(let step=0;step<2640;step++){
  if(budget&&budget.remaining--<=0)return {ending:'unresolved',path};
  const next=stepParticle(position,velocity,bodyForces?layout.bodies:[],FIXED_STEP,layout.checkpoint),dock=segmentCircleIntersection(position,next.position,layout.checkpoint.position,layout.checkpoint.radius+SHIP_RADIUS);
  for(const body of layout.bodies){const hit=segmentCircleIntersection(position,next.position,body.position,body.radius+SHIP_RADIUS);if(hit!==null&&(dock===null||hit<=dock))return {ending:'collision',path};}
  if(dock!==null)return {ending:'dock',path};
  position=next.position;velocity=next.velocity;if(sample&&(step+1)%4===0)path.push({...position});
 }return {ending:'unresolved',path};
}
export function acceptsChallenge(layout:ChallengeLayout,solution:Pick<ValidatedSolution,'angle'|'power'>,budget?:SearchBudget):boolean {
 if(probeFlight(layout,solution.angle,solution.power,false,budget).ending!=='collision')return false;
 const bearing=Math.atan2(layout.checkpoint.position.y-layout.launch.y,layout.checkpoint.position.x-layout.launch.x);
 for(const power of CHALLENGE_POWERS)for(const offset of CHALLENGE_OFFSETS)if(probeFlight(layout,bearing+offset,power,true,budget).ending!=='collision')return false;
 return true;
}
