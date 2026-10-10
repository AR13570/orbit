import { describe,expect,it } from 'vitest';
import { acceptsChallenge,probeFlight } from '../../src/game/challenge';
import type { ChallengeLayout } from '../../src/game/challenge';

describe('honest difficulty evidence',()=>{
 it('continues outside canonical bounds to a real solid collision',()=>{
  const layout:ChallengeLayout={launch:{x:0,y:0},checkpoint:{position:{x:3000,y:0},radius:45},bodies:[{id:'outside',position:{x:1500,y:0},radius:55,kind:'attractor',strength:0}]};
  const result=probeFlight(layout,0,.5,true,undefined,true);expect(result.ending).toBe('collision');expect(result.path.at(-1)!.x).toBeGreaterThan(1250);
 });
 it('never treats a bounded unresolved shot or depleted work budget as difficulty',()=>{
  const layout:ChallengeLayout={launch:{x:0,y:0},checkpoint:{position:{x:10000,y:0},radius:45},bodies:[]};
  expect(probeFlight(layout,0,.5).ending).toBe('unresolved');expect(acceptsChallenge(layout,{angle:0,power:.5})).toBe(false);
  expect(probeFlight(layout,0,.5,true,{remaining:0}).ending).toBe('unresolved');expect(acceptsChallenge(layout,{angle:0,power:.5},{remaining:0})).toBe(false);
 });
 it('retains original solid circles when body forces are disabled and prioritizes their contact',()=>{
  const layout:ChallengeLayout={launch:{x:0,y:0},checkpoint:{position:{x:400,y:0},radius:45},bodies:[{id:'solid',position:{x:200,y:0},radius:55,kind:'repellent',strength:0}]};
  expect(probeFlight(layout,0,.75,false).ending).toBe('collision');
 });
});
