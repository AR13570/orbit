import { describe,expect,it } from 'vitest';
import { OrbitEngine } from '../../src/game/engine';
import { fitFieldCamera,visibleWorldBounds } from '../../src/render/coordinates';
import { generateSector } from '../../src/game/generator';
import { acceptsChallenge,blocksStraightCorridor,probeFlight } from '../../src/game/challenge';
import { bodyStrength,FIXED_STEP,SHIP_RADIUS } from '../../src/game/physics';
import { CERTIFIED_LAYOUTS } from '../../src/game/certified-layouts';
import type { Sector } from '../../src/game/types';
function excursion(sector:Sector,path:readonly {x:number;y:number}[]):number {
 const dx=sector.checkpoint.position.x-sector.launch.x,dy=sector.checkpoint.position.y-sector.launch.y,length=Math.hypot(dx,dy);
 return Math.max(...path.map(point=>Math.abs((point.x-sector.launch.x)*dy-(point.y-sector.launch.y)*dx)/length));
}
function chordBend(path:readonly {x:number;y:number}[]):number {
 const from=path[0],to=path.at(-1)!,dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);
 return Math.max(...path.map(point=>Math.abs((point.x-from.x)*dy-(point.y-from.y)*dx)/length));
}
describe('meaningful curved transfers',()=>{
 it('closes reproduced near-straight captures outside the old cone and at ordinary power',()=>{
  for(const [seed,power,offset] of [[42,.975,-.075],[42,.4,-.325],[1,.975,-.1625],[7,.95,.225],[19,.65,-.2625],[31,1,-.1625]]){
   const sector=generateSector(seed),bearing=Math.atan2(sector.checkpoint.position.y-sector.launch.y,sector.checkpoint.position.x-sector.launch.x),shot=probeFlight(sector,bearing+offset,power,true,undefined,true);
   expect(shot.ending!=='dock'||excursion(sector,shot.path)>=100,`seed${seed},power${power},offset${offset},bend${excursion(sector,shot.path)}`).toBe(true);
  }
 });
 it('physically blocks the full near-straight corridor, independent of discrete launch samples',()=>{
  for(const seed of Array.from({length:40},(_,index)=>index)){
   const sector=generateSector(seed),dx=sector.checkpoint.position.x-sector.launch.x,dy=sector.checkpoint.position.y-sector.launch.y,length=Math.hypot(dx,dy);
   const covered=sector.bodies.some(body=>{
    const bx=body.position.x-sector.launch.x,by=body.position.y-sector.launch.y,along=(bx*dx+by*dy)/length,lateral=Math.abs(bx*dy-by*dx)/length;
    const aperture=sector.checkpoint.radius+SHIP_RADIUS,cone=Math.asin(aperture/length),worstOffset=lateral*Math.cos(cone)+along*Math.sin(cone);
    return along>body.radius+SHIP_RADIUS&&along<length-aperture&&body.radius+SHIP_RADIUS-lateral>=100&&body.radius+SHIP_RADIUS-worstOffset>=80;
   });
   expect(covered,`seed${seed}`).toBe(true);expect(excursion(sector,sector.solution.path)).toBeGreaterThanOrEqual(100);expect(chordBend(sector.solution.path)).toBeGreaterThanOrEqual(80);
  }
 });
 it('measures the actual swept capture contact rather than the preceding preview sample',()=>{
  const layout={launch:{x:0,y:0},checkpoint:{position:{x:400,y:0},radius:45},bodies:[]},shot=probeFlight(layout,0,.6,true,undefined,true);
  expect(shot.ending).toBe('dock');expect(Math.hypot(shot.path.at(-1)!.x-400,shot.path.at(-1)!.y)).toBeCloseTo(50,8);
 });
 it('includes the entire capture aperture when certifying bend and rechecks every emergency layout',()=>{
  const layout={launch:{x:0,y:0},checkpoint:{position:{x:700,y:0},radius:45},bodies:[{id:'barrier',position:{x:500,y:0},radius:105,kind:'attractor' as const,strength:0}]};
  expect(blocksStraightCorridor(layout)).toBe(false);layout.bodies[0].radius=125;expect(blocksStraightCorridor(layout)).toBe(true);
  for(const entry of CERTIFIED_LAYOUTS){
   const certificate={launch:{x:0,y:0},checkpoint:{position:{x:entry.goal[0],y:entry.goal[1]},radius:45},bodies:entry.bodies.map(([x,y,radius,kind],id)=>({id:String(id),position:{x,y},radius,kind,strength:bodyStrength(radius)}))};
   expect(blocksStraightCorridor(certificate)).toBe(true);expect(acceptsChallenge(certificate,entry)).toBe(true);
  }
 });
 it('rejects near-straight captures across a dense independent range of powers and angles',()=>{
  for(const [seed,index] of [[42,0],[42,1],[42,2],[7,6],[19,16],[31,2]]){
   const sector=generateSector(seed,index,{x:150000,y:-300}),bearing=Math.atan2(sector.checkpoint.position.y-sector.launch.y,sector.checkpoint.position.x-sector.launch.x);
   for(let p=4;p<=20;p++)for(let a=-24;a<=24;a++){
    const shot=probeFlight(sector,bearing+a*.025,p*.05,true,undefined,true);
    if(shot.ending==='dock'){expect(excursion(sector,shot.path)).toBeGreaterThanOrEqual(100);expect(chordBend(shot.path)).toBeGreaterThanOrEqual(80);}
   }
  }
 });
 it('keeps tolerant curved solutions playable with desktop, portrait and landscape camera bounds',()=>{
  for(const seed of [7,42])for(const [width,height] of [[1440,900],[390,844],[844,390]])for(const [da,dp] of [[0,0],[.025,0],[-.025,0],[0,.025],[0,-.025]]){
   const engine=new OrbitEngine(seed),sector=engine.getSnapshot().sector;
   engine.setFlightBounds(visibleWorldBounds(fitFieldCamera(sector.bounds,sector.launch,width,height),width,height));engine.setAim(sector.solution.angle+da,sector.solution.power+dp);engine.launch();
   const live=(engine as unknown as {state:{status:string;particles:{position:{x:number;y:number}}[]}}).state;
   for(let step=0;step<720&&live.status==='flying';step++){
    engine.setFlightBounds(visibleWorldBounds(fitFieldCamera(sector.bounds,sector.launch,width,height,live.particles[0].position.x),width,height));engine.update(FIXED_STEP);
   }
   expect(engine.getSnapshot().status,`seed${seed},viewport${width}x${height},neighbor${da}:${dp}`).toBe('docked');expect(engine.getSnapshot().checkpointCount).toBe(1);
  }
 });

});
