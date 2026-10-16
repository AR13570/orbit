import { generateSector } from './generator';
import { validOdesseyCheckpoint, type OdesseyCheckpoint } from './progress';
import { describeComposition,RECENT_LAYOUT_LIMIT } from './composition';
import type { CompositionDescriptor } from './composition';
import { distance,ODESSEY_FIXED_STEP as FIXED_STEP,odesseyLaunchSpeed as launchSpeed,MAX_FLIGHT_SECONDS,OFFSCREEN_TIMEOUT_SECONDS,segmentCircleIntersection,SHIP_RADIUS,stepOdesseyParticle as stepParticle } from './physics';
import type { DeepReadonly,EngineEventKind,GameSnapshot,Particle,Sector,ShotCount,StaticSector,Vec2,WorldBounds } from './types';

type EngineState=Omit<GameSnapshot,'sector'|'canBranch'>&{sector:Sector};
interface Boundary { bounds:WorldBounds; outsideElapsed:number }
interface Movement { from:Vec2; to:Vec2; velocity:Vec2; time:number; ending:'dock'|'dead'|null }
const clamp01=(n:number)=>Math.max(0,Math.min(1,n));
function freezeGeometry<T>(value:T):DeepReadonly<T> {
 if(value!==null&&typeof value==='object'){for(const child of Object.values(value))freezeGeometry(child);Object.freeze(value);}return value as DeepReadonly<T>;
}
function inside(position:Vec2,bounds:WorldBounds):boolean {
 const dx=Math.max(bounds.x-position.x,0,position.x-bounds.x-bounds.width),dy=Math.max(bounds.y-position.y,0,position.y-bounds.y-bounds.height);
 return dx*dx+dy*dy<=SHIP_RADIUS*SHIP_RADIUS;
}
/** Segment interval inside the rectangle expanded by the physical circular ship. */
function visibleInterval(from:Vec2,to:Vec2,bounds:WorldBounds):[number,number]|null {
 if(inside(from,bounds)&&inside(to,bounds))return [0,1];
 if(Math.max(from.x,to.x)<bounds.x-SHIP_RADIUS||Math.min(from.x,to.x)>bounds.x+bounds.width+SHIP_RADIUS||Math.max(from.y,to.y)<bounds.y-SHIP_RADIUS||Math.min(from.y,to.y)>bounds.y+bounds.height+SHIP_RADIUS)return null;
 const intervals:[number,number][]=[],dx=to.x-from.x,dy=to.y-from.y;
 function rectangle(x:number,y:number,width:number,height:number):void {
  let enter=0,exit=1;
  for(const [start,delta,lower,upper] of [[from.x,dx,x,x+width],[from.y,dy,y,y+height]]){
   if(delta===0){if(start<lower||start>upper)return;continue;}
   const a=(lower-start)/delta,b=(upper-start)/delta;enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));if(enter>exit)return;
  }
  intervals.push([enter,exit]);
 }
 rectangle(bounds.x-SHIP_RADIUS,bounds.y,bounds.width+2*SHIP_RADIUS,bounds.height);
 rectangle(bounds.x,bounds.y-SHIP_RADIUS,bounds.width,bounds.height+2*SHIP_RADIUS);
 const square=dx*dx+dy*dy;
 if(square>0)for(const x of [bounds.x,bounds.x+bounds.width])for(const y of [bounds.y,bounds.y+bounds.height]){
  const ox=from.x-x,oy=from.y-y,b=2*(ox*dx+oy*dy),c=ox*ox+oy*oy-SHIP_RADIUS*SHIP_RADIUS,discriminant=b*b-4*square*c;
  if(discriminant<0)continue;
  const root=Math.sqrt(discriminant),enter=Math.max(0,(-b-root)/(2*square)),exit=Math.min(1,(-b+root)/(2*square));if(enter<=exit)intervals.push([enter,exit]);
 }
 if(!intervals.length)return null;
 return [Math.min(...intervals.map(interval=>interval[0])),Math.max(...intervals.map(interval=>interval[1]))];
}
/** Pure continuous outside accounting, including a complete re-entry between endpoints. */
function outsideProgress(from:Vec2,to:Vec2,boundary:Boundary,duration:number):{elapsed:number;timeout:number|null} {
 const previous=inside(from,boundary.bounds)?0:boundary.outsideElapsed;
 if(duration===0)return {elapsed:previous,timeout:null};
 const interval=visibleInterval(from,to,boundary.bounds);
 if(!interval){const elapsed=previous+duration;return {elapsed:Math.min(OFFSCREEN_TIMEOUT_SECONDS,elapsed),timeout:elapsed+1e-12>=OFFSCREEN_TIMEOUT_SECONDS?clamp01((OFFSCREEN_TIMEOUT_SECONDS-previous)/duration):null};}
 const [enter,exit]=interval;
 if(enter>0&&previous+enter*duration+1e-12>=OFFSCREEN_TIMEOUT_SECONDS)return {elapsed:OFFSCREEN_TIMEOUT_SECONDS,timeout:clamp01((OFFSCREEN_TIMEOUT_SECONDS-previous)/duration)};
 const elapsed=(1-exit)*duration;
 return {elapsed,timeout:elapsed+1e-12>=OFFSCREEN_TIMEOUT_SECONDS?exit+OFFSCREEN_TIMEOUT_SECONDS/duration:null};
}
function publishOutside(particle:Particle,boundary:Boundary):void {
 if(inside(particle.position,boundary.bounds)){boundary.outsideElapsed=0;delete particle.offscreenRemaining;}
 else particle.offscreenRemaining=Math.max(0,OFFSCREEN_TIMEOUT_SECONDS-boundary.outsideElapsed);
}
/** One shared movement/collision/boundary path for actual flight and prediction. */
function planMovement(particle:Particle,sector:Sector,boundary:Boundary):Movement {
 const from=particle.position,next=stepParticle(from,particle.velocity,sector.bodies,FIXED_STEP,sector.checkpoint);
 let time=1,ending:'dock'|'dead'|null=null;
 const dock=segmentCircleIntersection(from,next.position,sector.checkpoint.position,sector.checkpoint.radius+SHIP_RADIUS);
 if(dock!==null){time=dock;ending='dock';}
 for(const body of sector.bodies){const hit=segmentCircleIntersection(from,next.position,body.position,body.radius+SHIP_RADIUS);if(hit!==null&&hit<=time){time=hit;ending='dead';}}
 const outside=outsideProgress(from,next.position,boundary,FIXED_STEP);
 if(outside.timeout!==null&&outside.timeout<=time){time=outside.timeout;ending='dead';}
 return {from,to:next.position,velocity:next.velocity,time,ending};
}
/** Resolve all trajectories before applying the earliest docking in this fixed step. */
function stepVolley(particles:Particle[],sector:Sector,boundaries:Map<number,Boundary>,sample:boolean,elapsed=0):'dock'|'dead'|null {
 const movements=particles.map(particle=>particle.alive?planMovement(particle,sector,boundaries.get(particle.id)!):null);
 const dockTime=Math.min(...movements.map(movement=>movement?.ending==='dock'?movement.time:Infinity));
 particles.forEach((particle,index)=>{
  const movement=movements[index];if(!movement)return;
  const time=Math.min(movement.time,dockTime),from=movement.from,to=movement.to;
  particle.position={x:from.x+(to.x-from.x)*time,y:from.y+(to.y-from.y)*time};particle.velocity=movement.velocity;
  const boundary=boundaries.get(particle.id)!;boundary.outsideElapsed=outsideProgress(from,particle.position,boundary,FIXED_STEP*time).elapsed;publishOutside(particle,boundary);
  if(Number.isFinite(dockTime)||movement.ending!==null)particle.alive=false;
  if(sample||!particle.alive){if(!particle.trail.length||distance(particle.trail.at(-1)!,particle.position)>1e-8)particle.trail.push({...particle.position,time:elapsed});if(particle.trail.length>180)particle.trail.shift();}
 });
 return Number.isFinite(dockTime)?'dock':particles.every(particle=>!particle.alive)?'dead':null;
}

