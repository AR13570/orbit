export type TutorialMode = "zen" | "gravity";
export type TutorialResult = "complete" | "skipped";
export const tutorialKeys = {
  zen: "orbit.walkthrough.zen.v1",
  gravity: "orbit.walkthrough.gravity.v1",
} as const;
const sessionSeen = new Set<TutorialMode>();
const unwritten = new Set<TutorialMode>();
export function tutorialSeen(mode: TutorialMode): boolean {
  try {
    const value = window.localStorage.getItem(tutorialKeys[mode]);
    return value === "complete" || value === "skipped" || unwritten.has(mode);
  } catch {
    return sessionSeen.has(mode);
  }
}
export function finishTutorial(mode: TutorialMode, result: TutorialResult) {
  sessionSeen.add(mode);
  try {
    window.localStorage.setItem(tutorialKeys[mode], result);
    unwritten.delete(mode);
  } catch {
    unwritten.add(mode);
    /* Keep this page usable when storage is blocked. */
  }
}
