import {describe,expect,it} from 'vitest';
import {generateSector} from '../../src/game/generator';
import {probeFlight} from '../../src/game/challenge';
import {analyzeGravityBends} from '../../src/game/gravity-bends';

describe('meaningful successive gravity bends',()=>{
 it('requires three alternating bends around distinct bodies at maximum difficulty',()=>{
  const sector=generateSector(42,14);
  const bends=analyzeGravityBends(sector,sector.solution.path);
  expect(bends.length).toBeGreaterThanOrEqual(3);
  expect(new Set(bends.map(bend=>bend.bodyId)).size).toBe(bends.length);
  for(let index=1;index<bends.length;index++)expect(Math.sign(bends[index].turnRadians)).not.toBe(Math.sign(bends[index-1].turnRadians));
 });
 it('does not count a goal-assisted curve as a body gravity bend',()=>{
  const layout={launch:{x:0,y:0},checkpoint:{position:{x:500,y:150},radius:45},bodies:[]};
  const shot=probeFlight(layout,0,.6,true,undefined,true);
  expect(shot.ending).toBe('dock');
  expect(analyzeGravityBends(layout,shot.path)).toEqual([]);
 });
 it('disables selected body forces while retaining their solid collision surfaces',()=>{
  const layout={launch:{x:0,y:0},checkpoint:{position:{x:1000,y:0},radius:45},bodies:[{id:'gate',position:{x:200,y:0},radius:100,kind:'repellent' as const,strength:0}]};
  expect(probeFlight(layout,0,.6,new Set(['gate'])).ending).toBe('collision');
 });
});
