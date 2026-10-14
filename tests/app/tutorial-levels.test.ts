import { describe,expect,it } from 'vitest';
import { ZEN_TUTORIAL_LEVELS,traceZenTutorial } from '../../src/tutorial/levels';
import { bodyStrength,SHIP_RADIUS,ZEN_FIXED_STEP } from '../../src/game/physics';
import { OrbitEngine } from '../../src/game/engine';
import type { Sector } from '../../src/game/types';

describe('authored Zen tutorial levels',()=>{
 it('provides exactly two deterministic minimal fields',()=>{
  expect(ZEN_TUTORIAL_LEVELS).toHaveLength(2);
  expect(ZEN_TUTORIAL_LEVELS.map(level=>level.id)).toEqual(['curve','split']);
 });
 it('keeps the first goal at least twelve world units beyond every full outer wave envelope',()=>{
  const level=ZEN_TUTORIAL_LEVELS[0];
  for(const body of level.bodies){
   const distance=Math.hypot(body.position.x-level.goal.position.x,body.position.y-level.goal.position.y);
   expect(distance-(body.radius+140)-level.goal.radius,body.id).toBeGreaterThanOrEqual(12);
  }
 });
 it('keeps the split goal outside every full outer wave envelope',()=>{
  const level=ZEN_TUTORIAL_LEVELS[1];
  for(const body of level.bodies){
   const distance=Math.hypot(body.position.x-level.goal.position.x,body.position.y-level.goal.position.y);
   expect(distance-(body.radius+140)-level.goal.radius,body.id).toBeGreaterThanOrEqual(0);
  }
 });
 it('captures the first generous goal with a visibly curved single shot',()=>{
  const level=ZEN_TUTORIAL_LEVELS[0],witness=traceZenTutorial(level);
  expect(witness.ending).toBe('dock');expect(witness.capturedBy).toBe(0);
  const path=witness.paths[0].points,a=path[0],b=path.at(-1)!,dx=b.x-a.x,dy=b.y-a.y;
  expect(Math.max(...path.map(p=>Math.abs((p.x-a.x)*dy-(p.y-a.y)*dx)/Math.hypot(dx,dy)))).toBeGreaterThan(30);
  for(const [da,dp] of [[.05,0],[-.05,0],[0,.05],[0,-.05]])expect(traceZenTutorial(level,{aim:{angle:level.aim.angle+da,power:level.aim.power+dp}}).ending).toBe('dock');
 });
 it('needs a side projectile for the second suggested shot',()=>{
  const level=ZEN_TUTORIAL_LEVELS[1];
  expect(traceZenTutorial(level,{splitAt:null}).ending).toBe('collision');
  const witness=traceZenTutorial(level);expect(witness.ending).toBe('dock');expect(witness.capturedBy).toBe(2);
 });
 it('captures throughout a humane split window and near the guided aim',()=>{
  const level=ZEN_TUTORIAL_LEVELS[1];expect(level.splitWindow).toEqual([.1,.35]);
  for(let i=0;i<=10;i++){const w=traceZenTutorial(level,{splitAt:.1+i*.025});expect(w.ending).toBe('dock');expect(w.capturedBy).toBe(2);}
  for(const da of [-.005,0,.005])for(const dp of [-.005,0,.005]){
   const aim={angle:level.aim.angle+da,power:level.aim.power+dp};
   expect(traceZenTutorial(level,{aim,splitAt:null}).ending).toBe('collision');
   expect(traceZenTutorial(level,{aim}).ending).toBe('dock');
  }
 });
 it('blocks straight low and high power bypasses with a real solid',()=>{
  const level=ZEN_TUTORIAL_LEVELS[1];
  for(const power of [.25,.35,.55,.7,1])expect(traceZenTutorial(level,{aim:{angle:0,power},splitAt:null}).ending).toBe('collision');
 });
 it('makes the center impact and the clear side route physically distinct',()=>{
  const level=ZEN_TUTORIAL_LEVELS[1],w=traceZenTutorial(level),fork=level.bodies[1],center=w.paths[0].points.at(-1)!;
  expect(Math.hypot(center.x-fork.position.x,center.y-fork.position.y)).toBeCloseTo(fork.radius+SHIP_RADIUS,8);
  const side=w.paths[w.capturedBy!].points;
  expect(Math.max(...side.map(p=>p.y))-center.y).toBeGreaterThan(8);
  expect(Math.min(...side.map(p=>Math.hypot(p.x-fork.position.x,p.y-fork.position.y)))).toBeGreaterThan(fork.radius+SHIP_RADIUS);
  expect(Math.hypot(w.splitPoint!.x-fork.position.x,w.splitPoint!.y-fork.position.y)).toBeGreaterThan(fork.radius+160);
 });
 it('exports deterministic on-screen paths and the actual physical split point without mutation',()=>{
  for(const level of ZEN_TUTORIAL_LEVELS){
   const before=structuredClone(level),w=traceZenTutorial(level),bounds=level.bounds;
   expect(level.solutionPaths).toEqual(w.paths.map(p=>p.points));expect(level.tapPoint).toEqual(w.splitPoint);expect(level).toEqual(before);expect(w.time).toBeLessThan(4);
   for(const body of level.bodies)expect(body.strength).toBe(bodyStrength(body.radius));
   for(const path of level.solutionPaths)for(const p of path){expect(p.x).toBeGreaterThanOrEqual(bounds.x+SHIP_RADIUS);expect(p.x).toBeLessThanOrEqual(bounds.x+bounds.width-SHIP_RADIUS);expect(p.y).toBeGreaterThanOrEqual(bounds.y+SHIP_RADIUS);expect(p.y).toBeLessThanOrEqual(bounds.y+bounds.height-SHIP_RADIUS);}
  }
  const level=ZEN_TUTORIAL_LEVELS[1];expect(level.solutionPaths[1][0]).toEqual(level.tapPoint);expect(level.solutionPaths[2][0]).toEqual(level.tapPoint);
 });
 it('replays successful witnesses and the center-only failure through the real Zen engine',()=>{
  for(const [index,splitAt,halfSteps] of [[0,null,false],[1,null,false],[1,.1,false],[1,.25,false],[1,.35,false],[0,null,true],[1,.25,true]] as const){
   const level=ZEN_TUTORIAL_LEVELS[index],engine=new OrbitEngine(7),state=(engine as unknown as {state:{sector:Sector}}).state;
   Object.assign(state.sector,{launch:structuredClone(level.launch),checkpoint:structuredClone(level.goal),bodies:structuredClone(level.bodies),bounds:structuredClone(level.bounds)});
   engine.setAim(level.aim.angle,level.aim.power);engine.setShotCount(splitAt===null?1:3);engine.launch();let branched=false;
   for(let tick=0;tick<864;tick++){
    if(splitAt!==null&&!branched&&tick*ZEN_FIXED_STEP+1e-12>=splitAt){engine.branch();branched=true;}
    if(halfSteps){engine.update(ZEN_FIXED_STEP/2);engine.update(ZEN_FIXED_STEP/2);}else engine.update(ZEN_FIXED_STEP);
    if(engine.getSnapshot().status!=='flying')break;
   }
   const w=traceZenTutorial(level,{splitAt}),snapshot=engine.getSnapshot();expect(snapshot.status).toBe(w.ending==='dock'?'docked':'failed');
   for(const path of w.paths){const p=snapshot.particles.find(p=>p.id===path.id)!,end=path.points.at(-1)!;expect(p.position.x).toBeCloseTo(end.x,8);expect(p.position.y).toBeCloseTo(end.y,8);}
  }
 });
 it('prioritizes a solid over a goal at the same swept contact',()=>{
  const base=ZEN_TUTORIAL_LEVELS[0],radius=base.goal.radius,level={...base,bodies:[{id:'solid',kind:'attractor' as const,position:{...base.goal.position},radius,strength:bodyStrength(radius)}]};
  expect(traceZenTutorial(level,{aim:{angle:0,power:.5}}).ending).toBe('collision');
 });
});
