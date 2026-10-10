import { describe,expect,it } from 'vitest';
import { OrbitEngine } from '../../src/game/engine';
import { generateFallbackSector,generateGuaranteedFallbackSector,generateSector } from '../../src/game/generator';
import { segmentCircleIntersection, stepParticle } from '../../src/game/physics';
import type { GameSnapshot,Sector,Vec2 } from '../../src/game/types';
import { compositionDistance,describeComposition,geometryDistance,MIN_COMPOSITION_DISTANCE,MIN_GEOMETRY_DISTANCE,RECENT_LAYOUT_LIMIT } from '../../src/game/composition';
import type { CompositionDescriptor } from '../../src/game/composition';

type EngineTestState=Omit<GameSnapshot,'sector'>&{sector:Sector};
const internal=(engine:OrbitEngine)=>(engine as unknown as {state:EngineTestState}).state;
function fixture(solid=false):OrbitEngine {
 const engine=new OrbitEngine(7);
 Object.assign(internal(engine).sector,{bounds:{x:0,y:0,width:1800,height:1000},launch:{x:100,y:500},checkpoint:{position:{x:400,y:500},radius:30},bodies:solid?[{id:'solid',kind:'attractor',position:{x:260,y:500},radius:35,strength:1102500}]:[]});
 engine.setAim(0,250/420);return engine;
}
function tick(engine:OrbitEngine,seconds=3):void {for(let n=0;n<seconds*60;n++)engine.update(1/60);}

