export type TutorialMode = "odessey" | "gravity";
export type TutorialResult = "complete" | "skipped";
export const tutorialKeys = {
  odessey: "orbit.walkthrough.odessey.v1",
  gravity: "orbit.walkthrough.gravity.v1",
} as const;
const sessionSeen = new Set<TutorialMode>();
const unwritten = new Set<TutorialMode>();
export function tutorialSeen(mode: TutorialMode): boolean {
  try {
    let value = window.localStorage.getItem(tutorialKeys[mode]);
    if (mode === "odessey" && value === null) {
      value = window.localStorage.getItem("orbit.walkthrough.zen.v1");
      if (value === "complete" || value === "skipped") {
        try {
          window.localStorage.setItem(tutorialKeys.odessey, value);
        } catch {
          /* Continue respecting the previous result when storage is full. */
        }
      }
    }
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
