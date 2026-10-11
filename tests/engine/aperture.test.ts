import { describe,expect,it } from 'vitest';
import { blocksStraightCorridor } from '../../src/game/challenge';
import type { ChallengeLayout } from '../../src/game/challenge';
function distributed():ChallengeLayout{return {launch:{x:0,y:0},checkpoint:{position:{x:750,y:0},radius:45},bodies:[{id:'first',position:{x:260,y:-25},radius:95,kind:'attractor',strength:0},{id:'second',position:{x:520,y:35},radius:100,kind:'attractor',strength:0}]};}
describe('distributed full-aperture bend certificate',()=>{
 it('certifies the union when neither individual obstacle covers the capture aperture',()=>{
  const layout=distributed();expect(blocksStraightCorridor(layout)).toBe(true);
  for(const body of layout.bodies)expect(blocksStraightCorridor({...layout,bodies:[body]})).toBe(false);
 });
 it('rejects a genuine gap at a capture-aperture edge',()=>{
  const layout:ChallengeLayout={launch:{x:0,y:0},checkpoint:{position:{x:750,y:0},radius:45},bodies:[{id:'tangent',position:{x:300,y:0},radius:85,kind:'attractor',strength:0}]};
  expect(blocksStraightCorridor(layout)).toBe(true);layout.bodies[0].radius-=1e-10;expect(blocksStraightCorridor(layout)).toBe(false);
 });
 it('rejects a tiny internal gap between two otherwise covering angular intervals',()=>{
  const half=Math.asin(20/300);
  const layout=(delta:number):ChallengeLayout=>({launch:{x:0,y:0},checkpoint:{position:{x:750,y:0},radius:45},bodies:[-1,1].map((sign,id)=>({id:String(id),position:{x:300*Math.cos(half+delta),y:sign*300*Math.sin(half+delta)},radius:85,kind:'attractor',strength:0}))});
  expect(blocksStraightCorridor(layout(-1e-9))).toBe(true);
  expect(blocksStraightCorridor(layout(1e-9))).toBe(false);
  for(const body of layout(-1e-9).bodies)expect(blocksStraightCorridor({...layout(-1e-9),bodies:[body]})).toBe(false);
 });
 it('excludes a blocker inside or behind the capture aperture',()=>{
  const layout=distributed();layout.bodies[1].position={x:710,y:0};expect(blocksStraightCorridor(layout)).toBe(false);layout.bodies[1].position={x:900,y:0};expect(blocksStraightCorridor(layout)).toBe(false);
 });
 it('rejects a launch already inside a solid even when other shadows cover the aperture',()=>{
  const original=distributed(),layout:ChallengeLayout={...original,bodies:[...original.bodies,{id:'invalid-launch',position:{x:0,y:0},radius:20,kind:'repellent',strength:0}]};expect(blocksStraightCorridor(layout)).toBe(false);
 });
 it('preserves the same coverage under translation and reflection',()=>{
  const layout=distributed(),translated={launch:{x:150000,y:-300},checkpoint:{position:{x:150750,y:-300},radius:45},bodies:layout.bodies.map(b=>({...b,position:{x:150000+b.position.x,y:-300-b.position.y}}))};expect(blocksStraightCorridor(translated)).toBe(true);
 });
});
