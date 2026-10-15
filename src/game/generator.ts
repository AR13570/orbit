import { bodyStrength,distance,FIXED_STEP,launchSpeed,segmentCircleIntersection,SHIP_RADIUS,stepParticle,stepZenParticle,zenLaunchSpeed,ZEN_FIXED_STEP,WORLD_SIZE,WORLD_WIDTH } from './physics';
import type { Body,Checkpoint,Sector,SectorFamily,ValidatedSolution,Vec2,WorldBounds } from './types';
import { matchesStructure,STRUCTURES } from './structures';
import type { StructureGrammar } from './structures';
import { CERTIFIED_LAYOUTS } from './certified-layouts';
import { PROGRESSIVE_LAYOUTS } from './progressive-layouts';
import { zenDifficulty,ZEN_DIFFICULTIES } from './difficulty';
import { SAMPLED_ANCHORS } from './sampled-anchors';
import { describeComposition,freshComposition,preservesFallbackCoverage } from './composition';
import type { CompositionDescriptor } from './composition';
import { acceptsChallenge,acceptsCoreChallenge,blocksStraightCorridor,captureChordBend,MIN_CAPTURE_CHORD_BEND } from './challenge';
import type { SearchBudget } from './challenge';
import { analyzeGravityBends } from './gravity-bends';
import { criticalGravityBodies } from './multi-bend-challenge';
const LOCAL_LAUNCH:Vec2={x:0,y:0};
const LOCAL_BOUNDS:WorldBounds={x:-100,y:-450,width:WORLD_WIDTH,height:WORLD_SIZE};
const MAX_ROUTE_STEPS=2640;
interface Layout { bodies:Body[]; checkpoint:Checkpoint; family:SectorFamily; stage?:number; hint?:ValidatedSolution }
function randomSource(seed:number):()=>number {let value=seed>>>0;return ()=>{value+=0x6d2b79f5;let t=value;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
function mixSeed(seed:number,index:number,salt:number):number {let value=(seed^Math.imul(index+1,0x9e3779b1)^salt)>>>0;value=Math.imul(value^value>>>16,0x85ebca6b);value=Math.imul(value^value>>>13,0xc2b2ae35);return (value^value>>>16)>>>0;}
function makeBody(id:number,x:number,y:number,radius:number,kind:Body['kind'],gravityScale=1):Body {return {id:`body-${id}`,position:{x,y},radius,kind,strength:bodyStrength(radius),gravityScale};}
function validationFor(layout:Layout){return STRUCTURES.find(g=>g.id===layout.family)!.validation??'geometric';}
function layoutDifficulty(layout:Layout){return ZEN_DIFFICULTIES[layout.stage??0];}
function layoutBounds(layout:Layout):WorldBounds{const difficulty=layoutDifficulty(layout);return {x:-100,y:-difficulty.height/2,width:difficulty.width,height:difficulty.height};}
function clearLayout(layout:Layout):boolean {
 if(!matchesStructure(layout.family,layout.bodies,LOCAL_LAUNCH,layout.checkpoint))return false;
 const bounds=layoutBounds(layout),difficulty=layoutDifficulty(layout);
 return layout.bodies.every((body,index)=>body.radius<=104*difficulty.bodyScale&&distance(body.position,LOCAL_LAUNCH)>=body.radius+65&&distance(body.position,layout.checkpoint.position)>=body.radius+layout.checkpoint.radius+30&&body.position.x-body.radius>bounds.x&&body.position.x+body.radius<bounds.x+bounds.width&&Math.abs(body.position.y)+body.radius<bounds.height/2-5&&layout.bodies.slice(0,index).every(other=>distance(body.position,other.position)>=body.radius+other.radius+difficulty.minClearance));
}
function sampleStructure(grammar:StructureGrammar,random:()=>number):Layout|null {
 const checkpoint={position:{x:(grammar.id==='three-step-slalom'?780:660)+random()*(grammar.id==='three-step-slalom'?40:160),y:(random()-.5)*2*(grammar.goalOffset??120)},radius:45};
 const mirror=random()<.5?-1:1,span=.85+random()*.25,mass=.9+random()*.15;
 if(grammar.id==='opposing-banks')checkpoint.position.y=-mirror*(80+random()*100);
 if(grammar.id==='triangular-islands')checkpoint.position.y=-mirror*(40+random()*100);
 const groups=Array.from({length:4},()=>({x:(random()-.5)*60,y:(random()-.5)*20,polarity:.25+random()*.5}));
 const bodies=grammar.slots.map(([x,y,radius,role,group],id)=>{
  const drift=groups[group],px=x*checkpoint.position.x/750+drift.x+(random()-.5)*20,py=checkpoint.position.y*px/checkpoint.position.x+mirror*(y*span+drift.y+(random()-.5)*12);
  const kind=role==='pull'?'attractor':role==='push'?'repellent':random()<drift.polarity?'attractor':'repellent';
  return makeBody(id,px,py,Math.min(104,radius*mass*(.92+random()*.16)),kind);
 });
 const layout={bodies,checkpoint,family:grammar.id};return clearLayout(layout)&&bodies.some(b=>b.kind==='repellent')&&blocksStraightCorridor({launch:LOCAL_LAUNCH,...layout})?layout:null;
}
function captureRoute(layout:Layout,angle:number,power:number,launch:Vec2=LOCAL_LAUNCH,bounds:WorldBounds=LOCAL_BOUNDS,budget?:SearchBudget,playback=false):ValidatedSolution|null {
 if(angle<-Math.PI||angle>Math.PI)angle=Math.atan2(Math.sin(angle),Math.cos(angle));
 const speed=(playback?zenLaunchSpeed:launchSpeed)(power),dt=playback?ZEN_FIXED_STEP:FIXED_STEP,advance=playback?stepZenParticle:stepParticle,{bodies,checkpoint}=layout;
 let position={...launch},velocity={x:Math.cos(angle)*speed,y:Math.sin(angle)*speed};
 const path:Vec2[]=[{...launch}];
 for(let step=0;step<MAX_ROUTE_STEPS;step++){
  if(budget&&budget.remaining--<=0)return null;
  const next=advance(position,velocity,bodies,dt,checkpoint),dock=segmentCircleIntersection(position,next.position,checkpoint.position,checkpoint.radius+SHIP_RADIUS);
  for(const body of bodies){const hit=segmentCircleIntersection(position,next.position,body.position,body.radius+SHIP_RADIUS);if(hit!==null&&(dock===null||hit<=dock))return null;}
  if(dock!==null){
   const contact={x:position.x+(next.position.x-position.x)*dock,y:position.y+(next.position.y-position.y)*dock};
   if(distance(path.at(-1)!,contact)>1e-8)path.push(contact);
   return {angle,power,speed,flightSeconds:(step+1)*dt,path};
  }
  if(next.position.x<bounds.x+SHIP_RADIUS||next.position.x>bounds.x+bounds.width-SHIP_RADIUS||next.position.y<bounds.y+SHIP_RADIUS||next.position.y>bounds.y+bounds.height-SHIP_RADIUS)return null;
  position=next.position;velocity=next.velocity;if((step+1)%4===0)path.push({...position});
 }
 return null;
}
function neighborhood(layout:Layout,angle:number,power:number,budget?:SearchBudget):ValidatedSolution|null {
 const bounds=layoutBounds(layout),difficulty=layoutDifficulty(layout);
 const central=captureRoute(layout,angle,power,LOCAL_LAUNCH,bounds,budget);if(!central||captureChordBend(central.path)<difficulty.minBend||(difficulty.stage>0&&analyzeGravityBends({launch:LOCAL_LAUNCH,...layout},central.path).length<difficulty.requiredBends))return null;
 const tolerance=difficulty.aimTolerance;
 for(const [da,dp] of [[tolerance,0],[-tolerance,0],[0,tolerance],[0,-tolerance]]){const route=captureRoute(layout,angle+da,power+dp,LOCAL_LAUNCH,bounds,budget);if(!route||captureChordBend(route.path)<difficulty.minBend||(difficulty.stage>0&&analyzeGravityBends({launch:LOCAL_LAUNCH,...layout},route.path).length<difficulty.requiredBends))return null;}
 return central;
}
function findRoute(layout:Layout,random:()=>number,budget?:SearchBudget):ValidatedSolution|null {
 if(layout.hint)return layout.hint;
 const searchBudget={remaining:Math.min(12000,budget?.remaining??12000)},initialBudget=searchBudget.remaining;
 try {
 const sign=random()<0.5?-1:1,powers=[0.6,0.75,0.52];
 const rotation=Math.floor(random()*powers.length);powers.push(...powers.splice(0,rotation));
 // Interleave both sides of the central obstacle; search broad angles before fine gaps.
 for(const offset of [0.8,0.95,0.65,1.1,0.45,0.25,0.35,0.55,0.18,0.73,0.3,0.4,0.5,0.6,0.7,0.215,0.285,0.385,0.485,0.585,0.685])for(const power of powers)for(const side of [sign,-sign]){
  if(searchBudget.remaining<=0)return null;
  const angle=Math.atan2(layout.checkpoint.position.y,layout.checkpoint.position.x)+side*offset,route=neighborhood(layout,angle,power,searchBudget);if(route&&acceptsChallenge({launch:LOCAL_LAUNCH,...layout},route,searchBudget))return route;
 }
 return null;
 }finally {if(budget)budget.remaining-=initialBudget-searchBudget.remaining;}
}
function populate(seed:number,index:number,origin:Vec2,layout:Layout,route:ValidatedSolution,fallback:boolean):Sector {
 const difficulty=zenDifficulty(index),launch={...origin},bounds={x:origin.x-100,y:origin.y-difficulty.height/2,width:difficulty.width,height:difficulty.height};
 const translated:Layout={family:layout.family,bodies:layout.bodies.map(body=>({...body,position:{x:origin.x+body.position.x,y:origin.y+body.position.y}})),checkpoint:{radius:45,gravityScale:layout.checkpoint.gravityScale??difficulty.bodyScale,position:{x:origin.x+layout.checkpoint.position.x,y:origin.y+layout.checkpoint.position.y}}};
 const solution=captureRoute(translated,route.angle,route.power,launch,bounds,undefined,true);if(!solution)throw new Error('Validated route lost during translation');
 return {index,seed,width:difficulty.width,height:difficulty.height,bounds,launch,bodies:translated.bodies,checkpoint:translated.checkpoint,solution,generation:{family:layout.family,fallback,validation:validationFor(layout),difficulty:difficulty.factor}};
}
function normalized(seed:number,index:number):[number,number] {return [Number.isFinite(seed)?seed>>>0:1,Math.max(0,Math.floor(Number.isFinite(index)?index:0))];}
function familyOrder(seed:number,cycle:number):SectorFamily[] {const random=randomSource(mixSeed(seed,cycle,0x749ef23)),order=STRUCTURES.map(g=>g.id);for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}return order;}
function descriptorOf(layout:Layout):CompositionDescriptor {return describeComposition({launch:LOCAL_LAUNCH,...layout,generation:{family:layout.family,fallback:false}});}
function entryLayout(entry:(typeof CERTIFIED_LAYOUTS)[number],index=0):Layout {
 const difficulty=zenDifficulty(index),gravityScale=difficulty.bodyScale;
 return {stage:difficulty.stage,family:entry.family,checkpoint:{position:{x:entry.goal[0],y:entry.goal[1]},radius:45,gravityScale},bodies:entry.bodies.map(([x,y,radius,kind],id)=>makeBody(id,x,y,radius,kind,gravityScale))};
}
function certificateFor(family:SectorFamily,index=0):(typeof CERTIFIED_LAYOUTS)[number] {const stage=zenDifficulty(index).stage,entry=(stage===0?CERTIFIED_LAYOUTS:PROGRESSIVE_LAYOUTS[stage-1]).find(e=>e.family===family);if(!entry)throw new Error(`No certified structural backup for ${family}`);return entry;}
function certificateAvailable(family:SectorFamily,recent:readonly CompositionDescriptor[],index:number):boolean {const stage=zenDifficulty(index).stage;if(stage>0&&!PROGRESSIVE_LAYOUTS[stage-1].some(entry=>entry.family===family))return false;const descriptor=descriptorOf(entryLayout(certificateFor(family,index),index));return freshComposition(descriptor,recent)&&preservesFallbackCoverage(descriptor,recent,stage);}
function selectFamily(seed:number,index:number,recent:readonly CompositionDescriptor[]):SectorFamily {
 const order=familyOrder(seed,Math.floor(index/STRUCTURES.length)),start=index%STRUCTURES.length;
 for(let offset=0;offset<order.length;offset++){const family=order[(start+offset)%order.length];if(certificateAvailable(family,recent,index))return family;}
 throw new Error('Certified structural coverage exhausted');
}
/** Change group spacing, aperture relation, mass and optional well polarity within a grammar. */
function sampleCertifiedVariant(entry:(typeof CERTIFIED_LAYOUTS)[number],random:()=>number):Layout|null {
 const difficulty=ZEN_DIFFICULTIES[0],minGoal=660,maxGoal=820;
 if(entry.validation==='sampled'){
  const mirror=random()<.5?-1:1,scale=.94+random()*.08,span=.94+random()*.1;
  const checkpoint={position:{x:Math.min(maxGoal,Math.max(minGoal,entry.goal[0]*scale)),y:mirror*(entry.goal[1]+(random()-.5)*30)},radius:45,gravityScale:difficulty.bodyScale},grammar=STRUCTURES.find(g=>g.id===entry.family)!;
  const groups=Array.from({length:4},()=>({x:(random()-.5)*24,y:(random()-.5)*16}));
  const bodies=entry.bodies.map(([x,y,radius,kind],id)=>{const drift=groups[grammar.slots[id]?.[4]??id%4];return makeBody(id,x*checkpoint.position.x/entry.goal[0]+drift.x+(random()-.5)*8,mirror*(y*span+drift.y+(random()-.5)*6),radius*(.95+random()*.1),kind,difficulty.bodyScale);});
  const layout={family:entry.family,bodies,checkpoint};return clearLayout(layout)?layout:null;
 }
 const grammar=STRUCTURES.find(g=>g.id===entry.family)!,goalOffset=(grammar.goalOffset??120)*difficulty.bodyScale,checkpoint={position:{x:Math.max(minGoal,Math.min(maxGoal,entry.goal[0]+(random()-.5)*90)),y:Math.max(-goalOffset,Math.min(goalOffset,entry.goal[1]+(random()-.5)*60))},radius:45,gravityScale:difficulty.bodyScale};
 const span=.9+random()*.2,groups=Array.from({length:4},()=>({x:(random()-.5)*36,y:(random()-.5)*16}));
 const bodies=entry.bodies.map(([x,y,radius,kind],id)=>{
  const [,,,role,group]=grammar.slots[id]??[0,0,radius,'mixed',id%4],drift=groups[group],px=x*checkpoint.position.x/entry.goal[0]+drift.x+(random()-.5)*12;
  const py=checkpoint.position.y*px/checkpoint.position.x+(y-entry.goal[1]*x/entry.goal[0])*span+drift.y+(random()-.5)*8;
  const polarity=role==='mixed'&&random()<.18?(kind==='attractor'?'repellent':'attractor'):kind;
  return makeBody(id,px,py,Math.min(104*difficulty.bodyScale,radius*(.94+random()*.12)),polarity,difficulty.bodyScale);
 });
 const layout={family:entry.family,bodies,checkpoint};return clearLayout(layout)&&bodies.some(b=>b.kind==='repellent')&&blocksStraightCorridor({launch:LOCAL_LAUNCH,...layout})?layout:null;
}
function variantRoute(layout:Layout,entry:(typeof CERTIFIED_LAYOUTS)[number],budget:SearchBudget):ValidatedSolution|null {
 const mirror=entry.validation==='sampled'&&layout.checkpoint.position.y*entry.goal[1]<0?-1:1;
 const angle=mirror*entry.angle+Math.atan2(layout.checkpoint.position.y,layout.checkpoint.position.x)-mirror*Math.atan2(entry.goal[1],entry.goal[0]);
 const route=neighborhood(layout,angle,entry.power,budget);return route&&acceptsChallenge({launch:LOCAL_LAUNCH,...layout},route,budget,validationFor(layout),layoutDifficulty(layout).aimTolerance)?route:null;
}
function fallbackFamily(seed:number,index:number,family:SectorFamily,origin:Vec2,recent:readonly CompositionDescriptor[],budget:SearchBudget):Sector {
 const entry=certificateFor(family,index),random=randomSource(mixSeed(seed,index,0x4f1bbcdc)^STRUCTURES.findIndex(g=>g.id===family));
 if(zenDifficulty(index).stage>0){
  // Advanced fields are screened offline. Only rigid reflection and translation
  // are allowed at runtime so random jitter cannot reopen a single-bend bypass.
  let layout=entryLayout(entry,index),angle=entry.angle;
  if(random()<.5){
   const reflected={...layout,checkpoint:{...layout.checkpoint,position:{x:entry.goal[0],y:-entry.goal[1]}},bodies:layout.bodies.map(body=>({...body,position:{x:body.position.x,y:-body.position.y}}))};
   const descriptor=descriptorOf(reflected);
   if(freshComposition(descriptor,recent)&&preservesFallbackCoverage(descriptor,recent,layout.stage)){layout=reflected;angle=-angle;}
  }
  const route=neighborhood(layout,angle,entry.power),challenge={launch:LOCAL_LAUNCH,...layout};
  if(!clearLayout(layout)||!route||!acceptsCoreChallenge(challenge,route)||criticalGravityBodies(challenge,route).length<2)throw new Error('Invalid multi-bend certificate');
  return populate(seed,index,origin,layout,route,true);
 }
 for(let attempt=0;attempt<(entry.validation==='sampled'?4:20)&&budget.remaining>0;attempt++){
  const layout=sampleCertifiedVariant(entry,random);if(!layout)continue;const descriptor=descriptorOf(layout);if(!freshComposition(descriptor,recent)||!preservesFallbackCoverage(descriptor,recent,zenDifficulty(index).stage))continue;
  const route=variantRoute(layout,entry,budget);if(route)return populate(seed,index,origin,layout,route,true);
 }
 let layout=entryLayout(entry,index),angle=entry.angle;

 const descriptor=descriptorOf(layout);if(!freshComposition(descriptor,recent)||!preservesFallbackCoverage(descriptor,recent,zenDifficulty(index).stage))throw new Error(`Unavailable structural backup for ${family}`);
 const route=neighborhood(layout,angle,entry.power);
 // Exact sampled anchors were exhaustively screened over the documented finite grid
 // offline. Recheck geometry, five on-screen routes and positive collision evidence.
 if(!clearLayout(layout)||!route||captureChordBend(route.path)<MIN_CAPTURE_CHORD_BEND||!acceptsCoreChallenge({launch:LOCAL_LAUNCH,...layout},route)||(entry.validation!=='sampled'&&!blocksStraightCorridor({launch:LOCAL_LAUNCH,...layout})))throw new Error('Invalid structural certificate');
 return populate(seed,index,origin,layout,route,true);
}
/** Explicit family entry point supports authoring and family-conditioned verification. */
export function generateFamilySector(seed:number,index:number,family:SectorFamily,origin:Vec2={x:120,y:500},recent:readonly CompositionDescriptor[]=[]):Sector {
 [seed,index]=normalized(seed,index);const grammar=STRUCTURES.find(g=>g.id===family);if(!grammar)throw new Error('Unknown structural family');
 if(!certificateAvailable(family,recent,index))throw new Error(`Unavailable structural family ${family}`);
 const difficulty=zenDifficulty(index);
 if(difficulty.stage>0)return fallbackFamily(seed,index,family,origin,recent,{remaining:18000});
 const random=randomSource(mixSeed(seed,index,0xa511e9b3)^STRUCTURES.indexOf(grammar)),budget={remaining:grammar.validation==='sampled'?900000:60000};
 if(grammar.validation==='sampled'){
  const anchors=SAMPLED_ANCHORS.filter(e=>e.family===family),start=Math.floor(random()*anchors.length);
  for(let attempt=0;attempt<6&&budget.remaining>0;attempt++){
   const entry=anchors[(start+attempt)%anchors.length],layout=sampleCertifiedVariant(entry,random);if(!layout)continue;
   const descriptor=descriptorOf(layout);if(!freshComposition(descriptor,recent)||!preservesFallbackCoverage(descriptor,recent,zenDifficulty(index).stage))continue;
   const route=variantRoute(layout,entry,budget);if(route)return populate(seed,index,origin,layout,route,false);
  }
  return fallbackFamily(seed,index,family,origin,recent,{remaining:500000});
 }
 for(let attempt=0;attempt<36&&budget.remaining>0;attempt++){
  const layout=sampleStructure(grammar,random);if(!layout)continue;
  const descriptor=descriptorOf(layout);if(!freshComposition(descriptor,recent)||!preservesFallbackCoverage(descriptor,recent,zenDifficulty(index).stage))continue;
  const route=findRoute(layout,random,budget);if(route)return populate(seed,index,origin,layout,route,false);
 }
 return fallbackFamily(seed,index,family,origin,recent,{remaining:30000});
}
export function generateSector(seed:number,index=0,origin:Vec2={x:120,y:500},recent:readonly CompositionDescriptor[]=[]):Sector {
 [seed,index]=normalized(seed,index);return generateFamilySector(seed,index,selectFamily(seed,index,recent),origin,recent);
}
export function generateFallbackSector(seed:number,index=0,origin:Vec2={x:120,y:500},recent:readonly CompositionDescriptor[]=[]):Sector {
 [seed,index]=normalized(seed,index);const family=selectFamily(seed,index,recent);return fallbackFamily(seed,index,family,origin,recent,{remaining:STRUCTURES.find(g=>g.id===family)?.validation==='sampled'?500000:30000});
}
export function generateGuaranteedFallbackSector(seed:number,index=0,origin:Vec2={x:120,y:500},recent:readonly CompositionDescriptor[]=[]):Sector {
 [seed,index]=normalized(seed,index);const family=selectFamily(seed,index,recent);
 // Opening backups keep their proposal budget. Advanced backups use their
 // exact offline certificate and bounded 22-second route replays.
 return fallbackFamily(seed,index,family,origin,recent,{remaining:STRUCTURES.find(g=>g.id===family)?.validation==='sampled'?300000:Math.ceil(8000*zenDifficulty(index).bodyScale)});
}
