import { bodyStrength, distance } from "../../game/physics";
import type { Body, Vec2 } from "../../game/types";
import type {
  GravityLevel,
  GravityObjective,
  GravityPhysicsOptions,
  GravityOrbitRequirement,
} from "../types";

export interface CreatorLevel {
  version: 1;
  id: string;
  name: string;
  launch: Vec2;
  bodies: Body[];
  objective: GravityObjective;
  physics?: GravityPhysicsOptions;
  requirements?: GravityOrbitRequirement[];
}
export const OBJECTIVES: { kind: GravityObjective["kind"]; label: string }[] = [
  { kind: "none", label: "No challenge" },
  { kind: "loop", label: "Complete a revolution" },
  { kind: "crowd", label: "Several planets around one body" },
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
    physics: {
      planetGravity: true,
      planetCollisions: "merge",
      bodyCollisions: true,
      trailSeconds: 6,
    },
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
  const requirements: GravityOrbitRequirement[] | undefined =
    data.requirements === undefined
      ? undefined
      : (() => {
          if (!Array.isArray(data.requirements) || data.requirements.length > 8)
            throw new Error("Choose valid core goals.");
          const seen = new Set<string>();
          return data.requirements.map((value) => {
            const goal = record(value);
            if (
              typeof goal.bodyId !== "string" ||
              seen.has(goal.bodyId) ||
              !bodies.some(
                (body) => body.id === goal.bodyId && body.kind === "attractor",
              )
            )
              throw new Error(
                "Choose a different attractive core for each goal.",
              );
            seen.add(goal.bodyId);
            if (
              goal.direction !== undefined &&
              !["either", "clockwise", "counterclockwise"].includes(
                String(goal.direction),
              )
            )
              throw new Error("Choose a valid orbit direction.");
            return {
              bodyId: goal.bodyId,
              count: number(goal.count, 1, 8, true),
              ...(goal.turns !== undefined
                ? { turns: number(goal.turns, 1, 3, true) }
                : {}),
              ...(goal.direction !== undefined
                ? {
                    direction:
                      goal.direction as GravityOrbitRequirement["direction"],
                  }
                : {}),
            };
          });
        })();
  const physics =
    data.physics === undefined ? undefined : parsePhysics(data.physics);
  return {
    version: 1,
    id: data.id,
    name: data.name.trim() || "Untitled orbit",
    launch: point(data.launch),
    bodies,
    ...(physics ? { physics } : {}),
    ...(objective.kind === "paired"
      ? {
          requirements: bodies
            .filter((body) => body.kind === "attractor")
            .map(
              (body) =>
                requirements?.find((goal) => goal.bodyId === body.id) ?? {
                  bodyId: body.id,
                  count: 1,
                },
            ),
        }
      : requirements
        ? { requirements }
        : {}),
    objective: {
      kind: objective.kind as GravityObjective["kind"],
      count: number(objective.count, 1, 8, true),
      turns: number(objective.turns, 1, 3, true),
      // v1 exports may contain a hold value. It no longer affects the challenge.
      hold: 0,
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
    physics: level.physics,
    requirements: kind === "paired" ? level.requirements : undefined,
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

function parsePhysics(value: unknown): GravityPhysicsOptions {
  const raw = record(value),
    result: GravityPhysicsOptions = {};
  for (const key of ["planetGravity", "bodyCollisions"] as const) {
    if (raw[key] !== undefined) {
      if (typeof raw[key] !== "boolean")
        throw new Error("Choose valid physics settings.");
      result[key] = raw[key];
    }
  }
  if (raw.planetCollisions !== undefined) {
    if (!["none", "elastic", "merge"].includes(String(raw.planetCollisions)))
      throw new Error("Choose valid collisions.");
    result.planetCollisions =
      raw.planetCollisions as GravityPhysicsOptions["planetCollisions"];
  }
  const ranges = {
    planetMass: [0.01, 10000],
    planetRadius: [1, 80],
    planetGravityStrength: [0, 10000000],
    trailSeconds: [0.1, 60],
    escapeDistance: [100, 100000],
  } as const;
  for (const key of Object.keys(ranges) as (keyof typeof ranges)[])
    if (raw[key] !== undefined)
      result[key] = number(raw[key], ranges[key][0], ranges[key][1]);
  return result;
}
export const MAX_PORTABLE_LENGTH = 18000;
export function exportDraft(draft: CreatorLevel): string {
  return JSON.stringify(parseDraft(draft), null, 2);
}
export function importDraft(text: string): CreatorLevel {
  if (text.length > MAX_PORTABLE_LENGTH)
    throw new Error(
      "This level is too large. Use a Gravity level under 18 KB.",
    );
  try {
    return parseDraft(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new Error("Paste a valid Gravity level JSON file.");
    throw error;
  }
}
export function levelShareUrl(
  draft: CreatorLevel,
  base = window.location.href,
): string {
  const text = JSON.stringify(parseDraft(draft));
  const encoded = btoa(
    Array.from(new TextEncoder().encode(text), (byte) =>
      String.fromCharCode(byte),
    ).join(""),
  );
  const url = new URL(base);
  url.search = "";
  url.searchParams.set("mode", "creator");
  url.searchParams.set("sky", encoded);
  url.hash = "";
  if (url.href.length > MAX_PORTABLE_LENGTH)
    throw new Error(
      "This sky is too large for a link. Export its JSON instead.",
    );
  return url.href;
}
export function sharedDraft(search: string): CreatorLevel | null {
  const encoded = new URLSearchParams(search).get("sky");
  if (!encoded) return null;
  if (encoded.length > MAX_PORTABLE_LENGTH)
    throw new Error("This shared sky is too large.");
  try {
    const bytes = Uint8Array.from(atob(encoded), (character) =>
      character.charCodeAt(0),
    );
    return importDraft(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error(
      "This sky link is invalid. Import a Gravity level JSON file instead.",
    );
  }
}
