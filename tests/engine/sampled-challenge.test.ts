import { describe,expect,it } from 'vitest';
import { generateFamilySector,generateGuaranteedFallbackSector } from '../../src/game/generator';
import { acceptsSampledCurvature,captureChordBend,probeFlight } from '../../src/game/challenge';
import { describeComposition } from '../../src/game/composition';
import type { CompositionDescriptor } from '../../src/game/composition';

describe('force-driven structure screening',()=>{
 it.each([['three-step-slalom',.95,-.375],['stepped-shelves',1,-.275]] as const)('rejects reproduced intermediate-angle bypasses in %s',(family,power,offset)=>{
  const s=generateFamilySector(42,0,family),bearing=Math.atan2(s.checkpoint.position.y-s.launch.y,s.checkpoint.position.x-s.launch.x),shot=probeFlight(s,bearing+offset,power,true,undefined,true);
  expect(shot.ending!=='dock'||captureChordBend(shot.path)>=70).toBe(true);
 });
 it('rejects the reproduced intermediate-angle bypass in a varied shelf backup',()=>{
  const recent:CompositionDescriptor[]=[];
  for(let index=0;index<=6;index++){
   const s=generateGuaranteedFallbackSector(31,index,{x:120,y:500},recent);
   if(index===6){const bearing=Math.atan2(s.checkpoint.position.y-s.launch.y,s.checkpoint.position.x-s.launch.x),shot=probeFlight(s,bearing-.325,1,true,undefined,true);expect(shot.ending!=='dock'||captureChordBend(shot.path)>=70).toBe(true);}
   recent.push(describeComposition(s));if(recent.length>6)recent.shift();
  }
 });
 it('rejects goal autopilot at weak power and rejects an exhausted sample budget',()=>{
  const layout={launch:{x:0,y:0},checkpoint:{position:{x:400,y:0},radius:45},bodies:[]};
  expect(acceptsSampledCurvature(layout)).toBe(false);expect(acceptsSampledCurvature(layout,{remaining:0})).toBe(false);
 });
});
