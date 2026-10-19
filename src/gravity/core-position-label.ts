import type { GravityLevel } from "./types";

/** Describe visible targets without adding names or letters to their faces. */
export function corePositionLabel(
  level: Pick<GravityLevel, "bodies">,
  bodyId: string,
): string {
  const cores = level.bodies.filter((body) => body.kind === "attractor");
  if (!cores.some((body) => body.id === bodyId)) return "a core";
  if (cores.length === 1) return "the core";
  const spread = (axis: "x" | "y") =>
    Math.max(...cores.map((body) => body.position[axis])) -
    Math.min(...cores.map((body) => body.position[axis]));
  const horizontal = spread("x") >= spread("y");
  const axis = horizontal ? "x" : "y";
  const secondary = horizontal ? "y" : "x";
  cores.sort(
    (a, b) =>
      a.position[axis] - b.position[axis] ||
      a.position[secondary] - b.position[secondary] ||
      a.id.localeCompare(b.id),
  );
  const index = cores.findIndex((body) => body.id === bodyId);
  if (index === 0)
    return horizontal ? "the leftmost core" : "the uppermost core";
  if (index === cores.length - 1)
    return horizontal ? "the rightmost core" : "the lowermost core";
  if (cores.length === 3) return "the middle core";
  const rank = index + 1;
  const suffix =
    rank % 100 >= 11 && rank % 100 <= 13
      ? "th"
      : (["th", "st", "nd", "rd"][rank % 10] ?? "th");
  return `the ${rank}${suffix} core from the ${horizontal ? "left" : "top"}`;
}
