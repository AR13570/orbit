import type { Body, ChallengeValidation, Checkpoint, SectorFamily, Vec2 } from './types';
export type WellRole='pull'|'push'|'mixed';
export type StructureSlot=readonly [x:number,y:number,radius:number,role:WellRole,group:number];
export interface StructureGrammar { id:SectorFamily; title:string; topology:string; goalOffset?:number; referenceGoalX?:number; validation?:ChallengeValidation; slots:readonly StructureSlot[] }
/** Coordinate rules describe group topology; runtime varies group spacing, mass and polarity. */
export const STRUCTURES:readonly StructureGrammar[]=[
{"id":"staggered-binary","title":"Staggered binary bend","topology":"Two offset masses with separate exit guards","slots":[[260,-25,85,"pull",0],[520,35,95,"pull",1],[730,-260,65,"mixed",2],[730,260,65,"mixed",2]]},
{"id":"three-step-slalom","title":"Three-step slalom","topology":"Three paired gates with alternating opening centers and an empty passage","slots":[[200,-270,60,"mixed",0],[200,60,60,"mixed",0],[430,-60,60,"mixed",1],[430,270,60,"mixed",1],[660,-270,60,"mixed",2],[660,60,60,"mixed",2]],"validation":"sampled","goalOffset":200,"referenceGoalX":820},
{"id":"twin-well-entrance","title":"Twin-well entrance","topology":"A paired entrance precedes a separate turning mass","slots":[[220,-220,85,"mixed",0],[220,20,95,"pull",0],[580,-35,100,"pull",1],[500,300,75,"mixed",2]]},
{"id":"forked-approach","title":"Forked approach","topology":"An asymmetric three-body fork opens into an exit bank","slots":[[190,15,75,"pull",0],[430,-30,85,"pull",1],[180,-240,65,"mixed",0],[640,250,80,"mixed",2],[790,-250,65,"mixed",2]]},
{"id":"split-exit","title":"Split exit","topology":"One early bend feeds two comparable exit wells","slots":[[260,0,85,"pull",0],[550,-210,80,"mixed",1],[550,210,80,"mixed",1],[810,-280,65,"mixed",2]]},
{"id":"alternating-corridor","title":"Alternating corridor","topology":"Offset chokes and alternating side banks","slots":[[180,0,85,"pull",0],[440,130,90,"mixed",1],[670,-110,85,"mixed",2],[180,-270,70,"mixed",0],[460,-250,75,"mixed",1],[850,230,65,"mixed",2]]},
{"id":"diagonal-ladder","title":"Diagonal ladder","topology":"Uneven rungs form a rising route across the field","slots":[[180,-190,75,"mixed",0],[360,0,100,"pull",1],[600,210,95,"mixed",2],[840,310,60,"mixed",3],[820,-230,70,"mixed",3]],"goalOffset":180},
{"id":"crescent-basin","title":"Crescent basin","topology":"A three-mass crescent wraps a separate inner well","slots":[[360,0,90,"pull",1],[180,-210,75,"mixed",0],[440,-290,85,"mixed",1],[720,-210,70,"mixed",2],[760,260,65,"mixed",2]]},
{"id":"horseshoe-pocket","title":"Horseshoe goal pocket","topology":"A split bend enters a goal surrounded on three sides","slots":[[260,0,95,"pull",0],[700,-180,85,"mixed",1],[940,0,85,"mixed",2],[700,180,85,"mixed",1]],"goalOffset":180},
{"id":"unequal-binary","title":"Unequal binary","topology":"A smaller entrance mass and larger offset late mass","slots":[[230,0,85,"pull",0],[690,-230,104,"mixed",1],[440,280,65,"mixed",2],[880,190,55,"mixed",2]],"goalOffset":180},
{"id":"separated-clusters","title":"Separated clusters","topology":"Two compact four-body diamond islands separated by an empty slab","slots":[[220,-290,55,"mixed",0],[80,-150,55,"mixed",0],[360,-150,55,"mixed",0],[220,-10,55,"mixed",0],[780,40,55,"mixed",1],[640,180,55,"mixed",1],[920,180,55,"mixed",1],[780,320,55,"mixed",1]],"validation":"sampled","goalOffset":200,"referenceGoalX":820},
{"id":"opposing-banks","title":"Opposing banks","topology":"Two long banks constrain a central crossing","slots":[[190,-220,70,"push",0],[420,-60,80,"push",0],[650,130,80,"pull",0],[190,5,85,"pull",1],[420,175,75,"mixed",1],[650,350,65,"push",1]],"goalOffset":180},
{"id":"outer-hairpin","title":"Outer hairpin","topology":"A heavy outside wall forces a wide return around two chokes","slots":[[220,0,90,"pull",0],[450,-210,100,"mixed",1],[740,-280,90,"mixed",1],[700,220,85,"mixed",2],[930,80,60,"mixed",2]]},
{"id":"offset-paired-gates","title":"Offset paired gates","topology":"Two shifted gate openings followed by an outboard guard","slots":[[210,-240,85,"mixed",0],[210,15,95,"pull",0],[570,-35,100,"pull",1],[570,240,90,"mixed",1],[880,-200,70,"mixed",2]],"goalOffset":180},
{"id":"asymmetric-fan","title":"Asymmetric fan","topology":"A sparse side faces a broad three-well fan","slots":[[170,-220,70,"mixed",0],[320,0,100,"pull",0],[430,250,90,"mixed",1],[710,-190,90,"mixed",2],[880,260,70,"mixed",2]]},
{"id":"stepped-shelves","title":"Stepped shelves","topology":"Three horizontal pairs progress diagonally across an empty staircase","slots":[[150,-300,60,"mixed",0],[360,-300,60,"mixed",0],[380,-30,60,"mixed",1],[590,-30,60,"mixed",1],[610,240,60,"mixed",2],[820,240,60,"mixed",2]],"validation":"sampled","goalOffset":200,"referenceGoalX":800},
{"id":"triangular-islands","title":"Triangular islands","topology":"Two three-well cells with different orientations","slots":[[170,-170,75,"mixed",0],[170,170,75,"mixed",0],[390,0,100,"pull",0],[640,240,90,"mixed",1],[900,80,80,"mixed",1],[900,340,70,"mixed",1]]},
{"id":"sparse-anchors","title":"Sparse three-anchor field","topology":"Three comparable masses surround a large open interior","slots":[[220,0,85,"pull",0],[510,-250,95,"mixed",1],[740,240,90,"mixed",2]],"goalOffset":180},
{"id":"repellent-catch","title":"Repellent deflection and catch","topology":"Dedicated push wells steer into separate attracting masses","slots":[[180,-200,75,"push",0],[440,-280,90,"push",1],[300,0,100,"pull",0],[740,220,95,"pull",2],[170,250,70,"mixed",0]]},
{"id":"chained-binaries","title":"Chained binary pairs","topology":"Three paired columns with different gaps and masses","slots":[[160,-200,65,"mixed",0],[160,200,65,"mixed",0],[410,0,100,"pull",1],[410,270,90,"mixed",1],[760,-240,75,"mixed",2],[760,240,75,"mixed",2]]},
];

