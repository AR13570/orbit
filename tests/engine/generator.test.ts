import { describe,expect,it } from 'vitest';
import { generateFallbackSector,generateGuaranteedFallbackSector,generateSector } from '../../src/game/generator';
import { bodyStrength,distance,segmentCircleIntersection,SHIP_RADIUS,stepParticle,zenLaunchSpeed } from '../../src/game/physics';
import type { Sector,Vec2 } from '../../src/game/types';
import { compositionDistance,describeComposition,freshComposition,geometryDistance,MIN_COMPOSITION_DISTANCE,MIN_GEOMETRY_DISTANCE,RECENT_LAYOUT_LIMIT } from '../../src/game/composition';
import { blocksStraightCorridor,captureChordBend,MIN_CAPTURE_CHORD_BEND,probeFlight } from '../../src/game/challenge';
import { matchesStructure } from '../../src/game/structures';
import { CERTIFIED_LAYOUTS } from '../../src/game/certified-layouts';
import type { CompositionDescriptor } from '../../src/game/composition';
function verifyRoute(sector:Sector,angleDelta=0,powerDelta=0):string|null {
 let position={...sector.launch},velocity={x:Math.cos(sector.solution.angle+angleDelta)*(sector.solution.power+powerDelta)*420,y:Math.sin(sector.solution.angle+angleDelta)*(sector.solution.power+powerDelta)*420};
 for(let n=0;n<2640;n++){
  const next=stepParticle(position,velocity,sector.bodies,1/120,sector.checkpoint),dock=segmentCircleIntersection(position,next.position,sector.checkpoint.position,sector.checkpoint.radius+SHIP_RADIUS);
  for(const solid of sector.bodies){const hit=segmentCircleIntersection(position,next.position,solid.position,solid.radius+SHIP_RADIUS);if(hit!==null&&(dock===null||hit<=dock))return `collision ${solid.id}`;}
  if(dock!==null)return null;const b=sector.bounds;if(next.position.x<b.x+SHIP_RADIUS||next.position.x>b.x+b.width-SHIP_RADIUS||next.position.y<b.y+SHIP_RADIUS||next.position.y>b.y+b.height-SHIP_RADIUS)return 'escaped';position=next.position;velocity=next.velocity;
 }return 'did not dock';
}
function assertLayout(sector:Sector):void {
 const {launch,checkpoint,bodies}=sector;
 expect(matchesStructure(sector.generation.family,bodies,launch,checkpoint),`structural identity ${sector.seed}:${sector.index}`).toBe(true);
 if(sector.generation.validation==='geometric')expect(blocksStraightCorridor(sector)).toBe(true);
 expect(captureChordBend(sector.solution.path)).toBeGreaterThanOrEqual(MIN_CAPTURE_CHORD_BEND);
 expect(bodies.length).toBeGreaterThanOrEqual(3);expect(bodies.length).toBeLessThanOrEqual(8);
 expect(bodies.some(b=>b.kind==='attractor')).toBe(true);expect(bodies.some(b=>b.kind==='repellent')).toBe(true);
 for(let a=0;a<bodies.length;a++){
  const body=bodies[a];expect(body.strength).toBe(bodyStrength(body.radius));expect(distance(body.position,launch)-body.radius).toBeGreaterThanOrEqual(65);
  expect(distance(body.position,checkpoint.position)-body.radius-checkpoint.radius).toBeGreaterThanOrEqual(30-1e-8);
  expect(body.position.x-body.radius).toBeGreaterThanOrEqual(sector.bounds.x);expect(body.position.x+body.radius).toBeLessThanOrEqual(sector.bounds.x+sector.bounds.width);expect(body.radius).toBeLessThanOrEqual(104);
  for(let b=a+1;b<bodies.length;b++)expect(distance(body.position,bodies[b].position)-body.radius-bodies[b].radius).toBeGreaterThanOrEqual(65-1e-8);
 }
 expect(checkpoint.radius).toBe(45);expect(checkpoint.position.x-launch.x).toBeGreaterThanOrEqual(600);expect(checkpoint.position.x-launch.x).toBeLessThanOrEqual(850);expect(Math.abs(checkpoint.position.y-launch.y)).toBeLessThanOrEqual(200);
 expect(sector.bounds.width).toBe(1250);expect(sector.bounds.height).toBe(900);expect(sector.solution.power).toBeGreaterThanOrEqual(0.5);expect(sector.solution.power).toBeLessThanOrEqual(0.75);expect(sector.solution.speed).toBe(zenLaunchSpeed(sector.solution.power));
}
function assertRoutes(sector:Sector):void {for(const [angle,power] of [[0,0],[0.025,0],[-0.025,0],[0,0.025],[0,-0.025]])expect(verifyRoute(sector,angle,power),`seed${sector.seed},index${sector.index},angle${angle},power${power}`).toBeNull();}
function collisionProbe(sector:Sector,angle:number,power:number,bodyForces=true):'collision'|'dock'|'unresolved' {
 let position={...sector.launch},velocity={x:Math.cos(angle)*power*420,y:Math.sin(angle)*power*420};
 for(let step=0;step<2640;step++){
  const next=stepParticle(position,velocity,bodyForces?sector.bodies:[],1/120,sector.checkpoint),dock=segmentCircleIntersection(position,next.position,sector.checkpoint.position,sector.checkpoint.radius+SHIP_RADIUS);
  for(const solid of sector.bodies){const hit=segmentCircleIntersection(position,next.position,solid.position,solid.radius+SHIP_RADIUS);if(hit!==null&&(dock===null||hit<=dock))return 'collision';}
  if(dock!==null)return 'dock';position=next.position;velocity=next.velocity;
 }return 'unresolved';
}
function assertChallenge(sector:Sector):void {
 const bearing=Math.atan2(sector.checkpoint.position.y-sector.launch.y,sector.checkpoint.position.x-sector.launch.x);
 for(const power of [.8,.85,.9,.95,1])for(const offset of [0,-.025,.025,-.05,.05])expect(collisionProbe(sector,bearing+offset,power),`shortcut ${sector.seed}:${sector.index},power${power},offset${offset}`).toBe('collision');
 expect(collisionProbe(sector,sector.solution.angle,sector.solution.power,false),`gravity dependence ${sector.seed}:${sector.index}`).toBe('collision');
}

