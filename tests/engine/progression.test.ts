import { describe, expect, it } from 'vitest';
import { OrbitEngine } from '../../src/game/engine';
import { generateSector, generateGuaranteedFallbackSector } from '../../src/game/generator';
import { ZEN_DIFFICULTIES, zenDifficulty } from '../../src/game/difficulty';
import { analyzeGravityBends } from '../../src/game/gravity-bends';
import { criticalGravityBodies, screenGravityShortcuts } from '../../src/game/multi-bend-challenge';
import { STRUCTURES } from '../../src/game/structures';
import { matchesStructure } from '../../src/game/structures';
import { PROGRESSIVE_LAYOUTS } from '../../src/game/progressive-layouts';
import { acceptsChallenge, captureChordBend, probeFlight } from '../../src/game/challenge';
import { bodyStrength, distance } from '../../src/game/physics';
import { describeComposition, freshComposition } from '../../src/game/composition';

describe('Zen difficulty progression', () => {
  it('keeps every longer backup playable, spaced and pairwise fresh at its difficulty', () => {
    PROGRESSIVE_LAYOUTS.forEach((entries, stage) => {
      expect(new Set(entries.map(entry=>entry.family)).size).toBeGreaterThanOrEqual(7);
      const descriptors = entries.map(entry => {
        const layout = {launch:{x:0,y:0}, checkpoint:{position:{x:entry.goal[0],y:entry.goal[1]},radius:45,gravityScale:ZEN_DIFFICULTIES[stage+1].bodyScale}, bodies:entry.bodies.map(([x,y,radius,kind],id)=>({id:String(id),position:{x,y},radius,kind,strength:bodyStrength(radius),gravityScale:ZEN_DIFFICULTIES[stage+1].bodyScale}))};
        expect(matchesStructure(entry.family, layout.bodies, layout.launch, layout.checkpoint), entry.family).toBe(true);
        for (const [i, body] of layout.bodies.entries()) {
          expect(Math.abs(body.position.y) + body.radius).toBeLessThan([670,895,1120][stage]);
          expect(body.position.x + body.radius).toBeLessThan([2000,3000,4100][stage]);
          expect(distance(body.position, layout.launch) - body.radius).toBeGreaterThanOrEqual(65);
          expect(distance(body.position, layout.checkpoint.position) - body.radius - 45).toBeGreaterThanOrEqual(30);
          for (const other of layout.bodies.slice(0, i)) expect(distance(body.position, other.position) - body.radius - other.radius).toBeGreaterThanOrEqual(ZEN_DIFFICULTIES[stage+1].minClearance - 1e-8);
        }
        const tolerance=[.025,.02,.0125][stage];
        expect(acceptsChallenge(layout, entry, undefined, entry.validation,tolerance), entry.family).toBe(true);
        expect(criticalGravityBodies(layout,entry).length).toBeGreaterThanOrEqual(2);
        for (const [da, dp] of [[0,0],[tolerance,0],[-tolerance,0],[0,tolerance],[0,-tolerance]]) {
          const shot = probeFlight(layout, entry.angle + da, entry.power + dp, true, undefined, true);
          expect(shot.ending).toBe('dock');
          expect(captureChordBend(shot.path)).toBeGreaterThanOrEqual(80 + stage * 10);
          expect(analyzeGravityBends(layout,shot.path).length).toBeGreaterThanOrEqual(ZEN_DIFFICULTIES[stage+1].requiredBends);
        }
        return describeComposition({...layout,generation:{family:entry.family,fallback:true}});
      });
      descriptors.forEach((descriptor,i) => descriptors.forEach((other,j) => {if(i!==j)expect(freshComposition(descriptor,[other])).toBe(true);}));
    });
  });
  it.each([generateSector, generateGuaranteedFallbackSector])('extends maximum difficulty fields even through fallback generation', generate => {
    const field = generate(42, 14);
    const coreCount = STRUCTURES.find(grammar => grammar.id === field.generation.family)!.slots.length;
    expect(field.checkpoint.position.x - field.launch.x).toBeGreaterThanOrEqual(2600);
    expect(field.bodies.length).toBe(coreCount + 3);
    expect(field.bounds.width).toBeGreaterThanOrEqual(4200);
  });

  it.each([7, 31, 42])('plays fifteen progressively longer levels for seed %i', seed => {
    const engine = new OrbitEngine(seed);
    const lengths: number[] = [];
    for (let index = 0; index < 15; index++) {
      const snapshot = engine.getSnapshot(), field = snapshot.sector;
      lengths.push(field.checkpoint.position.x - field.launch.x);
      const coreCount = STRUCTURES.find(grammar => grammar.id === field.generation.family)!.slots.length;
      const additions = zenDifficulty(index).extraBodies;
      expect(field.bodies.length, `level ${index + 1}`).toBe(coreCount + additions);
      if(index>=4){expect(analyzeGravityBends(field,field.solution.path).length).toBeGreaterThanOrEqual(zenDifficulty(index).requiredBends);expect(criticalGravityBodies(field,field.solution).length).toBeGreaterThanOrEqual(2);}
      engine.setAim(field.solution.angle, field.solution.power);
      const prediction = engine.predict(field.solution.flightSeconds + .05)[0];
      expect(prediction.at(-1)).toEqual(field.solution.path.at(-1));
      engine.launch();
      for (let frame = 0; frame < 1200 && engine.getSnapshot().status === 'flying'; frame++) engine.update(1 / 60);
      expect(engine.getSnapshot().status, `seed ${seed}, level ${index + 1}`).toBe('docked');
      expect(engine.getSnapshot().checkpointCount).toBe(index + 1);
      engine.advance();
    }
    expect(Math.min(...lengths.slice(4, 9))).toBeGreaterThan(Math.max(...lengths.slice(0, 4)));
    expect(Math.min(...lengths.slice(9, 14))).toBeGreaterThan(Math.max(...lengths.slice(4, 9)));
    expect(lengths[14]).toBeGreaterThan(Math.max(...lengths.slice(9, 14)));
    engine.restart(seed);
    expect(engine.getSnapshot().sector.checkpoint.position.x - engine.getSnapshot().sector.launch.x).toBe(lengths[0]);
  });

  it('caps length and obstacle requirements after level fifteen', () => {
    for (const index of [14, 15, 1000000]) {
      const field = generateSector(7, index);
      const coreCount = STRUCTURES.find(grammar => grammar.id === field.generation.family)!.slots.length;
      expect(field.checkpoint.position.x - field.launch.x).toBeGreaterThanOrEqual(2600);
      expect(field.checkpoint.position.x - field.launch.x).toBeLessThanOrEqual(3000);
      expect(field.bodies.length).toBe(coreCount + 3);
    }
  });
});

for(const [stage,entries] of PROGRESSIVE_LAYOUTS.entries())for(const entry of entries)it(`screens all angles and powers for stage ${stage+1} ${entry.family}`,()=>{
 const scale=ZEN_DIFFICULTIES[stage+1].bodyScale;
 const layout={launch:{x:0,y:0},checkpoint:{position:{x:entry.goal[0],y:entry.goal[1]},radius:45,gravityScale:scale},bodies:entry.bodies.map(([x,y,radius,kind],id)=>({id:String(id),position:{x,y},radius,kind,strength:bodyStrength(radius),gravityScale:scale}))};
 expect(screenGravityShortcuts(layout,ZEN_DIFFICULTIES[stage+1].requiredBends)).toMatchObject({passed:true,shortcut:null});
},30000);