/** Reject perturbations that dissolve a grammar's ordering, gates, islands or voids. */
export function matchesStructure(family:SectorFamily,bodies:readonly Body[],launch:Vec2,checkpoint:Checkpoint):boolean {
 const grammar=STRUCTURES.find(g=>g.id===family);
 if(!grammar||bodies.length<grammar.slots.length||bodies.length>grammar.slots.length+3)return false;
 // The grammar describes the core. Difficulty adds up to three separately
 // collision-validated wells along its extended route.
 const bodyScale=checkpoint.gravityScale??1;
 if(!Number.isFinite(bodyScale)||bodyScale<=0)return false;
 bodies=bodies.slice(0,grammar.slots.length);
 const goalX=checkpoint.position.x-launch.x,goalY=checkpoint.position.y-launch.y;
 if(goalX<=0)return false;
 const points=bodies.map(b=>({x:(b.position.x-launch.x)*(grammar.referenceGoalX??750)/goalX,y:(b.position.y-launch.y-(grammar.validation==='sampled'?0:goalY*(b.position.x-launch.x)/goalX))/bodyScale}));
 const mirror=points.reduce((sum,p,i)=>sum+p.y*grammar.slots[i][1],0)<0?-1:1;
 points.forEach(p=>{p.y*=mirror;});
 if(points.some((p,i)=>Math.abs(p.x-grammar.slots[i][0])>90||Math.abs(p.y-grammar.slots[i][1])>45+Math.abs(grammar.slots[i][1])*.3||bodies[i].radius/(grammar.slots[i][2]*bodyScale)<.75||bodies[i].radius/(grammar.slots[i][2]*bodyScale)>1.2))return false;
 for(let i=0;i<points.length;i++)for(let j=0;j<i;j++){
  const [x,y]=grammar.slots[i],[u,v]=grammar.slots[j],dx=points[i].x-points[j].x,dy=points[i].y-points[j].y;
  if(Math.abs(x-u)>=100&&dx*Math.sign(x-u)<40)return false;
  if(Math.abs(y-v)>=150&&dy*Math.sign(y-v)<80)return false;
  if(x===u&&Math.abs(dx)>70)return false;
 }
 const pair=(i:number)=>({x:(points[i].x+points[i+1].x)/2,y:(points[i].y+points[i+1].y)/2});
 if(family==='three-step-slalom'){
  const centers=[pair(0),pair(2),pair(4)];
  return centers[0].y*centers[1].y<0&&centers[1].y*centers[2].y<0&&centers.every((p,i)=>i===0||Math.abs(p.y-centers[i-1].y)>140)&&[0,2,4].every(i=>Math.abs(points[i].x-points[i+1].x)<50&&Math.abs(points[i].y-points[i+1].y)>240);
 }
 if(family==='stepped-shelves'){
  const centers=[pair(0),pair(2),pair(4)];
  return [0,2,4].every(i=>Math.abs(points[i].y-points[i+1].y)<40&&points[i+1].x-points[i].x>140)&&centers.every((p,i)=>i===0||(p.x-centers[i-1].x>160&&p.y-centers[i-1].y>180));
 }
 if(family==='separated-clusters'){
  const slab=Math.min(...bodies.slice(4).map(b=>b.position.x-b.radius))-Math.max(...bodies.slice(0,4).map(b=>b.position.x+b.radius));
  return slab>=150&&points.slice(0,4).reduce((sum,p)=>sum+p.y,0)<0&&points.slice(4).reduce((sum,p)=>sum+p.y,0)>0;
 }
 if(family==='offset-paired-gates')return pair(2).x-pair(0).x>200&&pair(2).y-pair(0).y>120&&[0,2].every(i=>Math.abs(points[i+1].y-points[i].y)>180);
 if(family==='diagonal-ladder')return [1,2,3].every(i=>points[i].x-points[i-1].x>100&&points[i].y-points[i-1].y>60);
 if(family==='opposing-banks')return [1,2,4,5].every(i=>points[i].y-points[i-1].y>80)&&[0,1,2].every(i=>points[i+3].y-points[i].y>140);
 if(family==='horseshoe-pocket'){
  const [a,b,c]=[1,2,3].map(i=>bodies[i].position),p=checkpoint.position;
  const cross=(u:Vec2,v:Vec2)=>(v.x-u.x)*(p.y-u.y)-(v.y-u.y)*(p.x-u.x),signs=[cross(a,b),cross(b,c),cross(c,a)];
  return signs.every(s=>s>=0)||signs.every(s=>s<=0);
 }
 if(family==='triangular-islands'){
  const area=(i:number)=>{const [a,b,c]=points.slice(i,i+3);return Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x));};
  return area(0)>30000&&area(3)>30000;
 }
 return true;
}