describe('single-projectile journey',()=>{
 it('draws a previously uncaptured 140-unit miss into the goal with exact preview parity',()=>{
  const engine=fixture();internal(engine).sector.checkpoint={position:{x:400,y:640},radius:45};
  let position={x:100,y:500},velocity={x:250,y:0},unassistedDock=false;
  for(let step=0;step<240;step++){const next=stepParticle(position,velocity,[]);if(segmentCircleIntersection(position,next.position,{x:400,y:640},50)!==null)unassistedDock=true;position=next.position;velocity=next.velocity;}
  expect(unassistedDock).toBe(false);
  const path=engine.predict(3)[0],contact=path.at(-1)!;expect(contact.y).toBeGreaterThan(500);expect(Math.hypot(contact.x-400,contact.y-640)).toBeCloseTo(50);
  engine.launch();tick(engine);expect(engine.getSnapshot().status).toBe('docked');expect(engine.getSnapshot().particles[0].position).toEqual(contact);expect(engine.getSnapshot().checkpointCount).toBe(1);
 });
 it('captures a forty-unit near miss using the enlarged generated checkpoint radius',()=>{
  const engine=fixture();internal(engine).sector.checkpoint={position:{x:400,y:540},radius:generateSector(42).checkpoint.radius};
  const path=engine.predict(2)[0];expect(path.at(-1)!.x).toBeLessThan(370);expect(path.at(-1)!.y).toBeGreaterThan(500);
  engine.launch();tick(engine);expect(engine.getSnapshot().status).toBe('docked');expect(engine.getSnapshot().checkpointCount).toBe(1);expect(engine.getSnapshot().particles[0].position).toEqual(path.at(-1));
 });
 it('docks once, then advances exactly from the former ring',()=>{
  const engine=fixture();engine.launch();engine.launch();tick(engine);
  expect(engine.getSnapshot().status).toBe('docked');expect(engine.getSnapshot().checkpointCount).toBe(1);
  expect(engine.getSnapshot().particles).toHaveLength(1);expect(engine.getSnapshot().particles[0].alive).toBe(false);
  tick(engine);engine.advance();engine.advance();expect(engine.getSnapshot().sector.index).toBe(1);expect(engine.getSnapshot().sector.launch).toEqual({x:400,y:500});
 });
 it('retries the same field after collision without changing checkpoint progress',()=>{
  const engine=fixture(true);engine.launch();tick(engine);expect(engine.getSnapshot().status).toBe('failed');
  const sector=engine.getSnapshot().sector;engine.retry();engine.retry();expect(engine.getSnapshot().sector).toEqual(sector);expect(engine.getSnapshot().status).toBe('aiming');
 });
 it('allows unlimited failures and aborts after docking without losing checkpoint progress',()=>{
  const engine=new OrbitEngine(7);
  let snapshot=engine.getSnapshot();engine.setAim(snapshot.sector.solution.angle,snapshot.sector.solution.power);engine.launch();tick(engine,10);
  expect(engine.getSnapshot().status).toBe('docked');engine.advance();
  const checkpoint=engine.getSnapshot();expect(checkpoint.checkpointCount).toBe(1);
  expect(checkpoint).not.toHaveProperty('score');expect(checkpoint).not.toHaveProperty('shields');expect(checkpoint).not.toHaveProperty('lives');
  const unchanged=()=>{const current=engine.getSnapshot();expect(current.sector).toBe(checkpoint.sector);expect(current.sector.launch).toEqual(checkpoint.sector.launch);expect(current.checkpointCount).toBe(1);};
  for(let miss=0;miss<8;miss++){
   engine.setAim(Math.PI,1);engine.launch();tick(engine,8);expect(engine.getSnapshot().status).toBe('failed');unchanged();engine.retry();engine.retry();expect(engine.getSnapshot().status).toBe('aiming');unchanged();
  }
  for(let abort=0;abort<8;abort++){
   engine.setAim(0,1);engine.launch();engine.update(1/60);engine.retry();expect(engine.getSnapshot().status).toBe('aiming');unchanged();
  }
  snapshot=engine.getSnapshot();engine.setAim(snapshot.sector.solution.angle,snapshot.sector.solution.power);engine.launch();tick(engine,10);
  expect(engine.getSnapshot().status).toBe('docked');expect(engine.getSnapshot().checkpointCount).toBe(2);engine.advance();expect(engine.getSnapshot().sector.launch).toEqual(snapshot.sector.checkpoint.position);
 });
 it('restarts deterministically only when explicitly requested',()=>{
  const engine=fixture();engine.launch();tick(engine);engine.advance();expect(engine.getSnapshot().checkpointCount).toBe(1);engine.restart(7);
  expect(engine.getSnapshot().status).toBe('aiming');expect(engine.getSnapshot().checkpointCount).toBe(0);expect(engine.getSnapshot().sector).toEqual(new OrbitEngine(7).getSnapshot().sector);
 });
 it('replays the varied checkpoint sequence after restart and ignores retry attempts in layout history',()=>{
  const engine=new OrbitEngine(31),reference:GameSnapshot['sector'][]=[];
  for(let replay=0;replay<2;replay++){
   if(replay)engine.restart(31);
   for(let index=0;index<8;index++){
    const snapshot=engine.getSnapshot();if(replay)expect(snapshot.sector).toEqual(reference[index]);else reference.push(snapshot.sector);
    engine.setAim(snapshot.sector.solution.angle,snapshot.sector.solution.power);
    if(replay){engine.launch();engine.update(1/60);engine.retry();}
    engine.launch();tick(engine,6);expect(engine.getSnapshot().status).toBe('docked');engine.advance();
   }
  }
 });
 it('permits zero initial velocity and never fails from a hidden on-screen timeout',()=>{
  const engine=fixture();engine.setAim(Number.NaN,2);expect(engine.getSnapshot().aim.power).toBe(250/420);
  internal(engine).sector.checkpoint.position={x:10000,y:10000};
  engine.setAim(0,-1);engine.launch();expect(engine.getSnapshot().particles[0].velocity).toEqual({x:0,y:0});engine.update(Number.NaN);engine.update(-1);expect(engine.getSnapshot().elapsed).toBe(0);
  tick(engine,24);expect(engine.getSnapshot().status).toBe('flying');expect(engine.getSnapshot().elapsed).toBe(24);engine.retry();
 });
 it('preserves exact preview/live parity in offset global fields',()=>{
  const engine=new OrbitEngine(31);internal(engine).sector=generateSector(31,12,{x:7200,y:-450});engine.setAim(engine.getSnapshot().sector.solution.angle,engine.getSnapshot().sector.solution.power);
  const before=engine.getSnapshot();const paths=engine.predict(1.7);expect(engine.getSnapshot()).toEqual(before);expect(paths).toHaveLength(1);engine.launch();
  for(let n=1;n<paths[0].length;n++){engine.update(1/30);expect(engine.getSnapshot().particles[0].position.x).toBeCloseTo(paths[0][n].x,9);expect(engine.getSnapshot().particles[0].position.y).toBeCloseTo(paths[0][n].y,9);}
 });
 it('shares frozen static sectors while independently copying aim and live trails',()=>{
  const engine=fixture();const first=engine.getSnapshot(),second=engine.getSnapshot();expect(first.sector).toBe(second.sector);expect(Object.isFrozen(first.sector.solution.path[0])).toBe(true);
  expect(()=>{(first.sector.launch as Vec2).x=-100;}).toThrow(TypeError);first.aim.power=0;expect(engine.getSnapshot().aim.power).toBe(250/420);
  engine.launch();engine.update(0.25);const flight=engine.getSnapshot();flight.particles[0].position.x=-100;flight.particles[0].trail[0].x=-100;expect(engine.getSnapshot().particles[0].position.x).toBeGreaterThan(100);expect(engine.getSnapshot().particles[0].trail[0].x).toBe(100);
  tick(engine);engine.advance();expect(engine.getSnapshot().sector).not.toBe(first.sector);expect(first.sector.launch).toEqual({x:100,y:500});
 });
 it('is independent of frame chunking and caps delayed frames',()=>{
  const fine=fixture(),coarse=fixture();fine.launch();coarse.launch();for(let n=0;n<30;n++)fine.update(1/120);coarse.update(10);expect(coarse.getSnapshot().particles).toEqual(fine.getSnapshot().particles);expect(coarse.getSnapshot().elapsed).toBe(0.25);
 });
 it('keeps 144 successive checkpoints reachable and globally rightward',()=>{
  for(let seed=1;seed<=12;seed++){
   const engine=new OrbitEngine(seed),recent:CompositionDescriptor[]=[];
   for(let sector=0;sector<12;sector++){
    const snapshot=engine.getSnapshot(),ring=snapshot.sector.checkpoint.position,descriptor=describeComposition(snapshot.sector);
    for(const previous of recent){expect(compositionDistance(descriptor,previous),`composition seed${seed},sector${sector}`).toBeGreaterThanOrEqual(MIN_COMPOSITION_DISTANCE);expect(geometryDistance(descriptor,previous),`geometry seed${seed},sector${sector}`).toBeGreaterThanOrEqual(MIN_GEOMETRY_DISTANCE);}
    recent.push(descriptor);if(recent.length>RECENT_LAYOUT_LIMIT)recent.shift();
    expect(ring.x-snapshot.sector.launch.x).toBeGreaterThanOrEqual(600);engine.setAim(snapshot.sector.solution.angle,snapshot.sector.solution.power);engine.launch();tick(engine,10);expect(engine.getSnapshot().status,`seed${seed},sector${sector}`).toBe('docked');engine.advance();expect(engine.getSnapshot().sector.launch).toEqual(ring);
   }
  }
 });
 it('docks with nearby single-shot angle and power choices across representative compact fields',()=>{
  for(let seed=1;seed<=12;seed++)for(const [angleOffset,powerOffset] of [[0.025,0],[-0.025,0],[0,0.025],[0,-0.025]]){
   const engine=new OrbitEngine(seed),solution=engine.getSnapshot().sector.solution;
   engine.setAim(solution.angle+angleOffset,solution.power+powerOffset);engine.launch();tick(engine,6);
   expect(engine.getSnapshot().status,`seed${seed},angle${angleOffset},power${powerOffset}`).toBe('docked');
   expect(engine.getSnapshot().checkpointCount).toBe(1);
  }
 });
 it('publishes assisted solution paths and times that match actual prediction through capture',()=>{
  const sectors:Sector[]=[generateFallbackSector(23,16,{x:-8500,y:2400}),generateFallbackSector(1,0,{x:150000,y:-300}),generateGuaranteedFallbackSector(7,16,{x:-8500,y:2400}),generateGuaranteedFallbackSector(31,0,{x:150000,y:-300})];
  for(let seed=1;seed<=8;seed++)for(const index of [0,16])sectors.push(generateSector(seed,index,{x:8000,y:-1200}));
  for(const sector of sectors){
   const engine=new OrbitEngine(sector.seed);internal(engine).sector=sector;
   engine.setAim(sector.solution.angle,sector.solution.power);const path=engine.predict(sector.solution.flightSeconds+1/120)[0];
   expect(path).toEqual(sector.solution.path);const contact=path.at(-1)!;
   expect(Math.hypot(contact.x-sector.checkpoint.position.x,contact.y-sector.checkpoint.position.y)).toBeCloseTo(50,8);
   engine.launch();for(let step=0;step<Math.round(sector.solution.flightSeconds*120);step++)engine.update(1/120);
   expect(engine.getSnapshot().status).toBe('docked');expect(engine.getSnapshot().elapsed).toBe(sector.solution.flightSeconds);
  }
 });
});

