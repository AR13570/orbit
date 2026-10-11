import { describe,expect,it } from 'vitest';
import { generateFamilySector,generateGuaranteedFallbackSector,generateSector } from '../../src/game/generator';
import { matchesStructure,STRUCTURES } from '../../src/game/structures';
import { captureChordBend,MIN_CAPTURE_CHORD_BEND,probeFlight } from '../../src/game/challenge';
import { describeComposition } from '../../src/game/composition';
import type { CompositionDescriptor } from '../../src/game/composition';
import type { Sector } from '../../src/game/types';

function shape(sector:Sector):number[]{
 const distances=sector.bodies.flatMap((a,i)=>sector.bodies.slice(i+1).map(b=>Math.hypot(a.position.x-b.position.x,a.position.y-b.position.y))).sort((a,b)=>a-b);
 const scale=Math.hypot(...distances);return distances.map(d=>d/scale);
}

describe('structural level families',()=>{
 it('actually uses at least twenty structures in successive fields of one seed',()=>{
  const families=new Set<string>(),recent:CompositionDescriptor[]=[];let origin={x:120,y:500};
  for(let index=0;index<40;index++){
   const sector=generateSector(42,index,origin,recent);families.add(sector.generation.family);recent.push(describeComposition(sector));if(recent.length>6)recent.shift();origin=sector.checkpoint.position;
  }
  expect(families.size).toBeGreaterThanOrEqual(20);
 });
 it('does not build every field from one dominant circle and small satellites',()=>{
  let balanced=0;const counts=new Set<number>();
  for(let index=0;index<20;index++){
   const sector=generateSector(7,index),radii=sector.bodies.map(b=>b.radius).sort((a,b)=>b-a);counts.add(radii.length);if(radii[0]/radii[1]<1.4)balanced++;
  }
  expect(balanced).toBeGreaterThanOrEqual(14);expect(counts.size).toBeGreaterThanOrEqual(4);
 });
 it.each(STRUCTURES)('preserves $id through meaningful seeded changes and five tolerant docks',(grammar)=>{
  const fields=[0,1,7].map(seed=>generateFamilySector(seed,0,grammar.id));
  expect(new Set(fields.map(s=>JSON.stringify(s.bodies.map(b=>[Math.round(b.position.x/10),Math.round(b.position.y/10),Math.round(b.radius/3),b.kind])))).size).toBe(3);
  for(const field of fields){
   expect(matchesStructure(grammar.id,field.bodies,field.launch,field.checkpoint)).toBe(true);expect(field.generation.validation).toBe(grammar.validation??'geometric');
   for(const [da,dp] of [[0,0],[.025,0],[-.025,0],[0,.025],[0,-.025]]){
    const shot=probeFlight(field,field.solution.angle+da,field.solution.power+dp,true,undefined,true);
    expect(shot.ending).toBe('dock');expect(captureChordBend(shot.path)).toBeGreaterThanOrEqual(MIN_CAPTURE_CHORD_BEND);
   }
  }
 });
 it('does not count rotation, reflection, translation or overall scale as a different structure',()=>{
  const fields=STRUCTURES.map(g=>generateFamilySector(7,0,g.id)),shapes=fields.map(shape);
  for(let i=0;i<fields.length;i++)for(let j=0;j<i;j++)if(shapes[i].length===shapes[j].length){
   expect(Math.hypot(...shapes[i].map((v,k)=>v-shapes[j][k])),`${fields[i].generation.family} versus ${fields[j].generation.family}`).toBeGreaterThan(.025);
  }
 });
 it('keeps actual family diversity and varied geometry through forty forced backups',()=>{
  const families=new Set<string>(),signatures=new Set<string>(),recent:CompositionDescriptor[]=[];
  for(let index=0;index<40;index++){
   const field=generateGuaranteedFallbackSector(42,index,{x:150000,y:-300},recent);families.add(field.generation.family);signatures.add(JSON.stringify(describeComposition(field)));
   expect(field.generation.fallback).toBe(true);expect(recent.some(d=>d.family===field.generation.family)).toBe(false);expect(matchesStructure(field.generation.family,field.bodies,field.launch,field.checkpoint)).toBe(true);
   recent.push(describeComposition(field));if(recent.length>6)recent.shift();
  }
  expect(families.size).toBe(20);expect(signatures.size).toBeGreaterThanOrEqual(30);
 });
 it('retains at least three geometry variants in every family across forced backup runs',()=>{
  const variants=new Map(STRUCTURES.map(g=>[g.id,new Set<string>()]));
  for(const seed of [7,31,42]){
   const recent:CompositionDescriptor[]=[];
   for(let index=0;index<40;index++){
    const s=generateGuaranteedFallbackSector(seed,index,{x:120,y:500},recent);
    variants.get(s.generation.family)!.add(JSON.stringify(s.bodies.map(b=>[Math.round((b.position.x-s.launch.x)/10),Math.round((b.position.y-s.launch.y)/10),Math.round(b.radius/3)])));
    recent.push(describeComposition(s));if(recent.length>6)recent.shift();
   }
  }
  for(const [family,set] of variants)expect(set.size,family).toBeGreaterThanOrEqual(3);
 });
});
