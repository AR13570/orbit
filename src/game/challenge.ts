import { FIXED_STEP,launchSpeed,segmentCircleIntersection,SHIP_RADIUS,stepParticle } from './physics';
import type { Body,ChallengeValidation,Checkpoint,ValidatedSolution,Vec2 } from './types';
export interface ChallengeLayout { launch:Vec2; checkpoint:Checkpoint; bodies:readonly Body[] }
export interface SearchBudget { remaining:number }
export type ProbeEnding='collision'|'dock'|'unresolved';
export interface ProbeResult { ending:ProbeEnding; path:Vec2[] }
export const CHALLENGE_POWERS=[0.8,0.85,0.9,0.95,1] as const;
export const CHALLENGE_OFFSETS=[0,-0.025,0.025,-0.05,0.05] as const;
/** Eroded angular shadows certify a bend for every possible capture chord. */
export const MIN_TRANSFER_DETOUR=70;
export const MIN_CAPTURE_CHORD_BEND=70;
export function blocksStraightCorridor(layout:ChallengeLayout):boolean {
 const dx=layout.checkpoint.position.x-layout.launch.x,dy=layout.checkpoint.position.y-layout.launch.y,length=Math.hypot(dx,dy),aperture=layout.checkpoint.radius+SHIP_RADIUS;
 if(length<=aperture||layout.bodies.some(body=>Math.hypot(body.position.x-layout.launch.x,body.position.y-layout.launch.y)<=body.radius+SHIP_RADIUS))return false;
 const cone=Math.asin(aperture/length),intervals:[number,number][]=[];
 for(const body of layout.bodies){
  const bx=body.position.x-layout.launch.x,by=body.position.y-layout.launch.y,along=(bx*dx+by*dy)/length,lateral=(by*dx-bx*dy)/length,distance=Math.hypot(along,lateral),eroded=body.radius+SHIP_RADIUS-MIN_CAPTURE_CHORD_BEND;
  // Its projected blocking plane must precede every capture contact. Bodies behind
  // the aperture and launch cannot contribute to the certificate.
  if(eroded<=0||distance>=length-aperture||along*Math.cos(cone)-Math.abs(lateral)*Math.sin(cone)<=0||distance<=body.radius+SHIP_RADIUS)continue;
  const center=Math.atan2(lateral,along),spread=Math.asin(Math.min(1,eroded/distance));intervals.push([center-spread,center+spread]);
 }
 intervals.sort((a,b)=>a[0]-b[0]);let covered=-cone;
 for(const [start,end] of intervals){if(end<covered)continue;if(start>covered)return false;covered=Math.max(covered,end);if(covered>=cone)return true;}
 return false;
}
/** No edge or clock failure: unresolved is conservatively rejected, never difficulty evidence. */
export function probeFlight(layout:ChallengeLayout,angle:number,power:number,bodyForces=true,budget?:SearchBudget,sample=false,observationSeconds=22):ProbeResult {
 const speed=launchSpeed(power);let position={...layout.launch},velocity={x:Math.cos(angle)*speed,y:Math.sin(angle)*speed};
 const path:Vec2[]=sample?[{...position}]:[];
 for(let step=0;step<Math.min(2640,Math.max(0,Math.floor(observationSeconds/FIXED_STEP)));step++){
  if(budget&&budget.remaining--<=0)return {ending:'unresolved',path};
  const next=stepParticle(position,velocity,bodyForces?layout.bodies:[],FIXED_STEP,layout.checkpoint),dock=segmentCircleIntersection(position,next.position,layout.checkpoint.position,layout.checkpoint.radius+SHIP_RADIUS);
  for(const body of layout.bodies){const hit=segmentCircleIntersection(position,next.position,body.position,body.radius+SHIP_RADIUS);if(hit!==null&&(dock===null||hit<=dock))return {ending:'collision',path};}
  if(dock!==null){if(sample)path.push({x:position.x+(next.position.x-position.x)*dock,y:position.y+(next.position.y-position.y)*dock});return {ending:'dock',path};}
  position=next.position;velocity=next.velocity;if(sample&&(step+1)%4===0)path.push({...position});
 }return {ending:'unresolved',path};
}
/** Measured against the actual swept capture contact, not the goal center. */
export function captureChordBend(path:readonly Vec2[]):number {
 if(path.length<2)return 0;
 const from=path[0],to=path.at(-1)!,dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);
 return length===0?0:Math.max(...path.map(p=>Math.abs((p.x-from.x)*dy-(p.y-from.y)*dx)/length));
}
/** Shared positive difficulty evidence. Unresolved is never accepted as a collision. */
export function acceptsCoreChallenge(layout:ChallengeLayout,solution:Pick<ValidatedSolution,'angle'|'power'>,budget?:SearchBudget):boolean {
 if(probeFlight(layout,solution.angle,solution.power,false,budget).ending!=='collision')return false;
 const bearing=Math.atan2(layout.checkpoint.position.y-layout.launch.y,layout.checkpoint.position.x-layout.launch.x);
 for(const power of CHALLENGE_POWERS)for(const offset of CHALLENGE_OFFSETS)if(probeFlight(layout,bearing+offset,power,true,budget).ending!=='collision')return false;
 return true;
}
/** Finite empirical screening for intentionally open, force-driven structures. */
export function acceptsSampledCurvature(layout:ChallengeLayout,budget?:SearchBudget):boolean {
 const bearing=Math.atan2(layout.checkpoint.position.y-layout.launch.y,layout.checkpoint.position.x-layout.launch.x);
 const checked=new Map<string,number>();
 const screen=(powerIndex:number,angleIndex:number):number=>{
  const key=`${powerIndex}:${angleIndex}`,old=checked.get(key);if(old!==undefined)return old;
  const shot=probeFlight(layout,bearing+angleIndex*.025,powerIndex*.025,true,budget,true,8);
  const bend=shot.ending==='dock'?captureChordBend(shot.path):Infinity;checked.set(key,bend);return bend;
 };
 for(let p=0;p<=20;p++)for(let a=-15;a<=15;a++){
  const bend=screen(p*2,a*2);
  if(budget&&budget.remaining<=0)return false;
  if(bend<MIN_CAPTURE_CHORD_BEND)return false;
  // Refine captured regions near the target rather than blindly doubling every
  // unresolved trajectory. This closes observed intermediate-power/angle bypasses.
  if(bend<MIN_CAPTURE_CHORD_BEND+40)for(const dp of [-1,0,1])for(const da of [-1,0,1]){
   if((dp===0&&da===0)||p*2+dp<0||p*2+dp>40||a*2+da<-30||a*2+da>30)continue;
   if(screen(p*2+dp,a*2+da)<MIN_CAPTURE_CHORD_BEND||(budget&&budget.remaining<=0))return false;
  }
 }
 return true;
}
export function acceptsChallenge(layout:ChallengeLayout,solution:Pick<ValidatedSolution,'angle'|'power'>,budget?:SearchBudget,validation:ChallengeValidation='geometric'):boolean {
 if(validation==='geometric'&&!blocksStraightCorridor(layout))return false;
 if(!acceptsCoreChallenge(layout,solution,budget))return false;
 if(validation==='geometric')return true;
 for(const [da,dp] of [[0,0],[.025,0],[-.025,0],[0,.025],[0,-.025]]){
  const shot=probeFlight(layout,solution.angle+da,solution.power+dp,true,budget,true);
  if(shot.ending!=='dock'||captureChordBend(shot.path)<MIN_CAPTURE_CHORD_BEND)return false;
 }
 return acceptsSampledCurvature(layout,budget);
}