describe('visible flight bounds',()=>{
 function openField():OrbitEngine {const engine=fixture();internal(engine).sector.checkpoint.position={x:10000,y:500};engine.setAim(0,1);return engine;}
 it('preserves visible flight beyond canonical bounds and permits free retries after the outside timeout',()=>{
  const canonical=openField();canonical.launch();tick(canonical,4.5);expect(canonical.getSnapshot().status).toBe('flying');expect(canonical.getSnapshot().particles[0].offscreenRemaining).toBeLessThan(6);tick(canonical,6);expect(canonical.getSnapshot().status).toBe('failed');expect(canonical.getSnapshot().particles[0].position.x).toBeCloseTo(4325);
  const engine=openField();engine.setFlightBounds({x:0,y:0,width:3000,height:1000});engine.launch();tick(engine,4.5);expect(engine.getSnapshot().particles[0].position.x).toBeGreaterThan(1800);expect(engine.getSnapshot().particles[0].offscreenRemaining).toBeUndefined();
  tick(engine,9);expect(engine.getSnapshot().status).toBe('failed');expect(engine.getSnapshot().particles[0].position.x).toBeCloseTo(5525);engine.retry();expect(engine.getSnapshot().status).toBe('aiming');expect(engine.getSnapshot().checkpointCount).toBe(0);
 });
 it('uses identical outside timeout positions in prediction and live flight',()=>{
  const engine=openField();engine.setFlightBounds({x:0,y:0,width:2600,height:1000});const before=engine.getSnapshot();const path=engine.predict(14)[0];expect(path.at(-1)!.x).toBeCloseTo(5125);expect(engine.getSnapshot()).toEqual(before);engine.launch();tick(engine,14);expect(engine.getSnapshot().particles[0].position).toEqual(path.at(-1));
 });
 it('resets the outside interval on real re-entry following resize',()=>{
  const engine=openField();engine.setFlightBounds({x:0,y:0,width:3000,height:1000});engine.launch();tick(engine,1);engine.setFlightBounds({x:800,y:0,width:1500,height:1000});tick(engine,0.25);expect(engine.getSnapshot().status).toBe('flying');expect(engine.getSnapshot().particles[0].offscreenRemaining).toBeCloseTo(5.75);
  tick(engine,1);expect(engine.getSnapshot().particles[0].offscreenRemaining).toBeUndefined();tick(engine,9.5);expect(engine.getSnapshot().status).toBe('failed');expect(engine.getSnapshot().particles[0].position.x).toBeCloseTo(4825);
 });
 it('defensively copies visible bounds, ignores invalid rectangles and restores canonical bounds',()=>{
  const engine=openField(),bounds={x:0,y:0,width:3000,height:1000};engine.setFlightBounds(bounds);bounds.width=100;engine.setFlightBounds({x:0,y:0,width:Number.NaN,height:100});expect(engine.predict(14)[0].at(-1)!.x).toBeCloseTo(5525);engine.setFlightBounds(null);expect(engine.predict(14)[0].at(-1)!.x).toBeCloseTo(4325);
 });
});


