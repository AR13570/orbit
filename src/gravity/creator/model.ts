import { bodyStrength, distance } from "../../game/physics";
import type { Body, Vec2 } from "../../game/types";
import type { GravityLevel, GravityObjective } from "../types";

export interface CreatorLevel {
  version: 1;
  id: string;
  name: string;
  launch: Vec2;
  bodies: Body[];
  objective: GravityObjective;
}
export const OBJECTIVES: { kind: GravityObjective["kind"]; label: string }[] = [
  { kind: "none", label: "No challenge" },
  { kind: "loop", label: "Complete a revolution" },
  { kind: "crowd", label: "Several projectiles around one body" },
  { kind: "counter", label: "Orbit in both directions" },
  { kind: "paired", label: "An orbit around each body" },
  { kind: "tour", label: "Loop around two bodies together" },
];
const DRAFT_KEY = "orbit-creator-draft",
  LIBRARY_KEY = "orbit-creator-levels";
export const MAX_CREATOR_STRENGTH = bodyStrength(160);
export function newDraft(): CreatorLevel {
  return {
    version: 1,
    id: crypto.randomUUID(),
    name: "Untitled orbit",
    launch: { x: 450, y: 650 },
    bodies: [
      {
        id: "body-1",
        kind: "attractor",
        position: { x: 450, y: 450 },
        radius: 40,
        strength: bodyStrength(40),
      },
    ],
    objective: { kind: "none", count: 1, turns: 1, hold: 0 },
  };
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Choose a valid Gravity level.");
  return value as Record<string, unknown>;
}
function number(
  value: unknown,
  min: number,
  max: number,
  integer = false,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    throw new Error(
      "This level contains an invalid size, position or objective.",
    );
  return value;
}
function point(value: unknown): Vec2 {
  const p = record(value);
  return { x: number(p.x, 0, 900), y: number(p.y, 0, 900) };
}
export function parseDraft(value: unknown): CreatorLevel {
  const data = record(value),
    objective = record(data.objective);
  if (
    data.version !== 1 ||
    typeof data.id !== "string" ||
    !/^[\w-]{1,80}$/.test(data.id) ||
    typeof data.name !== "string" ||
    data.name.length > 80
  )
    throw new Error("Choose a valid Gravity level.");
  if (!Array.isArray(data.bodies) || data.bodies.length > 8)
    throw new Error("A level can have up to eight bodies.");
  const ids = new Set<string>();
  const bodies = data.bodies.map((value): Body => {
    const b = record(value);
    if (
      typeof b.id !== "string" ||
      !/^[\w-]{1,80}$/.test(b.id) ||
      b.id === "pair" ||
      b.id === "launcher" ||
      ids.has(b.id) ||
      (b.kind !== "attractor" && b.kind !== "repellent")
    )
      throw new Error("This level contains an invalid body.");
    ids.add(b.id);
    const radius = number(b.radius, 16, 80);
    return {
      id: b.id,
      kind: b.kind,
      radius,
      position: point(b.position),
      strength:
        b.strength === undefined
          ? bodyStrength(radius)
          : number(b.strength, 0, MAX_CREATOR_STRENGTH),
    };
  });
  if (!OBJECTIVES.some((option) => option.kind === objective.kind))
    throw new Error("Choose a valid Gravity challenge or No challenge.");
  return {
    version: 1,
    id: data.id,
    name: data.name.trim() || "Untitled orbit",
    launch: point(data.launch),
    bodies,
    objective: {
      kind: objective.kind as GravityObjective["kind"],
      count: number(objective.count, 1, 8, true),
      turns: number(objective.turns, 1, 3, true),
      hold: number(objective.hold, 0, 10, true),
    },
  };
}
export function layoutErrors(level: CreatorLevel): string[] {
  const errors: string[] = [],
    attractors = level.bodies.filter((b) => b.kind === "attractor");
  if (level.objective.kind !== "none" && !attractors.length)
    errors.push("Add at least one attractive body.");
  if (level.objective.kind === "paired" && attractors.length < 2)
    errors.push("This objective needs at least two attractive bodies.");
  if (level.objective.kind === "tour" && attractors.length !== 2)
    errors.push("This objective needs exactly two attractive bodies.");
  if (
    level.launch.x < 10 ||
    level.launch.y < 10 ||
    level.launch.x > 890 ||
    level.launch.y > 890
  )
    errors.push("Keep the launcher inside the field.");
  for (const [index, body] of level.bodies.entries()) {
    const p = body.position,
      r = body.radius;
    if (p.x < r || p.y < r || p.x > 900 - r || p.y > 900 - r)
      errors.push("Keep every body inside the field.");
    if (distance(p, level.launch) < r + 18)
      errors.push("Move the launcher clear of the bodies.");
    if (
      level.bodies
        .slice(index + 1)
        .some((other) => distance(p, other.position) < r + other.radius + 8)
    )
      errors.push("Give the bodies a little space between them.");
  }
  return [...new Set(errors)];
}
export function toGravityLevel(draft: CreatorLevel): GravityLevel {
  const level = parseDraft(draft),
    kind = level.objective.kind;
  const count =
    kind === "paired"
      ? level.bodies.filter((b) => b.kind === "attractor").length
      : kind === "counter"
        ? 2
        : kind === "crowd"
          ? Math.max(2, Math.min(6, level.objective.count))
          : 1;
  return {
    index: 0,
    seed: 0,
    family: kind,
    bounds: { x: 0, y: 0, width: 900, height: 900 },
    launch: level.launch,
    bodies: level.bodies,
    objective: { ...level.objective, count },
    witness: [],
  };
}
export function loadDraft(): CreatorLevel | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? parseDraft(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
export function saveDraft(level: CreatorLevel): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(parseDraft(level)));
}
export function loadLibrary(): CreatorLevel[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    const levels: CreatorLevel[] = [];
    for (const value of raw.slice(0, 30)) {
      try {
        const level = parseDraft(value);
        if (!levels.some((other) => other.id === level.id)) levels.push(level);
      } catch {
        /* Ignore corrupt entries without losing valid saved levels. */
      }
    }
    return levels;
  } catch {
    return [];
  }
}
export function saveLevel(level: CreatorLevel): CreatorLevel[] {
  const normalized = parseDraft(level),
    levels = loadLibrary();
  const index = levels.findIndex((other) => other.id === normalized.id);
  if (index >= 0) levels[index] = normalized;
  else {
    if (levels.length >= 30)
      throw new Error(
        "Your library is full. Remove a saved level to make room.",
      );
    levels.unshift(normalized);
  }
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(levels));
  return levels;
}
export function deleteLevel(id: string): CreatorLevel[] {
  const levels = loadLibrary().filter((level) => level.id !== id);
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(levels));
  return levels;
}