export class OrbitEngine {
 private state!:EngineState;
 private cachedSectorSource:Sector|null=null;
 private cachedStaticSector:StaticSector|null=null;
 private injectedBounds:WorldBounds|null=null;
 private boundaries=new Map<number,Boundary>();
 private runSeed=1;
 private accumulator=0;
 private steps=0;
 private eventId=0;
 private trailElapsed=0;
 private branched=false;
 private recentLayouts:CompositionDescriptor[]=[];
 constructor(seed?:number,startLevel=1){this.restart(seed,startLevel);}
 getSnapshot():GameSnapshot {
  if(this.cachedSectorSource!==this.state.sector||!this.cachedStaticSector){this.cachedStaticSector=freezeGeometry(structuredClone(this.state.sector));this.cachedSectorSource=this.state.sector;}
  return {...this.state,trailElapsed:this.trailElapsed,canBranch:this.branchIsAvailable(),sector:this.cachedStaticSector,aim:{...this.state.aim},particles:this.state.particles.map(p=>({...p,position:{...p.position},velocity:{...p.velocity},trail:p.trail.map(point=>({...point}))})),event:this.state.event?{...this.state.event}:null};
 }
 /** Capture static checkpoint state without retaining live projectiles or camera bounds. */
 getCheckpoint():OdesseyCheckpoint {
  return structuredClone({version:1,seed:this.runSeed,checkpointCount:this.state.checkpointCount,pendingAdvance:this.state.status==='docked',sector:this.state.sector,recentLayouts:this.recentLayouts});
 }
 restoreCheckpoint(checkpoint:OdesseyCheckpoint):void {
  if(!validOdesseyCheckpoint(checkpoint,this.runSeed))return;
  const saved=structuredClone(checkpoint);
  this.recentLayouts=saved.recentLayouts;
  this.state={status:saved.pendingAdvance?'docked':'aiming',sector:saved.sector,aim:{angle:0,power:0.5},shotCount:this.state.shotCount,particles:[],checkpointCount:saved.checkpointCount,message:'Pull back and release.',elapsed:0,event:null};
  this.accumulator=0;this.steps=0;this.trailElapsed=0;this.branched=false;this.boundaries.clear();this.injectedBounds=null;
  if(saved.pendingAdvance)this.advance();else this.setDefaultAim();
  this.emit('restart');
 }
 setFlightBounds(bounds:WorldBounds|null):void {
  if(bounds!==null&&(!Object.values(bounds).every(Number.isFinite)||bounds.width<=SHIP_RADIUS*2||bounds.height<=SHIP_RADIUS*2))return;
  this.injectedBounds=bounds?{...bounds}:null;
  if(this.state.status==='flying')for(const particle of this.state.particles)if(particle.alive){const boundary=this.boundaries.get(particle.id)!;boundary.bounds={...(this.injectedBounds??this.state.sector.bounds)};publishOutside(particle,boundary);}
 }
 setShotCount(count:ShotCount):void {
  if(this.state.status==='aiming'&&(count===1||count===3))this.state.shotCount=count;
 }
 toggleShotCount():void {this.setShotCount(this.state.shotCount===1?3:1);}
 setAim(angle:number,power:number):void {
  if(this.state.status!=='aiming'||!Number.isFinite(angle)||!Number.isFinite(power))return;
  this.state.aim={angle:angle>=-Math.PI&&angle<=Math.PI?angle:Math.atan2(Math.sin(angle),Math.cos(angle)),power:clamp01(power)};
 }
 launch():void {
  if(this.state.status!=='aiming')return;
  this.branched=false;
  this.state.particles=this.makeParticles();this.state.elapsed=0;this.trailElapsed=0;this.accumulator=0;this.steps=0;
  this.boundaries=new Map(this.state.particles.map(particle=>[particle.id,this.makeBoundary()]));this.state.status='flying';this.state.message='In flight.';this.emit('launch');
 }
 branch():void {
  if(!this.branchIsAvailable())return;
  const center=this.state.particles[0],boundary=this.boundaries.get(center.id)!;
  const sides=[-Math.PI/60,Math.PI/60].map((offset,index):Particle=>{
   const position={...center.position},cosine=Math.cos(offset),sine=Math.sin(offset);
   return {id:index+1,position,velocity:{x:center.velocity.x*cosine-center.velocity.y*sine,y:center.velocity.x*sine+center.velocity.y*cosine},alive:true,trail:[{...position,time:this.state.elapsed}]};
  });
  this.state.particles.push(...sides);
  for(const side of sides){const copy={...boundary,bounds:{...boundary.bounds}};this.boundaries.set(side.id,copy);publishOutside(side,copy);}
  this.branched=true;
 }
 update(deltaSeconds:number):void {
  if(!Number.isFinite(deltaSeconds)||deltaSeconds<=0)return;
  if(this.state.status!=='flying'){if(this.state.particles.some(particle=>particle.trail.length)){this.trailElapsed+=Math.min(deltaSeconds,0.25);this.expireTrails();}return;}
  this.accumulator+=Math.min(deltaSeconds,0.25);
  while(this.accumulator+1e-12>=FIXED_STEP&&this.state.status==='flying'){
   this.accumulator=Math.max(0,this.accumulator-FIXED_STEP);this.steps++;this.state.elapsed=this.steps*FIXED_STEP;
   const result=stepVolley(this.state.particles,this.state.sector,this.boundaries,this.steps%4===0,this.state.elapsed);
   this.trailElapsed=this.state.elapsed;this.expireTrails();
   if(result==='dock')this.dock();else if(result==='dead')this.fail('Trajectory lost.');
  }
 }
 retry():void {
  if(this.state.status==='flying')this.fail('Flight reset.');
  if(this.state.status!=='failed')return;
  this.state.status='aiming';this.state.particles=[];this.state.elapsed=0;this.accumulator=0;this.branched=false;this.boundaries.clear();this.state.message='Try a fresh approach.';
 }
 advance():void {
  if(this.state.status!=='docked')return;
  this.state.sector=generateSector(this.runSeed,this.state.sector.index+1,this.state.sector.checkpoint.position,this.recentLayouts);this.rememberLayout();this.state.status='aiming';this.state.particles=[];this.state.elapsed=0;this.accumulator=0;this.branched=false;this.boundaries.clear();this.setDefaultAim();this.state.message='Checkpoint secured.';
 }
 restart(seed?:number,startLevel=1):void {
  const shotCount=this.state?.shotCount??1;
  const index=Number.isSafeInteger(startLevel)&&startLevel>0?startLevel-1:0;
  this.runSeed=Number.isFinite(seed)?seed!>>>0:(Date.now()^Math.floor(Math.random()*0xffffffff))>>>0;this.accumulator=0;this.steps=0;this.trailElapsed=0;this.branched=false;
  this.recentLayouts=[];
  // Replay ordinary difficulty levels exactly. Large debug jumps use bounded local
  // history, so their fields can differ from a full run with the same seed.
  const firstIndex=index<20?0:Math.max(0,index-RECENT_LAYOUT_LIMIT);
  let sector=generateSector(this.runSeed,firstIndex);
  for(let next=firstIndex+1;next<=index;next++){
   this.recentLayouts.push(describeComposition(sector));
   if(this.recentLayouts.length>RECENT_LAYOUT_LIMIT)this.recentLayouts.shift();
   sector=generateSector(this.runSeed,next,sector.checkpoint.position,this.recentLayouts);
  }
  this.state={status:'aiming',sector,aim:{angle:0,power:0.5},shotCount,particles:[],checkpointCount:index,message:'Pull back and release.',elapsed:0,event:null};
  this.rememberLayout();
  this.setDefaultAim();this.boundaries.clear();this.emit('restart');
 }
 predict(seconds=3):Vec2[][] {
  if(this.state.status!=='aiming'||!Number.isFinite(seconds))return [];
  const particles=this.makeParticles(),boundaries=new Map(particles.map(particle=>[particle.id,this.makeBoundary()]));
  const paths=particles.map(particle=>[{...particle.position}]);
  const steps=Math.floor(Math.max(0,Math.min(MAX_FLIGHT_SECONDS,seconds))/FIXED_STEP+1e-9);
  for(let step=1;step<=steps;step++){
   const result=stepVolley(particles,this.state.sector,boundaries,false);
   particles.forEach((particle,index)=>{
    if(step%4===0||!particle.alive||step===steps){if(distance(paths[index].at(-1)!,particle.position)>1e-8)paths[index].push({...particle.position});}
   });
   if(result!==null)break;
  }
  return paths;
 }
 private expireTrails():void {for(const particle of this.state.particles)particle.trail=particle.trail.filter(point=>this.trailElapsed-(point.time??0)<=3);}
 private makeBoundary():Boundary {return {bounds:{...(this.injectedBounds??this.state.sector.bounds)},outsideElapsed:0};}
 private branchIsAvailable():boolean {return this.state.status==='flying'&&this.state.shotCount===3&&!this.branched&&this.state.particles.length===1&&this.state.particles[0].alive;}
 private makeParticles():Particle[] {
  const speed=launchSpeed(this.state.aim.power),offsets=[0];
  return offsets.map((offset,id)=>{
   const position={...this.state.sector.launch},angle=this.state.aim.angle+offset;
   const particle:Particle={id,position,velocity:{x:Math.cos(angle)*speed,y:Math.sin(angle)*speed},alive:true,trail:[{...position,time:0}]};publishOutside(particle,this.makeBoundary());return particle;
  });
 }
 private setDefaultAim():void {this.state.aim={angle:this.state.sector.solution.angle+0.07,power:clamp01(this.state.sector.solution.power+0.035)};}
 private rememberLayout():void {this.recentLayouts.push(describeComposition(this.state.sector));if(this.recentLayouts.length>RECENT_LAYOUT_LIMIT)this.recentLayouts.shift();}
 private emit(kind:EngineEventKind):void {this.state.event={id:++this.eventId,kind};}
 private fail(message:string):void {
  if(this.state.status!=='flying')return;this.state.status='failed';this.state.particles.forEach(particle=>{particle.alive=false;});this.state.message=message;this.emit('fail');
 }
 private dock():void {
  if(this.state.status!=='flying')return;this.state.checkpointCount++;this.state.status='docked';this.state.particles.forEach(particle=>{particle.alive=false;});this.state.message='Docked.';this.emit('dock');
 }
}
