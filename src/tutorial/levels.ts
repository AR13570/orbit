import type { Aim,Body,Checkpoint,Vec2,WorldBounds } from '../game/types';
import { bodyStrength,segmentCircleIntersection,SHIP_RADIUS,stepOdesseyParticle,odesseyLaunchSpeed,ODESSEY_FIXED_STEP } from '../game/physics';

export interface OdesseyTutorialLevel {
 readonly id:'curve'|'split';
 readonly launch:Vec2;
 readonly goal:Checkpoint;
 readonly bodies:Body[];
 readonly bounds:WorldBounds;
 readonly suggestedAim:Aim;
 readonly aim:Aim;
 /** Odessey simulation seconds, before any teaching-time slowdown. */
 readonly splitAt:number|null;
 readonly splitWindow?:readonly [number,number];
 readonly solutionPaths:Vec2[][];
 readonly tapPoint:Vec2|null;
}
export interface OdesseyTutorialWitness {
 ending:'dock'|'collision'|'unresolved';
 capturedBy:number|null;
 time:number;
 splitPoint:Vec2|null;
 paths:{id:number;points:Vec2[]}[];
}
type Layout=Omit<OdesseyTutorialLevel,'solutionPaths'|'tapPoint'>;
/** Bounded witness replay only. Interactive practice owns its own mutable state. */
export function traceOdesseyTutorial(level:Layout,options:{aim?:Aim;splitAt?:number|null}={}):OdesseyTutorialWitness {
 const aim=options.aim??level.suggestedAim,splitAt=options.splitAt===undefined?level.splitAt:options.splitAt,speed=odesseyLaunchSpeed(aim.power);
 const particles=[{id:0,position:{...level.launch},velocity:{x:Math.cos(aim.angle)*speed,y:Math.sin(aim.angle)*speed},alive:true,points:[{...level.launch}]}];
 let branched=false,splitPoint:Vec2|null=null;
 const result=(ending:OdesseyTutorialWitness['ending'],time:number,capturedBy:number|null=null):OdesseyTutorialWitness=>({ending,time,capturedBy,splitPoint,paths:particles.map(p=>({id:p.id,points:p.points}))});
 for(let tick=0;tick<864;tick++){
  if(splitAt!==null&&!branched&&tick*ODESSEY_FIXED_STEP+1e-12>=splitAt&&particles[0].alive){
   const center=particles[0];splitPoint={...center.position};
   for(const [id,angle] of [[1,-Math.PI/60],[2,Math.PI/60]]){
    const cosine=Math.cos(angle),sine=Math.sin(angle);
    particles.push({id,position:{...center.position},velocity:{x:center.velocity.x*cosine-center.velocity.y*sine,y:center.velocity.x*sine+center.velocity.y*cosine},alive:true,points:[{...center.position}]});
   }
   branched=true;
  }
  const movements=particles.map(p=>{
   if(!p.alive)return null;
   const next=stepOdesseyParticle(p.position,p.velocity,level.bodies,ODESSEY_FIXED_STEP,level.goal),dock=segmentCircleIntersection(p.position,next.position,level.goal.position,level.goal.radius+SHIP_RADIUS);
   let contact=dock??1,ending:'dock'|'collision'|null=dock===null?null:'dock';
   for(const body of level.bodies){const hit=segmentCircleIntersection(p.position,next.position,body.position,body.radius+SHIP_RADIUS);if(hit!==null&&hit<=contact){contact=hit;ending='collision';}}
   return {next,contact,ending};
  });
  const firstDock=Math.min(...movements.map(m=>m?.ending==='dock'?m.contact:Infinity));
  particles.forEach((p,i)=>{
   const movement=movements[i];if(!movement)return;
   const contact=Math.min(movement.contact,firstDock);
   p.position={x:p.position.x+(movement.next.position.x-p.position.x)*contact,y:p.position.y+(movement.next.position.y-p.position.y)*contact};p.velocity=movement.next.velocity;p.points.push({...p.position});
   if(movement.ending!==null||Number.isFinite(firstDock))p.alive=false;
  });
  if(Number.isFinite(firstDock))return result('dock',(tick+firstDock)*ODESSEY_FIXED_STEP,movements.findIndex(m=>m?.ending==='dock'&&m.contact===firstDock));
  if(particles.every(p=>!p.alive))return result('collision',(tick+Math.max(...movements.map(m=>m?.contact??0)))*ODESSEY_FIXED_STEP);
 }
 return result('unresolved',864*ODESSEY_FIXED_STEP);
}
function authored(data:Layout):OdesseyTutorialLevel {
 const level=structuredClone(data),witness=traceOdesseyTutorial(level);return {...level,solutionPaths:witness.paths.map(p=>p.points),tapPoint:witness.splitPoint};
}
const body=(id:string,x:number,y:number,radius:number,kind:Body['kind']):Body=>({id,position:{x,y},radius,kind,strength:bodyStrength(radius)});
const bounds={x:90,y:80,width:650,height:430},launch={x:140,y:350};
const curveAim={angle:.7,power:.35},splitAim={angle:.56,power:.55};
export const practiceLevels:readonly [OdesseyTutorialLevel,OdesseyTutorialLevel]=[
 authored({id:'curve',launch,goal:{position:{x:650,y:330},radius:68},bodies:[body('pull',350,190,48,'attractor'),body('push',400,450,28,'repellent')],bounds,aim:curveAim,suggestedAim:curveAim,splitAt:null}),
 // The first solid blocks a direct launch. The second intercepts the guided
 // center route; branching before it lets the lower ship skirt its edge.
 authored({id:'split',launch,goal:{position:{x:850,y:350},radius:45},bodies:[body('approach',320,310,45,'attractor'),body('fork',520,390,45,'attractor')],bounds:{x:90,y:80,width:850,height:520},aim:splitAim,suggestedAim:splitAim,splitAt:.25,splitWindow:[.1,.35]}),
];
export const ODESSEY_TUTORIAL_LEVELS=practiceLevels;
