import { probeFlight } from './challenge';
import type { ChallengeLayout, SearchBudget } from './challenge';
import { analyzeGravityBends } from './gravity-bends';
import type { Aim } from './types';

/** Positive counterfactual evidence: remove gravity, retain the solid body,
 * and require an actual collision. A timeout is inconclusive. */
export function criticalGravityBodies(layout:ChallengeLayout,aim:Aim,budget?:SearchBudget):string[] {
 const shot=probeFlight(layout,aim.angle,aim.power,true,budget,true);
 if(shot.ending!=='dock')return [];
 return analyzeGravityBends(layout,shot.path).map(bend=>bend.bodyId).filter(id=>
  probeFlight(layout,aim.angle,aim.power,new Set([id]),budget).ending==='collision');
}

/** Offline finite screening. This is empirical coverage, not a proof over
 * every possible continuous angle and launch power. */
export function screenGravityShortcuts(layout:ChallengeLayout,requiredBends:number,angles=252,powers=40) {
 let captures=0;
 for(let a=0;a<angles;a++)for(let p=0;p<=powers;p++){
  const angle=-Math.PI+a*2*Math.PI/angles,power=p/powers;
  const shot=probeFlight(layout,angle,power,true,undefined,true);
  if(shot.ending!=='dock')continue;
  captures++;
  const bends=analyzeGravityBends(layout,shot.path).length;
  if(bends<requiredBends)return {passed:false,captures,shortcut:{angle,power,bends}};
 }
 return {passed:true,captures,shortcut:null};
}
