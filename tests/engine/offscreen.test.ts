import { describe,expect,it } from 'vitest';
import { OrbitEngine } from '../../src/game/engine';
import { FIXED_STEP,OFFSCREEN_TIMEOUT_SECONDS } from '../../src/game/physics';
import type { Particle,Sector } from '../../src/game/types';
const state=(engine:OrbitEngine)=>(engine as unknown as {state:{sector:Sector;particles:Particle[]}}).state;
const remaining=(engine:OrbitEngine,index=0)=>(engine.getSnapshot().particles[index] as Particle&{offscreenRemaining?:number}).offscreenRemaining;
function field():OrbitEngine {
 const engine=new OrbitEngine(7);Object.assign(state(engine).sector,{launch:{x:100,y:500},bounds:{x:0,y:0,width:200,height:1000},checkpoint:{position:{x:10000,y:500},radius:45},bodies:[]});engine.setAim(0,250/420);return engine;
}
function tick(engine:OrbitEngine,seconds:number):void {for(let step=0;step<Math.round(seconds/FIXED_STEP);step++)engine.update(FIXED_STEP);}

describe('off-screen flight and return',()=>{
 it('counts an intersecting physical circle as visible and respects rounded rectangle corners',()=>{
  expect(OFFSCREEN_TIMEOUT_SECONDS).toBe(6);
  for(const [position,visible] of [[{x:205,y:500},true],[{x:-3,y:-4},true],[{x:-4,y:-4},false]] as const){
   const engine=field();state(engine).sector.launch={...position};engine.setAim(0,0);engine.launch();expect(remaining(engine)).toBe(visible?undefined:6);tick(engine,6);expect(engine.getSnapshot().status).toBe(visible?'flying':'failed');
  }
 });
 it('keeps moving after exit, exposes remaining active seconds and expires once at the true deadline',()=>{
  const engine=field();engine.launch();expect(remaining(engine)).toBeUndefined();tick(engine,1);
  expect(engine.getSnapshot().status).toBe('flying');expect(engine.getSnapshot().particles[0].position.x).toBeCloseTo(350);expect(remaining(engine)).toBeCloseTo(5.42,8);
  const paused=engine.getSnapshot();engine.update(0);engine.update(-1);engine.update(Number.NaN);expect(engine.getSnapshot()).toEqual(paused);
  tick(engine,5.416666666666667);expect(engine.getSnapshot().status).toBe('flying');engine.update(FIXED_STEP);
  const expired=engine.getSnapshot();expect(expired.status).toBe('failed');expect(expired.particles[0].position.x).toBeCloseTo(1705,7);expect(remaining(engine)).toBe(0);expect(expired.checkpointCount).toBe(0);
  tick(engine,10);expect(engine.getSnapshot()).toEqual(expired);engine.retry();expect(engine.getSnapshot().status).toBe('aiming');expect(engine.getSnapshot().sector).toBe(expired.sector);engine.launch();tick(engine,.5);expect(remaining(engine)).toBeCloseTo(5.92,8);
 });
 it('returns under actual gravity and resets continuous outside time on each orbit',()=>{
  const engine=field();Object.assign(state(engine).sector,{launch:{x:200,y:500},bounds:{x:0,y:0,width:800,height:550},checkpoint:{position:{x:10000,y:10000},radius:45},bodies:[{id:'orbit',kind:'attractor',position:{x:400,y:500},radius:90,strength:0}]});engine.setAim(Math.PI/2,180/420);engine.launch();
  let left=false,returned=false,secondExit=false;
  for(let step=0;step<1440;step++){
   engine.update(FIXED_STEP);expect(engine.getSnapshot().status).toBe('flying');
   if(!left&&remaining(engine)!==undefined)left=true;
   else if(left&&!returned&&remaining(engine)===undefined)returned=true;
   else if(returned&&remaining(engine)!==undefined){expect(remaining(engine)).toBeGreaterThan(5.99);secondExit=true;break;}
  }
  expect(left&&returned&&secondExit).toBe(true);expect(engine.getSnapshot().particles[0].velocity.x).not.toBeCloseTo(0);
  const inertial=field();Object.assign(state(inertial).sector,{launch:{x:200,y:500},bounds:{x:0,y:0,width:800,height:550},checkpoint:{position:{x:10000,y:10000},radius:45}});inertial.setAim(Math.PI/2,180/420);inertial.launch();tick(inertial,7);expect(inertial.getSnapshot().status).toBe('failed');
 });
 it('preserves elapsed time through identical per-frame bounds and changes that leave the ship outside',()=>{
  const engine=field();engine.launch();tick(engine,1);
  for(let step=0;step<600;step++){engine.setFlightBounds({x:step%2?-10:0,y:0,width:200,height:1000});engine.update(FIXED_STEP);}
  expect(engine.getSnapshot().status).toBe('flying');expect(remaining(engine)).toBeCloseTo(.42,8);
  for(let step=0;step<60;step++){engine.setFlightBounds({x:0,y:0,width:200,height:1000});engine.update(FIXED_STEP);}
  expect(engine.getSnapshot().status).toBe('failed');
 });
 it('resets only on visibility re-entry and grants a fresh continuous interval after another exit',()=>{
  const engine=field();engine.launch();tick(engine,1);engine.setFlightBounds({x:300,y:0,width:300,height:1000});expect(remaining(engine)).toBeUndefined();tick(engine,.5);
  engine.setFlightBounds(null);expect(remaining(engine)).toBe(6);tick(engine,6-FIXED_STEP);expect(engine.getSnapshot().status).toBe('flying');expect(remaining(engine)).toBeCloseTo(FIXED_STEP,8);engine.update(FIXED_STEP);expect(engine.getSnapshot().status).toBe('failed');
 });
 it('inherits the existing outside deadline when branching and cannot buy extra time by tapping',()=>{
  const engine=field();engine.setShotCount(3);engine.launch();tick(engine,5);const before=remaining(engine);engine.branch();expect(engine.getSnapshot().particles.map((_,i)=>remaining(engine,i))).toEqual([before,before,before]);
  tick(engine,1.416666666666667);expect(engine.getSnapshot().particles.every(p=>p.alive)).toBe(true);engine.update(FIXED_STEP);expect(engine.getSnapshot().status).toBe('failed');expect(engine.getSnapshot().particles.map(p=>p.alive)).toEqual([false,false,false]);
  engine.retry();expect(engine.getSnapshot().shotCount).toBe(3);expect(engine.getSnapshot().status).toBe('aiming');
 });
 it('resets one returned split piece independently while the other two expire',()=>{
  const engine=field();engine.setShotCount(3);engine.launch();tick(engine,4);engine.branch();tick(engine,.5);engine.setFlightBounds({x:0,y:505.5,width:3000,height:500});
  expect(remaining(engine,0)).toBeCloseTo(1.92,8);expect(remaining(engine,1)).toBeCloseTo(1.92,8);expect(remaining(engine,2)).toBeUndefined();state(engine).particles.forEach(p=>{p.velocity={x:0,y:0};});tick(engine,2);
  expect(engine.getSnapshot().particles.map(p=>p.alive)).toEqual([false,false,true]);expect(engine.getSnapshot().status).toBe('flying');tick(engine,24);expect(engine.getSnapshot().status).toBe('flying');
 });
 it('uses identical nonmutating prediction and live movement through exit and timeout',()=>{
  const engine=field(),before=engine.getSnapshot(),path=engine.predict(8)[0];expect(engine.getSnapshot()).toEqual(before);expect(path.at(-1)!.x).toBeCloseTo(1705,7);engine.launch();tick(engine,8);expect(engine.getSnapshot().status).toBe('failed');expect(engine.getSnapshot().particles[0].position).toEqual(path.at(-1));
 });
 it('keeps swept body collisions and actual goal capture active outside the visible rectangle',()=>{
  const collision=field();state(collision).sector.bodies=[{id:'outside',position:{x:400,y:500},radius:35,kind:'attractor',strength:0}];collision.launch();tick(collision,2);expect(collision.getSnapshot().status).toBe('failed');expect(collision.getSnapshot().particles[0].position.x).toBeCloseTo(360);expect(remaining(collision)).toBeGreaterThan(0);
  const dock=field();state(dock).sector.checkpoint.position={x:400,y:500};const terminal=dock.predict(2)[0].at(-1);dock.launch();tick(dock,2);expect(dock.getSnapshot().status).toBe('docked');expect(dock.getSnapshot().checkpointCount).toBe(1);expect(dock.getSnapshot().particles[0].position).toEqual(terminal);expect(remaining(dock)).toBeGreaterThan(0);
 });
 it('recognizes a complete visibility pass between fixed-step endpoints and resets its timer',()=>{
  const engine=field();state(engine).sector.checkpoint.position.x=100000;engine.setAim(0,1);engine.setFlightBounds({x:990,y:0,width:12,height:1000});engine.launch();state(engine).particles[0].velocity.x=4200;expect(remaining(engine)).toBe(6);
  for(let step=0;step<26;step++)engine.update(FIXED_STEP);expect(engine.getSnapshot().particles[0].position.x).toBeCloseTo(1010);expect(remaining(engine)).toBeCloseTo(5.999285714285714,8);
  tick(engine,4.8);expect(engine.getSnapshot().status).toBe('flying');tick(engine,1.3);expect(engine.getSnapshot().status).toBe('failed');
 });
});
