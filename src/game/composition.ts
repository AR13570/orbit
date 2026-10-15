import type { BodyKind, SectorFamily, StaticSector } from './types';
import { CERTIFIED_LAYOUTS } from './certified-layouts';
import { PROGRESSIVE_LAYOUTS } from './progressive-layouts';
export interface CompositionDescriptor {
 readonly family?:SectorFamily;
 readonly goal:readonly [number,number];
 readonly bodies:readonly {readonly x:number;readonly y:number;readonly size:number;readonly kind:BodyKind}[];
}
export const RECENT_LAYOUT_LIMIT=6;
export const MIN_COMPOSITION_DISTANCE=1.2;
export const MIN_GEOMETRY_DISTANCE=0.75;
/** Coarse visual bins ignore IDs, seeds and sub-cell coordinate jitter. */
export function describeComposition(sector:Pick<StaticSector,'launch'|'checkpoint'|'bodies'>&Partial<Pick<StaticSector,'generation'>>):CompositionDescriptor {
 const {launch}=sector;
 return {family:sector.generation?.family,goal:[Math.round((sector.checkpoint.position.x-launch.x)/80),Math.round((sector.checkpoint.position.y-launch.y)/80)],bodies:sector.bodies.map(body=>({x:Math.round((body.position.x-launch.x)/80),y:Math.round((body.position.y-launch.y)/80),size:Math.round(body.radius/16),kind:body.kind}))};
}
/** Bidirectional nearest silhouettes penalize changed occupancy, sizes and gravity kinds. */
export function compositionDistance(a:CompositionDescriptor,b:CompositionDescriptor):number {
 const directed=(from:CompositionDescriptor,to:CompositionDescriptor)=>from.bodies.reduce((sum,body)=>sum+Math.min(...to.bodies.map(other=>Math.hypot(body.x-other.x,body.y-other.y)*0.5+Math.abs(body.size-other.size)*0.4+(body.kind===other.kind?0:0.9))),0)/from.bodies.length;
 return (directed(a,b)+directed(b,a))/2+Math.abs(a.bodies.length-b.bodies.length)*0.35+Math.hypot(a.goal[0]-b.goal[0],a.goal[1]-b.goal[1])*0.25;
}
/** Geometry alone must change; a different goal or kind palette cannot disguise the same field. */
export function geometryDistance(a:CompositionDescriptor,b:CompositionDescriptor):number {
 const directed=(from:CompositionDescriptor,to:CompositionDescriptor)=>from.bodies.reduce((sum,body)=>sum+Math.min(...to.bodies.map(other=>Math.hypot(body.x-other.x,body.y-other.y)*0.5+Math.abs(body.size-other.size)*0.4)),0)/from.bodies.length;
 return (directed(a,b)+directed(b,a))/2+Math.abs(a.bodies.length-b.bodies.length)*0.25;
}
export function freshComposition(candidate:CompositionDescriptor,recent:readonly CompositionDescriptor[]):boolean {
 return recent.slice(-RECENT_LAYOUT_LIMIT).every(previous=>(candidate.family===undefined||previous.family!==candidate.family)&&compositionDistance(candidate,previous)>=MIN_COMPOSITION_DISTANCE&&geometryDistance(candidate,previous)>=MIN_GEOMETRY_DISTANCE);
}
const certifiedByStage:CompositionDescriptor[][]=[CERTIFIED_LAYOUTS,...PROGRESSIVE_LAYOUTS].map(entries=>entries.map(entry=>({family:entry.family,goal:[Math.round(entry.goal[0]/80),Math.round(entry.goal[1]/80)],bodies:entry.bodies.map(([x,y,radius,kind])=>({x:Math.round(x/80),y:Math.round(y/80),size:Math.round(radius/16),kind}))})));
/** Preserve enough unblocked certificates to survive any following six emergency selections. */
export function preservesFallbackCoverage(candidate:CompositionDescriptor,recent:readonly CompositionDescriptor[],stage=0):boolean {
 const certifiedDescriptors=certifiedByStage[stage];
 // With at least seven pairwise distinct families, each of the six recent
 // fields may obscure only its own family's canonical certificate.
 if(stage>0)return certifiedDescriptors.every(certificate=>certificate.family===candidate.family||freshComposition(certificate,[candidate]));
 const next=[...recent.slice(-(RECENT_LAYOUT_LIMIT-1)),candidate];
 const certifiedCount=next.filter(descriptor=>certifiedDescriptors.some(certificate=>compositionDistance(descriptor,certificate)===0&&geometryDistance(descriptor,certificate)===0)).length;
 const available=certifiedDescriptors.filter(certificate=>freshComposition(certificate,next)).length;
 return available>=RECENT_LAYOUT_LIMIT+1-certifiedCount;
}
