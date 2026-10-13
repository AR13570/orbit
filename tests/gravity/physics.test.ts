import { describe,expect,it } from 'vitest';
import { gravityForceAt,gravityLaunchSpeed } from '../../src/gravity/physics';
import { launchSpeed } from '../../src/game/physics';

describe('Gravity speed scaling',()=>{
 it('launches at 1.8 times baseline without multiplying a scaled shared helper twice',()=>{
  expect(launchSpeed(1)).toBe(420);
  expect(gravityLaunchSpeed(.5)).toBe(378);expect(gravityLaunchSpeed(1)).toBe(756);
  expect(gravityLaunchSpeed(0)).toBe(0);expect(gravityLaunchSpeed(2)).toBe(756);
 });
 it('scales acceleration by 3.24 so increasing launch speed preserves orbit shapes',()=>{
  const body={id:'well',kind:'attractor' as const,position:{x:100,y:0},radius:20,strength:1000000};
  expect(gravityForceAt({x:0,y:0},[body]).x).toBeCloseTo(279.3103448275862,10);
  expect(gravityForceAt({x:0,y:0},[{...body,kind:'repellent'}]).x).toBeCloseTo(-279.3103448275862,10);
 });
});