describe('structural field generation',()=>{
 it('blocks the seed42 opening shortcuts with real collisions and requires obstacle gravity',()=>{
  const recent:CompositionDescriptor[]=[];let origin={x:120,y:500};
  for(let index=0;index<3;index++){const sector=generateSector(42,index,origin,recent);assertChallenge(sector);assertRoutes(sector);recent.push(describeComposition(sector));origin=sector.checkpoint.position;}
 });
 it('requires meaningful obstacle gravity for ordinary solutions, retaining the goal force and solids',()=>{
  for(const seed of [1,7,31,42])assertChallenge(generateSector(seed));
 });
 it('blocks independent intermediate-power and intermediate-angle spot checks in the active run and backups',()=>{
  const recent:CompositionDescriptor[]=[];let origin={x:120,y:500};
  const fields:Sector[]=[];
  for(let index=0;index<4;index++){const sector=generateSector(42,index,origin,recent);fields.push(sector);recent.push(describeComposition(sector));origin=sector.checkpoint.position;}
  for(let index=0;index<4;index++)fields.push(generateGuaranteedFallbackSector(42,index));
  for(const sector of fields){
   const bearing=Math.atan2(sector.checkpoint.position.y-sector.launch.y,sector.checkpoint.position.x-sector.launch.x);
   for(const power of [.8,.825,.85,.875,.9,.925,.95,.975,1])for(const offset of [-.05,-.0375,-.025,-.0125,0,.0125,.025,.0375,.05])expect(collisionProbe(sector,bearing+offset,power),`dense shortcut ${sector.seed}:${sector.index},${power},${offset}`).toBe('collision');
  }
 });
 it('rejects identical obstacle geometry even when goal and gravity kinds change substantially',()=>{
  const original=describeComposition(generateSector(7));
  const changed:CompositionDescriptor={goal:[original.goal[0]+5,original.goal[1]+5],bodies:original.bodies.map(body=>({...body,kind:body.kind==='attractor'?'repellent':'attractor'}))};
  expect(compositionDistance(original,changed)).toBeGreaterThan(MIN_COMPOSITION_DISTANCE);expect(freshComposition(changed,[original])).toBe(false);
 });
 it('rejects perceptually similar compositions across a bounded recent run window',()=>{
  const recent:CompositionDescriptor[]=[];
  for(let index=0;index<18;index++){
   const sector=generateSector(7,index,{x:120,y:500},recent),descriptor=describeComposition(sector);
   for(const previous of recent){expect(compositionDistance(descriptor,previous),`index${index}`).toBeGreaterThanOrEqual(MIN_COMPOSITION_DISTANCE);expect(geometryDistance(descriptor,previous)).toBeGreaterThanOrEqual(MIN_GEOMETRY_DISTANCE);}
   assertLayout(sector);recent.push(descriptor);if(recent.length>RECENT_LAYOUT_LIMIT)recent.shift();
  }
 });
 it('preserves structural identity, clearance and a meaningful validated bend in every field',()=>{
  for(let seed=0;seed<10;seed++)for(const index of [0,6,16])assertLayout(generateSector(seed,index));
  assertLayout(generateFallbackSector(23,16,{x:-8500,y:2400}));
 });
 it('produces varied seeded clusters and useful ordinary-power routes across primary search and backups',()=>{
  const fields=Array.from({length:25},(_,seed)=>generateSector(seed,seed%20));
  const signatures=new Set(fields.map(s=>s.bodies.map(b=>`${Math.round(b.position.x-s.launch.x)/20|0}:${Math.round(b.position.y-s.launch.y)/20|0}:${b.kind}`).join('|')));
  expect(signatures.size).toBeGreaterThan(20);
  expect(new Set(fields.map(s=>s.solution.power)).size).toBeGreaterThanOrEqual(2);
  const goalYs=fields.map(s=>s.checkpoint.position.y-s.launch.y);expect(Math.max(...goalYs)-Math.min(...goalYs)).toBeGreaterThan(80);
  for(const field of fields){expect(field).toEqual(generateSector(field.seed,field.index));expect(field).not.toHaveProperty('pickups');expect(field).not.toHaveProperty('obstacles');}
 });
 it.each(Array.from({length:50},(_,seed)=>seed))('validates seed %i at four indices and translated origins using actual assisted physics',(seed)=>{
  const origins:Vec2[]=[{x:120,y:500},{x:18120,y:-300},{x:-8500,y:2400},{x:150000,y:50}];
  for(const index of [0,6,16,1000000]){const sector=generateSector(seed,index,origins[(seed+index)%4]);assertLayout(sector);assertRoutes(sector);assertChallenge(sector);}
 });
 it('preserves seeded geometry and solution choices under translated origins and high indices',()=>{
  for(const seed of [1,10,31])for(const index of [0,16,1000000]){
   const a=generateSector(seed,index,{x:0,y:0}),b=generateSector(seed,index,{x:150000,y:-8500});
   expect(a.generation).toEqual(b.generation);expect(a.solution.angle).toBe(b.solution.angle);expect(a.solution.power).toBe(b.solution.power);expect(a.solution.flightSeconds).toBe(b.solution.flightSeconds);
   a.bodies.forEach((body,i)=>{expect(b.bodies[i].position.x-150000).toBeCloseTo(body.position.x,8);expect(b.bodies[i].position.y+8500).toBeCloseTo(body.position.y,8);expect(b.bodies[i].radius).toBe(body.radius);});
   expect(b.checkpoint.position.x-150000).toBeCloseTo(a.checkpoint.position.x,8);expect(b.checkpoint.position.y+8500).toBeCloseTo(a.checkpoint.position.y,8);
  }
 });
 it('uses a family-preserving populated fallback with honest validated routes and translation',()=>{
  for(const origin of [{x:4120,y:700},{x:-8500,y:2400},{x:150000,y:-300}]){
   const sector=generateFallbackSector(23,4,origin);expect(sector).toEqual(generateFallbackSector(23,4,origin));expect(sector.generation.fallback).toBe(true);assertLayout(sector);assertRoutes(sector);assertChallenge(sector);
  }
 });
 it('has a certified populated construction independent of randomized fallback exhaustion',()=>{
  for(const seed of [0,1,7,31,0xffffffff])for(const origin of [{x:0,y:0},{x:150000,y:-300}]){
   const sector=generateGuaranteedFallbackSector(seed,1000000,origin);assertLayout(sector);assertRoutes(sector);expect(sector.generation.fallback).toBe(true);expect(sector).toEqual(generateGuaranteedFallbackSector(seed,1000000,origin));
  }
 });
 it('keeps consecutive guaranteed backups geometrically fresh across the full recent window',()=>{
  expect(CERTIFIED_LAYOUTS.length).toBeGreaterThan(RECENT_LAYOUT_LIMIT);
  const descriptors=CERTIFIED_LAYOUTS.map(entry=>describeComposition({launch:{x:0,y:0},checkpoint:{position:{x:entry.goal[0],y:entry.goal[1]},radius:45},bodies:entry.bodies.map(([x,y,radius,kind],id)=>({id:String(id),position:{x,y},radius,kind,strength:bodyStrength(radius)}))}));
  for(const entry of CERTIFIED_LAYOUTS){
   const sector:Sector={seed:0,index:0,launch:{x:0,y:0},bounds:{x:-100,y:-450,width:1250,height:900},width:1250,height:900,generation:{family:entry.family,fallback:true,validation:entry.validation},checkpoint:{position:{x:entry.goal[0],y:entry.goal[1]},radius:45},bodies:entry.bodies.map(([x,y,radius,kind],id)=>({id:String(id),position:{x,y},radius,kind,strength:bodyStrength(radius)})),solution:{angle:entry.angle,power:entry.power,speed:zenLaunchSpeed(entry.power),path:[],flightSeconds:0}};
   sector.solution.path=probeFlight(sector,sector.solution.angle,sector.solution.power,true,undefined,true).path;assertLayout(sector);assertRoutes(sector);assertChallenge(sector);
  }
  for(let a=0;a<descriptors.length;a++)for(let b=a+1;b<descriptors.length;b++)expect(freshComposition(descriptors[a],[descriptors[b]])).toBe(true);
  const recent:CompositionDescriptor[]=[];
  for(let index=0;index<24;index++){
   const sector=generateGuaranteedFallbackSector(7,index,{x:150000,y:-300},recent),descriptor=describeComposition(sector);assertLayout(sector);assertRoutes(sector);assertChallenge(sector);expect(freshComposition(descriptor,recent)).toBe(true);recent.push(descriptor);if(recent.length>RECENT_LAYOUT_LIMIT)recent.shift();
  }
 });
});
