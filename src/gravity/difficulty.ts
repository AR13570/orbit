/** Endless effort starts at the campaign finale, then grows within playable limits. */
export interface GravityDifficulty {
  population: number;
  turns: number;
}
export function gravityDifficulty(index: number): GravityDifficulty {
  const normalized = Number.isFinite(index)
    ? Math.max(0, Math.floor(index))
    : 0;
  const offset = Math.max(0, normalized - 45);
  return {
    population: 6 + Number(offset >= 15) + Number(offset >= 30),
    turns: 2 + Number(offset >= 45),
  };
}
