export const ODESSEY_DIFFICULTIES = [
 {stage:0,factor:0,extraBodies:0,minClearance:65,minLength:600,maxLength:850,width:1250,height:900,bodyScale:1,minBend:70,requiredBends:1,aimTolerance:.025},
 {stage:1,factor:1/3,extraBodies:2,minClearance:50,minLength:1200,maxLength:1400,width:2100,height:1350,bodyScale:1.2,minBend:80,requiredBends:2,aimTolerance:.025},
 {stage:2,factor:2/3,extraBodies:2,minClearance:65,minLength:1800,maxLength:2100,width:3100,height:1800,bodyScale:1.8,minBend:90,requiredBends:2,aimTolerance:.02},
 {stage:3,factor:1,extraBodies:3,minClearance:65,minLength:2600,maxLength:3000,width:4200,height:2250,bodyScale:2.25,minBend:100,requiredBends:3,aimTolerance:.0125},
] as const;

/** Level numbers are one-based; sector indices are zero-based. */
export function odesseyDifficulty(index:number) {
 const normalizedIndex=Math.max(0,Math.floor(Number.isFinite(index)?index:0));
 const stage=normalizedIndex>=14?3:normalizedIndex>=9?2:normalizedIndex>=4?1:0;
 return ODESSEY_DIFFICULTIES[stage];
}
