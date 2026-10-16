/** Run with npm run verify:odessey. Pass --write to republish the immutable sources. */
import { writeFileSync } from 'node:fs';
import SOURCES from './odessey-multibend-sources.json';
import type { CertifiedLayout } from '../src/game/certified-layouts';
import { ODESSEY_DIFFICULTIES } from '../src/game/difficulty';
import { matchesStructure } from '../src/game/structures';
import { bodyStrength, distance } from '../src/game/physics';
import { acceptsCoreChallenge, blocksStraightCorridor, captureChordBend, probeFlight } from '../src/game/challenge';
import { analyzeGravityBends } from '../src/game/gravity-bends';
import { criticalGravityBodies, screenGravityShortcuts } from '../src/game/multi-bend-challenge';
import { describeComposition, freshComposition } from '../src/game/composition';

const pools=SOURCES as CertifiedLayout[][];
const evidence=[];
for(const [index,entries] of pools.entries()){
 const difficulty=ODESSEY_DIFFICULTIES[index+1],scale=difficulty.bodyScale;
 if(new Set(entries.map(entry=>entry.family)).size<7)throw new Error('Need seven distinct families for six-level history');
 const descriptors=[];
 for(const entry of entries){
  const layout={launch:{x:0,y:0},checkpoint:{position:{x:entry.goal[0],y:entry.goal[1]},radius:45,gravityScale:scale},bodies:entry.bodies.map(([x,y,radius,kind],id)=>({id:String(id),position:{x,y},radius,kind,strength:bodyStrength(radius),gravityScale:scale}))};
  const fail=(message:string)=>{throw new Error(`Stage ${index+1}, ${entry.family}: ${message}`);};
  if(entry.power<0||entry.power>1)fail('power outside player controls');
  if(!matchesStructure(entry.family,layout.bodies,layout.launch,layout.checkpoint)||!acceptsCoreChallenge(layout,entry))fail('invalid structure or collision evidence');
  if(entry.validation==='geometric'&&!blocksStraightCorridor(layout))fail('straight corridor');
  if(entry.goal[0]<difficulty.minLength||entry.goal[0]>difficulty.maxLength)fail('distance');
  for(const [i,body] of layout.bodies.entries()){
   if(body.radius>104*scale||body.position.x-body.radius<=-100||body.position.x+body.radius>=difficulty.width-100||Math.abs(body.position.y)+body.radius>=difficulty.height/2-5)fail('field bounds');
   if(distance(body.position,layout.launch)-body.radius<65||distance(body.position,layout.checkpoint.position)-body.radius-45<30)fail('endpoint clearance');
   for(const other of layout.bodies.slice(0,i))if(distance(body.position,other.position)-body.radius-other.radius<difficulty.minClearance-1e-8)fail('body clearance');
  }
  const t=difficulty.aimTolerance,bendCounts=[];
  for(const [da,dp] of [[0,0],[t,0],[-t,0],[0,t],[0,-t]]){
   const shot=probeFlight(layout,entry.angle+da,entry.power+dp,true,undefined,true),bends=analyzeGravityBends(layout,shot.path).length;
   if(shot.ending!=='dock'||bends<difficulty.requiredBends||captureChordBend(shot.path)<difficulty.minBend)fail('tolerant route');
   if(shot.path.some(point=>point.x<-95||point.x>difficulty.width-105||Math.abs(point.y)>difficulty.height/2-5))fail('route bounds');
   bendCounts.push(bends);
  }
  const criticalBodies=criticalGravityBodies(layout,entry);
  if(criticalBodies.length<2)fail('fewer than two positive force-removal collisions');
  const screen=screenGravityShortcuts(layout,difficulty.requiredBends);
  if(!screen.passed)fail(`low-bend shortcut ${JSON.stringify(screen.shortcut)}`);
  const descriptor=describeComposition({...layout,generation:{family:entry.family,fallback:true}});
  if(!descriptors.every(previous=>freshComposition(descriptor,[previous])))fail('certificate pairwise freshness');
  descriptors.push(descriptor);
  const result={stage:index+1,family:entry.family,bendCounts,criticalBodies,...screen};
  evidence.push(result);console.log(JSON.stringify(result));
 }
}
if(process.argv.includes('--write'))writeFileSync('src/game/progressive-layouts.ts',`import type { CertifiedLayout } from './certified-layouts';\n\n/** Offline screened courses. Regenerate with npm run verify:odessey -- --write.\n * Runtime permits only exact reflection and translation. */\nexport const PROGRESSIVE_LAYOUTS: readonly (readonly CertifiedLayout[])[] = ${JSON.stringify(pools,null,1)};\n`);
writeFileSync('/private/tmp/orbit-odessey-certificate-verification.json',JSON.stringify({angles:252,powers:41,seconds:22,evidence},null,2));
console.log(`Verified ${evidence.length} courses, ${evidence.length*252*41} finite-grid shots.`);
