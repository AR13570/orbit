import type { Vec2 } from "../game/types";
import type { FocusArea, WalkthroughFocus } from "../render/coordinates";
import type { Highlight } from "./Walkthrough";
export interface TargetRenderer {
  setWalkthroughFocus: (focus: WalkthroughFocus | null) => void;
  worldToScreen: (position: Vec2) => Vec2;
}
export function worldHighlight(
  renderer: TargetRenderer,
  position: Vec2,
  radius: number,
  area: FocusArea,
  scale: () => number,
  fixedRadius?: number,
): Highlight {
  renderer.setWalkthroughFocus({ position, radius, area });
  const point = renderer.worldToScreen(position);
  const extent = fixedRadius ?? Math.max(16, radius * scale());
  return {
    x: point.x - extent,
    y: point.y - extent,
    width: extent * 2,
    height: extent * 2,
    shape: "circle",
  };
}
export function elementHighlight(
  element: Element | null | undefined,
): Highlight | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0
    ? {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        shape: "rect",
      }
    : null;
}
