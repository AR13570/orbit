import {checkpointForceAt,forceAt} from './physics';
import type {ChallengeLayout} from './challenge';
import type {Vec2} from './types';

export const MIN_GRAVITY_TURN=.16;
export interface GravityBend {
 bodyId:string;
 turnRadians:number;
 distance:number;
 start:Vec2;
 end:Vec2;
}

/** Count substantial alternating turns driven by distinct bodies, excluding
 * goal attraction and tiny oscillations in sampled trajectories. */
export function analyzeGravityBends(layout:ChallengeLayout,path:readonly Vec2[]):GravityBend[] {
 type Group={sign:number;turn:number;distance:number;weights:Map<string,number>;start:Vec2;end:Vec2};
 const groups:Group[]=[];
 let current:Group|undefined;
 for(let index=1;index<path.length-1;index++){
  const point=path[index],previous=path[index-1],next=path[index+1];
  const ax=point.x-previous.x,ay=point.y-previous.y,bx=next.x-point.x,by=next.y-point.y,length=Math.hypot(ax,ay);
  const turn=Math.atan2(ax*by-ay*bx,ax*bx+ay*by);
  if(length<1e-6||Math.abs(turn)<1e-6)continue;
  const sign=Math.sign(turn);
  // A goal-driven reversal separates two turns even though it cannot itself
  // qualify as a body-driven bend.
  if(!current||current.sign!==sign){current={sign,turn:0,distance:0,weights:new Map(),start:point,end:point};groups.push(current);}
  const goal=checkpointForceAt(point,layout.checkpoint),goalPerpendicular=Math.abs((ax*goal.y-ay*goal.x)/length);
  let dominant:string|undefined,largest=0;
  for(const body of layout.bodies){
   const force=forceAt(point,[body]),perpendicular=(ax*force.y-ay*force.x)/length;
   if(Math.sign(perpendicular)===sign&&Math.abs(perpendicular)>largest){largest=Math.abs(perpendicular);dominant=body.id;}
  }
  if(dominant===undefined||largest<=goalPerpendicular)continue;
  current.turn+=turn;current.distance+=length;current.end=point;
  current.weights.set(dominant,(current.weights.get(dominant)??0)+Math.abs(turn));
 }
 const scale=layout.checkpoint.gravityScale??1,bends:GravityBend[]=[];
 for(const group of groups){
  if(Math.abs(group.turn)<MIN_GRAVITY_TURN||group.distance<40*scale)continue;
  const bodyId=[...group.weights].sort((a,b)=>b[1]-a[1])[0]?.[0];
  if(bodyId===undefined)continue;
  const bend={bodyId,turnRadians:group.turn,distance:group.distance,start:{...group.start},end:{...group.end}},last=bends.at(-1);
  if(last&&Math.sign(last.turnRadians)===group.sign){
   if(Math.abs(bend.turnRadians)>Math.abs(last.turnRadians)&&!bends.slice(0,-1).some(previous=>previous.bodyId===bodyId))bends[bends.length-1]=bend;
  }else if(!bends.some(previous=>previous.bodyId===bodyId))bends.push(bend);
 }
 return bends;
}