describe('tap-to-branch shooter', () => {
 it('applies the same current goal attraction independently to every branched piece',()=>{
  const engine=fixture();internal(engine).sector.checkpoint={position:{x:450,y:580},radius:45};engine.setShotCount(3);engine.launch();tick(engine,0.4);engine.branch();
  const before=engine.getSnapshot(),expected=before.particles.map(piece=>stepParticle(piece.position,piece.velocity,before.sector.bodies,1/120,before.sector.checkpoint));
  expected.forEach((piece,index)=>expect(piece.velocity.y).toBeGreaterThan(before.particles[index].velocity.y));
  engine.update(1/120);engine.getSnapshot().particles.forEach((piece,index)=>{expect(piece.position).toEqual(expected[index].position);expect(piece.velocity).toEqual(expected[index].velocity);});
 });
 it('defaults to single and changes selected mode only while aiming', () => {
  const engine=fixture();expect(engine.getSnapshot().shotCount).toBe(1);expect(engine.getSnapshot().canBranch).toBe(false);
  engine.toggleShotCount();expect(engine.getSnapshot().shotCount).toBe(3);engine.toggleShotCount();expect(engine.getSnapshot().shotCount).toBe(1);
  engine.setShotCount(3);engine.launch();engine.toggleShotCount();engine.setShotCount(1);expect(engine.getSnapshot().shotCount).toBe(3);
 });
 it('launches and predicts exactly one initial projectile in either selected mode', () => {
  for(const mode of [1,3] as const){
   const engine=fixture();engine.setShotCount(mode);expect(engine.predict(1)).toHaveLength(1);engine.launch();
   expect(engine.getSnapshot().particles).toHaveLength(1);expect(engine.getSnapshot().canBranch).toBe(mode===3);
  }
 });
 it('branches at current curved-flight position and speed with three-degree tangent offsets', () => {
  const engine=fixture();internal(engine).sector.checkpoint.position={x:10000,y:10000};
  internal(engine).sector.bodies=[{id:'well',kind:'attractor',position:{x:450,y:240},radius:90,strength:7290000}];
  engine.setShotCount(3);engine.launch();tick(engine,0.4);
  const before=engine.getSnapshot().particles[0],angle=Math.atan2(before.velocity.y,before.velocity.x),speed=Math.hypot(before.velocity.x,before.velocity.y);
  expect(before.position.x).toBeGreaterThan(100);expect(before.velocity.y).not.toBe(0);engine.branch();
  const particles=engine.getSnapshot().particles;expect(particles).toHaveLength(3);expect(particles[0]).toEqual(before);
  for(const index of [1,2]){
   expect(particles[index].position).toEqual(before.position);expect(particles[index].trail).toEqual([before.position]);
   expect(Math.hypot(particles[index].velocity.x,particles[index].velocity.y)).toBeCloseTo(speed,9);
   expect(Math.atan2(particles[index].velocity.y,particles[index].velocity.x)-angle).toBeCloseTo(index===1?-Math.PI/60:Math.PI/60,9);
  }
  expect(engine.getSnapshot().canBranch).toBe(false);const branched=engine.getSnapshot();for(let tap=0;tap<8;tap++)engine.branch();expect(engine.getSnapshot()).toEqual(branched);
 });
 it('ignores branch taps in single mode and outside live flight', () => {
  const engine=fixture();const aiming=engine.getSnapshot();engine.branch();expect(engine.getSnapshot()).toEqual(aiming);
  engine.launch();const flying=engine.getSnapshot();engine.branch();expect(engine.getSnapshot()).toEqual(flying);
  tick(engine);const docked=engine.getSnapshot();engine.branch();expect(engine.getSnapshot()).toEqual(docked);
 });
 it('matches the real one-path preview until the player actually branches', () => {
  const engine=new OrbitEngine(31);internal(engine).sector=generateSector(31,12,{x:7200,y:-450});engine.setShotCount(3);
  engine.setAim(engine.getSnapshot().sector.solution.angle,engine.getSnapshot().sector.solution.power);const before=engine.getSnapshot(),paths=engine.predict(0.5);
  expect(paths).toHaveLength(1);expect(engine.getSnapshot()).toEqual(before);engine.launch();
  for(let step=1;step<paths[0].length;step++){engine.update(1/30);const particle=engine.getSnapshot().particles[0];expect(particle.position.x).toBeCloseTo(paths[0][step].x,9);expect(particle.position.y).toBeCloseTo(paths[0][step].y,9);}
  engine.branch();expect(engine.getSnapshot().particles).toHaveLength(3);expect(engine.predict(1)).toEqual([]);
 });
 it('integrates gravity independently for every newly branched piece', () => {
  const engine=fixture();internal(engine).sector.checkpoint.position={x:10000,y:10000};
  internal(engine).sector.bodies=[{id:'well',kind:'attractor',position:{x:450,y:240},radius:90,strength:7290000}];
  engine.setShotCount(3);engine.launch();tick(engine,0.4);engine.branch();
  for(let step=0;step<2;step++){
   const before=engine.getSnapshot(),expected=before.particles.map(p=>stepParticle(p.position,p.velocity,before.sector.bodies));engine.update(1/120);
   engine.getSnapshot().particles.forEach((particle,index)=>{expect(particle.position).toEqual(expected[index].position);expect(particle.velocity).toEqual(expected[index].velocity);});
  }
 });
 it('loses one branched piece without stopping the remaining pieces', () => {
  const engine=fixture();internal(engine).sector.checkpoint.position={x:1000,y:500};
  internal(engine).sector.bodies=[{id:'small',kind:'attractor',position:{x:450,y:486.9},radius:2,strength:3600}];
  engine.setShotCount(3);engine.launch();tick(engine,0.4);engine.branch();tick(engine,1.2);
  expect(engine.getSnapshot().particles.map(p=>p.alive)).toEqual([true,false,true]);expect(engine.getSnapshot().status).toBe('flying');expect(engine.getSnapshot().canBranch).toBe(false);
 });
 it('resolves the earliest side-piece docking once and dissolves the remaining volley', () => {
  const engine=fixture();internal(engine).sector.checkpoint={position:{x:400,y:479},radius:45};
  engine.setShotCount(3);engine.launch();tick(engine,0.4);engine.branch();tick(engine,3);
  const snapshot=engine.getSnapshot(),goal=snapshot.sector.checkpoint.position,side=snapshot.particles[1].position,center=snapshot.particles[0].position;
  expect(snapshot.status).toBe('docked');expect(snapshot.checkpointCount).toBe(1);expect(snapshot.particles.every(p=>!p.alive)).toBe(true);expect(snapshot.canBranch).toBe(false);
  expect(Math.hypot(side.x-goal.x,side.y-goal.y)).toBeCloseTo(50);expect(Math.hypot(center.x-goal.x,center.y-goal.y)).toBeGreaterThan(50);
  tick(engine,3);engine.branch();expect(engine.getSnapshot().checkpointCount).toBe(1);engine.advance();engine.advance();expect(engine.getSnapshot().sector.index).toBe(1);
 });
 it('retries all-lost volleys freely and retains selected mode through checkpoints and new seeds', () => {
  const engine=fixture();engine.setShotCount(3);engine.launch();tick(engine);engine.advance();const checkpoint=engine.getSnapshot();expect(checkpoint.shotCount).toBe(3);
  for(let attempt=0;attempt<5;attempt++){
   engine.setAim(Math.PI,1);engine.launch();expect(engine.getSnapshot().canBranch).toBe(true);engine.update(1/60);engine.branch();tick(engine,8);
   expect(engine.getSnapshot().status).toBe('failed');expect(engine.getSnapshot().particles.every(p=>!p.alive)).toBe(true);expect(engine.getSnapshot().canBranch).toBe(false);
   engine.retry();expect(engine.getSnapshot().sector).toBe(checkpoint.sector);expect(engine.getSnapshot().checkpointCount).toBe(1);expect(engine.getSnapshot().shotCount).toBe(3);
  }
  engine.restart(89);expect(engine.getSnapshot().shotCount).toBe(3);expect(engine.getSnapshot().canBranch).toBe(false);engine.launch();expect(engine.getSnapshot().canBranch).toBe(true);
  engine.retry();engine.setShotCount(1);engine.restart(42);expect(engine.getSnapshot().shotCount).toBe(1);
 });
 it('maintains independent outside timers after resize and branch', () => {
  const engine=fixture();internal(engine).sector.checkpoint.position={x:10000,y:500};engine.setShotCount(3);engine.launch();tick(engine,0.4);engine.branch();tick(engine,0.8);
  engine.setFlightBounds({x:0,y:503,width:1800,height:1000});internal(engine).particles[0].velocity={x:0,y:-30};internal(engine).particles[1].velocity={x:0,y:30};internal(engine).particles[2].velocity={x:0,y:0};
  engine.update(0.25);expect(engine.getSnapshot().particles.every(p=>p.alive)).toBe(true);expect(engine.getSnapshot().particles[0].offscreenRemaining).toBeLessThan(6);
  engine.update(0.25);expect(engine.getSnapshot().particles[1].offscreenRemaining).toBeUndefined();internal(engine).particles[1].velocity={x:0,y:-30};tick(engine,0.5);
  internal(engine).particles.forEach(piece=>{piece.velocity={x:0,y:0};});tick(engine,5.1);expect(engine.getSnapshot().particles.map(p=>p.alive)).toEqual([false,true,true]);tick(engine,1);expect(engine.getSnapshot().particles.map(p=>p.alive)).toEqual([false,false,true]);expect(engine.getSnapshot().status).toBe('flying');
 });
 it('bounds all branched trails during a long on-screen flight', () => {
  const engine=fixture();internal(engine).sector.checkpoint.position={x:10000,y:10000};engine.setFlightBounds({x:-10000,y:-10000,width:20000,height:20000});engine.setShotCount(3);engine.launch();tick(engine,0.4);engine.branch();tick(engine,24);
  expect(engine.getSnapshot().status).toBe('flying');expect(engine.getSnapshot().particles.map(p=>p.trail.length)).toEqual([180,180,180]);expect(engine.getSnapshot().particles).toHaveLength(3);
 });
 it('copies outside elapsed independently when branching before the center re-enters view', () => {
  const engine=fixture();internal(engine).sector.checkpoint.position={x:10000,y:500};engine.setShotCount(3);engine.launch();tick(engine,0.4);
  engine.setFlightBounds({x:0,y:510,width:1800,height:1000});engine.branch();
  internal(engine).particles[0].velocity={x:0,y:80};internal(engine).particles[1].velocity={x:0,y:-20};internal(engine).particles[2].velocity={x:0,y:0};
  engine.update(0.25);
  const snapshot=engine.getSnapshot();expect(snapshot.particles.map(p=>p.alive)).toEqual([true,true,true]);expect(snapshot.particles[0].position.y).toBeGreaterThan(515);expect(snapshot.particles[1].position.y).toBeLessThan(515);
 });
});
