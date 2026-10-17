import { describe,expect,it } from 'vitest';
import { OrbitEngine } from '../../src/game/engine';
import { stepParticle, ODESSEY_FIXED_STEP, ODESSEY_SPEED_SCALE } from '../../src/game/physics';
import type { Particle,Sector } from '../../src/game/types';

const state=(engine:OrbitEngine)=>(engine as unknown as {state:{sector:Sector;particles:Particle[]}}).state;
function openField():OrbitEngine {
 const engine=new OrbitEngine(7);
 Object.assign(state(engine).sector,{launch:{x:100,y:500},bounds:{x:-10000,y:-10000,width:20000,height:20000},checkpoint:{position:{x:10000,y:10000},radius:45},bodies:[]});
 return engine;
}
describe('Odessey speed with real-time lifecycle',()=>{
 it('travels at the slower speed over the complete steps in a quarter second at full power, matching 1.65 times baseline',()=>{
  const engine=openField();engine.setAim(0,1);engine.launch();
  expect(engine.getSnapshot().particles[0].velocity.x).toBeCloseTo(693);
  engine.update(.25);expect(engine.getSnapshot().particles[0].position.x).toBeCloseTo(271.5,10);expect(engine.getSnapshot().elapsed).toBeCloseTo(49*ODESSEY_FIXED_STEP,10);
 });
 it('preserves the baseline curved trajectory at 1.65 times playback speed',()=>{
  const engine=openField();state(engine).sector.bodies=[{id:'well',kind:'attractor',position:{x:450,y:240},radius:90,strength:0}];
  engine.setAim(0,.6);engine.launch();let reference={position:{x:100,y:500},velocity:{x:252,y:0}};
  for(let step=0;step<180;step++){
   reference=stepParticle(reference.position,reference.velocity,state(engine).sector.bodies);
   engine.update(ODESSEY_FIXED_STEP);
  }
  const actual=engine.getSnapshot().particles[0];expect(engine.getSnapshot().status).toBe('flying');
  expect(actual.position.x).toBeCloseTo(reference.position.x,8);expect(actual.position.y).toBeCloseTo(reference.position.y,8);
  expect(actual.velocity.x).toBeCloseTo(reference.velocity.x*ODESSEY_SPEED_SCALE,8);expect(actual.velocity.y).toBeCloseTo(reference.velocity.y*ODESSEY_SPEED_SCALE,8);
 });
 it('grants five real seconds outside and permits retry afterward',()=>{
  const engine=openField();engine.setFlightBounds({x:-5000,y:-5000,width:100,height:100});engine.setAim(0,1);engine.launch();
  for(let step=0;step<Math.round(5/ODESSEY_FIXED_STEP)-1;step++)engine.update(ODESSEY_FIXED_STEP);
  expect(engine.getSnapshot().status).toBe('flying');expect(engine.getSnapshot().particles[0].offscreenRemaining).toBeCloseTo(ODESSEY_FIXED_STEP,10);
  engine.update(ODESSEY_FIXED_STEP);expect(engine.getSnapshot().status).toBe('failed');expect(engine.getSnapshot().particles[0].position.x).toBeCloseTo(3565,8);
  engine.retry();expect(engine.getSnapshot().status).toBe('aiming');
 });
});
