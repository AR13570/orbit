import { bodyStrength, distance, FIXED_STEP, launchSpeed, segmentCircleIntersection, SHIP_RADIUS, stepParticle, WORLD_SIZE, WORLD_WIDTH } from './physics';
import type { Body, Checkpoint, Sector, SectorFamily, ValidatedSolution, Vec2, WorldBounds } from './types';
import { describeComposition,freshComposition,preservesFallbackCoverage } from './composition';
import { CERTIFIED_LAYOUTS } from './certified-layouts';
import type { CompositionDescriptor } from './composition';
import { acceptsChallenge,CHALLENGE_OFFSETS,CHALLENGE_POWERS,probeFlight } from './challenge';
import type { SearchBudget } from './challenge';

const LOCAL_LAUNCH:Vec2={x:0,y:0};
const LOCAL_BOUNDS:WorldBounds={x:-100,y:-450,width:WORLD_WIDTH,height:WORLD_SIZE};
const MAX_LAYOUT_ATTEMPTS=12;
const MAX_PLACEMENT_ATTEMPTS=90;
const MAX_ROUTE_STEPS=720;
interface Layout { bodies:Body[]; checkpoint:Checkpoint; hint?:ValidatedSolution }
function randomSource(seed:number):()=>number {
 let value=seed>>>0;
 return ()=>{value+=0x6d2b79f5;let t=value;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
}
function mixSeed(seed:number,index:number,salt:number):number {
 let value=(seed^Math.imul(index+1,0x9e3779b1)^salt)>>>0;
 value=Math.imul(value^value>>>16,0x85ebca6b);value=Math.imul(value^value>>>13,0xc2b2ae35);
 return (value^value>>>16)>>>0;
}
function makeBody(id:number,x:number,y:number,radius:number,kind:Body['kind']):Body {
 return {id:`body-${id}`,position:{x,y},radius,kind,strength:bodyStrength(radius)};
}
function clearPlacement(body:Body,existing:Body[],goal:Checkpoint):boolean {
 return distance(body.position,LOCAL_LAUNCH)>=body.radius+65&&distance(body.position,goal.position)>=body.radius+goal.radius+30&&existing.every(other=>distance(body.position,other.position)>=body.radius+other.radius+65);
}
/** Sample clusters in corridor space, never reserve an empty horizontal strip. */
function sampleLayout(random:()=>number,count:number,safe=false,budget?:SearchBudget):Layout|null {
 const checkpoint={position:{x:660+random()*160,y:(random()-0.5)*240},radius:45};
 const centralKind=random()<0.35?'repellent':'attractor';
 if(centralKind==='repellent')checkpoint.position.y=(random()<0.5?-1:1)*(80+random()*40);
 const center=makeBody(0,centralKind==='repellent'?checkpoint.position.x-160-random()*60:250+random()*230,0,55+random()*(centralKind==='repellent'?10:safe?7:27),centralKind);
 const bodies=[center];
 if(centralKind==='repellent'){
  const helper=makeBody(1,180+random()*240,-Math.sign(checkpoint.position.y)*(170+random()*110),62+random()*20,'attractor');
  if(!clearPlacement(helper,bodies,checkpoint))return null;bodies.push(helper);
 }
 // Find a provisional path around the real central barrier, then keep a readable gap
 // through the sampled clusters. Final validation still includes every added force.
 let guide=findRoute({bodies,checkpoint},random,budget);if(!guide)return null;
 const placeBlocker=(trace:Vec2[],confirm:(layout:Layout)=>boolean):boolean=>{
  const eligible=trace.filter(point=>point.x>150&&point.x<checkpoint.position.x-80&&Math.abs(point.y)<340);
  for(let attempt=0;attempt<28&&eligible.length;attempt++){
   if(budget&&budget.remaining<=0)return false;
   const point=eligible[Math.floor(random()*eligible.length)],radius=28+random()*24;
   const closest=guide!.path.reduce((best,p)=>distance(p,point)<distance(best,point)?p:best,guide!.path[0]);
   const length=distance(point,closest);if(length<15)continue;
   const position={x:point.x+(point.x-closest.x)/length*(radius-6),y:point.y+(point.y-closest.y)/length*(radius-6)};
   const body=makeBody(bodies.length,position.x,position.y,radius,random()<0.5?'attractor':'repellent');
   if(Math.abs(position.y)>350||!clearPlacement(body,bodies,checkpoint)||guide!.path.some(p=>distance(p,position)<radius+12))continue;
   const updated=neighborhood({bodies:[...bodies,body],checkpoint},guide!.angle,guide!.power,budget);
   if(updated&&confirm({bodies:[...bodies,body],checkpoint})){bodies.push(body);guide=updated;return true;}
  }
  return false;
 };
 const counterfactual=probeFlight({launch:LOCAL_LAUNCH,bodies,checkpoint},guide.angle,guide.power,false,budget,true);
 if(counterfactual.ending!=='collision'&&!placeBlocker(counterfactual.path,layout=>probeFlight({launch:LOCAL_LAUNCH,...layout},guide!.angle,guide!.power,false,budget).ending==='collision'))return null;
 const bearing=Math.atan2(checkpoint.position.y,checkpoint.position.x);
 // Target a cheap-shot trajectory, retaining the validated curved neighborhood at every addition.
 for(let blocker=0;blocker<2;blocker++){
  let weak:{angle:number;power:number;path:Vec2[]}|null=null;
  for(const power of CHALLENGE_POWERS){
   for(const offset of CHALLENGE_OFFSETS){const angle=bearing+offset,probe=probeFlight({launch:LOCAL_LAUNCH,bodies,checkpoint},angle,power,true,budget,true);if(probe.ending!=='collision'){weak={angle,power,path:probe.path};break;}}
   if(weak)break;
  }
  if(!weak)break;
  if(bodies.length>=count||!placeBlocker(weak.path,layout=>probeFlight({launch:LOCAL_LAUNCH,...layout},weak!.angle,weak!.power,true,budget).ending==='collision'))return null;
 }
 const clusters=Array.from({length:2},()=>({x:180+random()*560,y:(random()-0.5)*380}));
 const attractorShare=0.25+random()*0.5;
 for(let n=0;n<MAX_PLACEMENT_ATTEMPTS&&bodies.length<count;n++){
  const cluster=clusters[n%clusters.length];
  const spread=random()<0.5;
  const x=spread?130+random()*(checkpoint.position.x-50):Math.max(130,Math.min(checkpoint.position.x+80,cluster.x+(random()-0.5)*360));
  const y=spread?(random()-0.5)*700:Math.max(-350,Math.min(350,cluster.y+(random()-0.5)*400));
  const radius=(safe?30:28)+random()*(safe?16:48);
  const kind=bodies.every(body=>body.kind===center.kind)?(center.kind==='attractor'?'repellent':'attractor'):(random()<attractorShare?'attractor':'repellent');
  const body=makeBody(bodies.length,x,y,radius,kind);
  if(clearPlacement(body,bodies,checkpoint)&&guide.path.every(point=>distance(point,body.position)>=body.radius+40)){
   const updated=neighborhood({bodies:[...bodies,body],checkpoint},guide.angle,guide.power,budget);
   if(updated){bodies.push(body);guide=updated;}
  }
 }
 return bodies.length===count&&bodies.some(body=>body.kind!==center.kind)&&acceptsChallenge({launch:LOCAL_LAUNCH,bodies,checkpoint},guide,budget)?{bodies,checkpoint,hint:guide}:null;
}
function captureRoute(layout:Layout,angle:number,power:number,launch:Vec2=LOCAL_LAUNCH,bounds:WorldBounds=LOCAL_BOUNDS,budget?:SearchBudget):ValidatedSolution|null {
 angle=Math.atan2(Math.sin(angle),Math.cos(angle));
 const speed=launchSpeed(power),{bodies,checkpoint}=layout;
 let position={...launch},velocity={x:Math.cos(angle)*speed,y:Math.sin(angle)*speed};
 const path:Vec2[]=[{...launch}];
 for(let step=0;step<MAX_ROUTE_STEPS;step++){
  if(budget&&budget.remaining--<=0)return null;
  const next=stepParticle(position,velocity,bodies,FIXED_STEP,checkpoint),dock=segmentCircleIntersection(position,next.position,checkpoint.position,checkpoint.radius+SHIP_RADIUS);
  for(const body of bodies){const hit=segmentCircleIntersection(position,next.position,body.position,body.radius+SHIP_RADIUS);if(hit!==null&&(dock===null||hit<=dock))return null;}
  if(dock!==null){
   const contact={x:position.x+(next.position.x-position.x)*dock,y:position.y+(next.position.y-position.y)*dock};
   if(distance(path.at(-1)!,contact)>1e-8)path.push(contact);
   return {angle,power,speed,flightSeconds:(step+1)*FIXED_STEP,path};
  }
  if(next.position.x<bounds.x+SHIP_RADIUS||next.position.x>bounds.x+bounds.width-SHIP_RADIUS||next.position.y<bounds.y+SHIP_RADIUS||next.position.y>bounds.y+bounds.height-SHIP_RADIUS)return null;
  position=next.position;velocity=next.velocity;if((step+1)%4===0)path.push({...position});
 }
 return null;
}
function neighborhood(layout:Layout,angle:number,power:number,budget?:SearchBudget):ValidatedSolution|null {
 const central=captureRoute(layout,angle,power,LOCAL_LAUNCH,LOCAL_BOUNDS,budget);if(!central)return null;
 for(const [da,dp] of [[0.025,0],[-0.025,0],[0,0.025],[0,-0.025]])if(!captureRoute(layout,angle+da,power+dp,LOCAL_LAUNCH,LOCAL_BOUNDS,budget))return null;
 return central;
}
function findRoute(layout:Layout,random:()=>number,budget?:SearchBudget):ValidatedSolution|null {
 if(layout.hint)return layout.hint;
 const sign=random()<0.5?-1:1,powers=[0.6,0.75,0.52];
 const rotation=Math.floor(random()*powers.length);powers.push(...powers.splice(0,rotation));
 // Interleave both sides of the central obstacle; search broad angles before fine gaps.
 for(const offset of [0.45,0.65,0.25,0.8,0.95,1.1,0.35,0.55,0.18,0.73,0.3,0.4,0.5,0.6,0.7,0.215,0.285,0.385,0.485,0.585,0.685])for(const power of powers)for(const side of [sign,-sign]){
  if(budget&&budget.remaining<=0)return null;
  const angle=side*offset,route=neighborhood(layout,angle,power,budget);if(route)return route;
 }
 return null;
}
function familyOf(layout:Layout,route:ValidatedSolution):SectorFamily {
 if(layout.bodies[0].kind==='repellent')return 'repellent-gate';
 const signs=route.path.filter(p=>Math.abs(p.y)>35).map(p=>Math.sign(p.y));
 if(signs.some(sign=>sign!==signs[0]))return 'slalom';
 if(layout.bodies.filter(b=>b.kind==='attractor'&&b.radius>55).length>=3)return 'binary-transfer';
 return route.angle<0?'upper-bend':'lower-bend';
}
function populate(seed:number,index:number,origin:Vec2,layout:Layout,route:ValidatedSolution,fallback:boolean):Sector {
 const launch={...origin},bounds={x:origin.x-100,y:origin.y-450,width:WORLD_WIDTH,height:WORLD_SIZE};
 const translated:Layout={bodies:layout.bodies.map(body=>({...body,position:{x:origin.x+body.position.x,y:origin.y+body.position.y}})),checkpoint:{radius:45,position:{x:origin.x+layout.checkpoint.position.x,y:origin.y+layout.checkpoint.position.y}}};
 // Replay in global coordinates so metadata equals actual engine arithmetic exactly.
 const solution=captureRoute(translated,route.angle,route.power,launch,bounds);
 if(!solution)throw new Error('Validated route lost during translation');
 return {index,seed,width:WORLD_WIDTH,height:WORLD_SIZE,bounds,launch,...translated,solution,generation:{family:familyOf(layout,route),fallback}};
}
function normalized(seed:number,index:number):[number,number] {return [Number.isFinite(seed)?seed>>>0:1,Math.max(0,Math.floor(Number.isFinite(index)?index:0))];}
/** Emergency pool is independently certified and pairwise fresh, never a mirrored single scene. */
export function generateGuaranteedFallbackSector(seed:number,index=0,origin:Vec2={x:120,y:500},recent:readonly CompositionDescriptor[]=[]):Sector {
 [seed,index]=normalized(seed,index);const random=randomSource(mixSeed(seed,index,0x63d83595));
 const order=CERTIFIED_LAYOUTS.map((_,i)=>i);
 for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 for(const entryIndex of order){
  const entry=CERTIFIED_LAYOUTS[entryIndex];
  const layout:Layout={checkpoint:{position:{x:entry.goal[0],y:entry.goal[1]},radius:45},bodies:entry.bodies.map(([x,y,radius,kind],id)=>makeBody(id,x,y,radius,kind))};
  const descriptor=describeComposition({launch:LOCAL_LAUNCH,...layout});
  if(!freshComposition(descriptor,recent)||!preservesFallbackCoverage(descriptor,recent))continue;
  const route=neighborhood(layout,entry.angle,entry.power);
  if(route&&acceptsChallenge({launch:LOCAL_LAUNCH,...layout},route))return populate(seed,index,origin,layout,route,true);
 }
 throw new Error('Certified backup coverage invariant violated');
}
/** Independent seed-varying backup search with smaller surrounding wells, same central barrier. */
export function generateFallbackSector(seed:number,index=0,origin:Vec2={x:120,y:500},recent:readonly CompositionDescriptor[]=[]):Sector {
 [seed,index]=normalized(seed,index);const random=randomSource(mixSeed(seed,index,0x4f1bbcdc));
 const budget={remaining:30000};
 for(let attempt=0;attempt<12;attempt++){
  if(budget.remaining<=0)break;
  const layout=sampleLayout(random,4+Math.floor(random()*3),true,budget);if(!layout)continue;
  const descriptor=describeComposition({launch:LOCAL_LAUNCH,...layout});if(!freshComposition(descriptor,recent)||!preservesFallbackCoverage(descriptor,recent))continue;
  const route=findRoute(layout,random,budget);if(route)return populate(seed,index,origin,layout,route,true);
 }
 return generateGuaranteedFallbackSector(seed,index,origin,recent);
}
export function generateSector(seed:number,index=0,origin:Vec2={x:120,y:500},recent:readonly CompositionDescriptor[]=[]):Sector {
 [seed,index]=normalized(seed,index);const random=randomSource(mixSeed(seed,index,0xa511e9b3));
 const count=4+Math.floor(random()*4);
 const budget={remaining:60000};
 for(let attempt=0;attempt<MAX_LAYOUT_ATTEMPTS;attempt++){
  if(budget.remaining<=0)break;
  const layout=sampleLayout(random,count,false,budget);if(!layout)continue;
  const descriptor=describeComposition({launch:LOCAL_LAUNCH,...layout});if(!freshComposition(descriptor,recent)||!preservesFallbackCoverage(descriptor,recent))continue;
  const route=findRoute(layout,random,budget);if(route)return populate(seed,index,origin,layout,route,false);
 }
 return generateFallbackSector(seed,index,origin,recent);
}
