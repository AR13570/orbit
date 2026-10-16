import type { TutorialMode } from "./state";
export interface TutorialStep {
  id: string;
  title: string;
  text: string;
  tone?: "warm" | "blue" | "rust";
}
export function tutorialSteps(
  mode: TutorialMode,
  _kinds: readonly string[] = [],
): TutorialStep[] {
  return [
    {
      id: "intro",
      tone: "warm",
      title: "Your ship",
      text:
        mode === "odessey"
          ? "Pull anywhere to aim, then release from this ring. While playing, pinch to zoom; scroll on desktop."
          : "Pull anywhere to aim, then release to launch from this ring.",
    },
    {
      id: "forces",
      tone: "blue",
      title: "Gravity bends your flight",
      text: "Inward chevrons pull you closer; outward chevrons push you away.",
    },
    ...(mode === "odessey"
      ? [
          {
            id: "checkpoint",
            tone: "blue" as const,
            title: "Reach the flag",
            text: "Curve into the blue ring to reach your next checkpoint.",
          },
          {
            id: "split",
            title: "One becomes three",
            text: "Select Split, launch one ship, then tap during flight to branch.",
          },
        ]
      : [
          {
            id: "orbit",
            tone: "blue" as const,
            title: "Complete an orbit",
            text: "Keep a projectile circling until its progress ring fills completely.",
          },
          {
            id: "multiple",
            title: "Build your sky",
            text: "Launch again while earlier projectiles fly to build concurrent orbits.",
          },
        ]),
    {
      id: "launch",
      tone: "warm",
      title: mode === "odessey" ? "Follow the curve" : "Try a launch",
      text:
        mode === "odessey"
          ? "Pull to the small handle; release to follow the purple route."
          : "Pull to the handle, then release to try your first flight.",
    },
    ...(mode === "odessey"
      ? [
          {
            id: "practice-split",
            tone: "warm" as const,
            title: "Select split mode",
            text: "Double-tap anywhere to select Split before you launch.",
          },
        ]
      : []),
  ];
}
