import { useCallback, useEffect, useState } from "react";
import Icon from "../../components/Icon";
import { bodyStrength } from "../../game/physics";
import type { Body, Vec2 } from "../../game/types";
import { FORCE_PALETTE } from "../../render/force-palette";
import type { GravityLevel, GravityPhysicsOptions } from "../types";
import GravityGame from "../GravityGame";
import CreatorField, { type CreatorTool } from "./CreatorField";
import CreatorPopover from "./CreatorPopover";
import { clampPosition, clearPosition, nearbyPosition } from "./controls";
import {
  OBJECTIVES,
  exportDraft,
  importDraft,
  levelShareUrl,
  sharedDraft,
  deleteLevel,
  layoutErrors,
  loadDraft,
  loadLibrary,
  newDraft,
  saveDraft,
  saveLevel,
  toGravityLevel,
  type CreatorLevel,
} from "./model";

type Popup = { kind: "challenge" | "levels" | "name" | "physics" | "transfer" };
function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="creator-stepper">
      <span>{label}</span>
      <button
        aria-label={`Decrease ${label.toLowerCase()}`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <output aria-label={label}>{value}</output>
      <button
        aria-label={`Increase ${label.toLowerCase()}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
export default function GravityCreator({ onExit }: { onExit: () => void }) {
  const [incoming] = useState(() => {
    try {
      const shared = sharedDraft(window.location.search),
        previous = loadDraft();
      if (shared && previous && shared.id !== previous.id) saveLevel(previous);
      return { draft: shared, error: "" };
    } catch (error) {
      return { draft: null, error: (error as Error).message };
    }
  });
  useEffect(() => {
    // A portable link is an import action, not an instruction to replace future edits on every visit.
    const url = new URL(window.location.href);
    if (url.searchParams.has("sky")) {
      url.searchParams.delete("sky");
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  }, []);
  const [draft, setDraft] = useState(
    () => incoming.draft ?? loadDraft() ?? newDraft(),
  );
  const [portable, setPortable] = useState("");
  const [library, setLibrary] = useState(loadLibrary);
  const [selected, setSelected] = useState("");
  const [tool, setTool] = useState<CreatorTool>("select");
  const [popup, setPopup] = useState<Popup | null>(null);
  const closePopup = useCallback(() => setPopup(null), []);
  const [notice, setNotice] = useState(incoming.error);
  const [storageError, setStorageError] = useState("");
  const [playtest, setPlaytest] = useState<{
    level: GravityLevel;
    name: string;
  } | null>(null);
  useEffect(() => {
    try {
      saveDraft(draft);
      setStorageError("");
    } catch {
      setStorageError(
        "Browser storage is unavailable or full. Your changes cannot be saved yet.",
      );
    }
  }, [draft]);
  const errors = layoutErrors(draft),
    body = draft.bodies.find((b) => b.id === selected);
  const select = (id: string) => {
    setSelected(id);
    setPopup(null);
    if (id) setTool("select");
  };
  const move = (id: string, position: Vec2) =>
    setDraft((d) =>
      id === "launcher"
        ? { ...d, launch: position }
        : {
            ...d,
            bodies: d.bodies.map((b) => (b.id === id ? { ...b, position } : b)),
          },
    );
  const changeBody = (id: string, update: Partial<Body>) =>
    setDraft((d) => ({
      ...d,
      bodies: d.bodies.map((b) => (b.id === id ? { ...b, ...update } : b)),
      requirements:
        update.kind === "repellent"
          ? d.requirements?.filter((goal) => goal.bodyId !== id)
          : d.requirements,
    }));
  const remove = (id: string) => {
    setDraft((d) => ({
      ...d,
      bodies: d.bodies.filter((b) => b.id !== id),
      requirements: d.requirements?.filter((goal) => goal.bodyId !== id),
    }));
    setSelected("");
    setPopup(null);
    setNotice("Body removed.");
  };
  const persist = () => {
    try {
      setLibrary(saveLevel(draft));
      setStorageError("");
      setNotice(
        `Saved “${draft.name.trim() || "Untitled orbit"}” in this browser.`,
      );
      return true;
    } catch (error) {
      setStorageError(
        error instanceof Error && error.message.includes("library is full")
          ? error.message
          : "Browser storage is unavailable or full. Your level could not be saved.",
      );
      return false;
    }
  };
  const place = (kind: Body["kind"], point: Vec2) => {
    if (draft.bodies.length >= 8) {
      setNotice("A level can have up to eight bodies.");
      return;
    }
    const radius = kind === "attractor" ? 36 : 22,
      position = clampPosition(point, radius);
    if (!clearPosition(draft, position, radius)) {
      setNotice("Choose a clear space on the field.");
      return;
    }
    const added: Body = {
      id: `body-${crypto.randomUUID()}`,
      kind,
      position,
      radius,
      strength: bodyStrength(radius),
    };
    setDraft((d) => ({ ...d, bodies: [...d.bodies, added] }));
    setSelected(added.id);
    setTool("select");
    setNotice("");
  };
  const duplicate = (id: string) => {
    const original = draft.bodies.find((b) => b.id === id);
    if (!original) return;
    if (draft.bodies.length >= 8) {
      setNotice("A level can have up to eight bodies.");
      return;
    }
    const position = nearbyPosition(draft, original.radius, original.position);
    if (!position) {
      setNotice("Move a body to make room for the duplicate.");
      return;
    }
    const copy = { ...original, id: `body-${crypto.randomUUID()}`, position };
    setDraft((d) => ({ ...d, bodies: [...d.bodies, copy] }));
    setSelected(copy.id);
    setPopup(null);
    setNotice("Body duplicated.");
  };
  const replaceDraft = (next: CreatorLevel) => {
    if (next.id === draft.id) {
      setNotice("This level is already open. Your latest edits are kept.");
      setPopup(null);
      return;
    }
    if (!persist()) return;
    setDraft(structuredClone(next));
    setSelected("");
    setTool("select");
    setPopup(null);
    setNotice("");
  };
  if (playtest)
    return (
      <GravityGame
        customLevel={playtest.level}
        customName={playtest.name}
        onExit={() => setPlaytest(null)}
      />
    );
  const objective = OBJECTIVES.find((o) => o.kind === draft.objective.kind)!;
  return (
    <main className="creator">
      <h1 className="visually-hidden">Gravity creator</h1>
      <div className="creator-canvas">
        <CreatorField
          level={draft}
          selected={selected}
          tool={tool}
          onSelect={select}
          onMove={move}
          onBodyChange={changeBody}
          onPlace={place}
          onRemove={remove}
        />
      </div>
      <header className="creator-header">
        <div className="creator-identity">
          <button
            className="creator-back"
            aria-label="Choose mode"
            onClick={onExit}
          >
            <Icon name="back" />
          </button>
          <button
            className="creator-title"
            aria-label="Rename level"
            data-creator-popup-trigger
            onClick={() =>
              setPopup(popup?.kind === "name" ? null : { kind: "name" })
            }
          >
            <span>{draft.name || "Untitled orbit"}</span>
            <Icon name="edit" />
          </button>
        </div>
        <div className="creator-actions">
          <button
            aria-label="Save level"
            onClick={persist}
            disabled={errors.length > 0}
          >
            Save
          </button>
          <button
            className="creator-primary"
            aria-label="Playtest"
            disabled={errors.length > 0}
            onClick={() => {
              setPopup(null);
              setPlaytest({ level: toGravityLevel(draft), name: draft.name });
            }}
          >
            Play <Icon name="play" />
          </button>
        </div>
      </header>
      <button
        className="creator-challenge"
        aria-label="Choose challenge"
        data-creator-popup-trigger
        aria-haspopup="dialog"
        aria-expanded={popup?.kind === "challenge"}
        onClick={() =>
          setPopup(popup?.kind === "challenge" ? null : { kind: "challenge" })
        }
      >
        <span>{objective.label}</span>
        <span aria-hidden="true">⌄</span>
        <small>
          {draft.objective.kind === "none" ? (
            "Free play"
          ) : (
            <>
              {draft.objective.kind === "crowd"
                ? `${draft.objective.count} planets · `
                : ""}
              {draft.objective.turns}{" "}
              {draft.objective.turns === 1 ? "revolution" : "revolutions"}
            </>
          )}
        </small>
      </button>
      <button
        className="creator-physics"
        aria-label="Sandbox settings"
        data-creator-popup-trigger
        onClick={() =>
          setPopup(popup?.kind === "physics" ? null : { kind: "physics" })
        }
      >
        Physics
      </button>
      <div className="creator-bottom">
        <div className="creator-messages" aria-live="polite">
          {errors.length > 0 ? (
            <div className="creator-errors" role="alert">
              {errors[0]}
              {errors.length > 1 && ` (+${errors.length - 1})`}
            </div>
          ) : null}
          {storageError && (
            <div className="creator-errors" role="alert">
              {storageError}
            </div>
          )}
          <p className="creator-status" role="status">
            {notice}
          </p>
        </div>
        {selected && (
          <div
            className="creator-selection"
            role="toolbar"
            aria-label="Selected object"
          >
            {body ? (
              <>
                <button
                  className="creator-type"
                  aria-label={`Change to ${body.kind === "attractor" ? "repeller" : "attractor"}`}
                  title={`Change to ${body.kind === "attractor" ? "repeller" : "attractor"}`}
                  onClick={() =>
                    changeBody(body.id, {
                      kind:
                        body.kind === "attractor" ? "repellent" : "attractor",
                    })
                  }
                >
                  <span
                    className={`creator-tool-dot ${body.kind === "repellent" ? "creator-tool-repeller" : ""}`}
                    style={{ background: FORCE_PALETTE[body.kind].body }}
                  />
                  {body.kind === "attractor" ? "Attractor" : "Repeller"}
                  <Icon name="swap" />
                </button>
                <div className="creator-selection-stats">
                  <span>Size {body.radius}</span>
                  <span>
                    Gravity {(body.strength / bodyStrength(40)).toFixed(2)}×
                  </span>
                </div>
                <div className="creator-selection-actions">
                  <button
                    aria-label="Duplicate body"
                    title="Duplicate body"
                    disabled={draft.bodies.length >= 8}
                    onClick={() => duplicate(body.id)}
                  >
                    <Icon name="duplicate" />
                  </button>
                  <button
                    className="creator-delete"
                    aria-label="Delete body"
                    title="Delete body"
                    onClick={() => remove(body.id)}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </>
            ) : (
              <span className="creator-selected-launcher">Launcher</span>
            )}
          </div>
        )}
        <p className="creator-hint">
          {tool !== "select"
            ? `Tap the field to place an ${tool === "attractor" ? "attractor" : "repeller"}.`
            : body
              ? "Drag Size or Gravity. Tap the body type to switch it."
              : "Select a core to shape it. In play, launch planets from anywhere."}
        </p>
        <nav className="creator-tools" aria-label="Creator tools">
          <button
            aria-label="Move objects"
            aria-pressed={tool === "select"}
            onClick={() => {
              setTool("select");
              setPopup(null);
            }}
          >
            <Icon name="move" /> <span>Move</span>
          </button>
          <button
            aria-label="Add attractor"
            aria-pressed={tool === "attractor"}
            disabled={draft.bodies.length >= 8}
            onClick={() => {
              setTool("attractor");
              setSelected("");
              setPopup(null);
              setNotice("");
            }}
          >
            <span
              className="creator-tool-dot"
              style={{ background: FORCE_PALETTE.attractor.body }}
            />
            Attractor
          </button>
          <button
            aria-label="Add repeller"
            aria-pressed={tool === "repellent"}
            disabled={draft.bodies.length >= 8}
            onClick={() => {
              setTool("repellent");
              setSelected("");
              setPopup(null);
              setNotice("");
            }}
          >
            <span
              className="creator-tool-dot creator-tool-repeller"
              style={{ background: FORCE_PALETTE.repellent.body }}
            />
            Repeller
          </button>
          <button
            aria-label="Saved levels"
            data-creator-popup-trigger
            aria-haspopup="dialog"
            aria-expanded={popup?.kind === "levels"}
            onClick={() =>
              setPopup(popup?.kind === "levels" ? null : { kind: "levels" })
            }
          >
            ☷ <span>Levels</span>
          </button>
        </nav>
      </div>
      {popup?.kind === "physics" && (
        <CreatorPopover title="Sandbox physics" onClose={closePopup}>
          <div className="gravity-settings">
            <label>
              Planet gravity{" "}
              <input
                type="checkbox"
                aria-label="Planet gravity"
                checked={draft.physics?.planetGravity ?? false}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    physics: { ...d.physics, planetGravity: e.target.checked },
                  }))
                }
              />
            </label>
            <label>
              Core collisions{" "}
              <input
                type="checkbox"
                aria-label="Core collisions"
                checked={draft.physics?.bodyCollisions ?? true}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    physics: { ...d.physics, bodyCollisions: e.target.checked },
                  }))
                }
              />
            </label>
            <label>
              Planet collisions{" "}
              <select
                aria-label="Planet collisions"
                value={draft.physics?.planetCollisions ?? "soft"}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    physics: {
                      ...d.physics,
                      planetCollisions: e.target
                        .value as GravityPhysicsOptions["planetCollisions"],
                    },
                  }))
                }
              >
                <option value="none">Pass through</option>
                <option value="soft">Surface contact</option>
                <option value="elastic">Bounce</option>
                <option value="merge">Merge</option>
              </select>
            </label>
            <label>
              Trail length{" "}
              <select
                aria-label="Trail length"
                value={draft.physics?.trailSeconds ?? 6}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    physics: {
                      ...d.physics,
                      trailSeconds: Number(e.target.value),
                    },
                  }))
                }
              >
                <option value={3}>Short</option>
                <option value={6}>Normal</option>
                <option value={30}>Long</option>
              </select>
            </label>
          </div>
          <button className="creator-popover-done" onClick={closePopup}>
            Done
          </button>
        </CreatorPopover>
      )}
      {popup?.kind === "transfer" && (
        <CreatorPopover title="Share a sky" onClose={closePopup}>
          <p className="creator-note">
            Copy a link to open this sky on another device, or keep its JSON.
            Levels are stored in your browser.
          </p>
          <label className="creator-name-label">
            Level JSON
            <textarea
              aria-label="Level JSON"
              value={portable}
              onChange={(e) => setPortable(e.target.value)}
              maxLength={18000}
              spellCheck={false}
            />
          </label>
          <div className="creator-transfer-actions">
            <button
              onClick={() => {
                try {
                  const next = importDraft(portable);
                  if (!persist()) return;
                  setDraft(next);
                  setSelected("");
                  setPopup(null);
                  setNotice("Sky imported.");
                } catch (error) {
                  setNotice((error as Error).message);
                }
              }}
            >
              Import JSON
            </button>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(exportDraft(draft));
                  setNotice("Level JSON copied.");
                } catch {
                  setNotice("Select and copy the JSON above.");
                }
              }}
            >
              Copy JSON
            </button>
            <button
              onClick={async () => {
                try {
                  const url = levelShareUrl(draft);
                  await navigator.clipboard.writeText(url);
                  setNotice("Sky link copied.");
                } catch (error) {
                  setNotice(
                    error instanceof Error && error.message.includes("large")
                      ? error.message
                      : "Link could not be copied. Copy the JSON instead.",
                  );
                }
              }}
            >
              Copy sky link
            </button>
            <button
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([exportDraft(draft)], { type: "application/json" }),
                );
                const link = document.createElement("a");
                link.href = url;
                link.download = `${draft.name.replace(/[^a-z0-9 -]/gi, "").trim() || "gravity-sky"}.json`;
                link.click();
                URL.revokeObjectURL(url);
                setNotice("Level JSON exported.");
              }}
            >
              Export JSON
            </button>
          </div>
          <p role="status" className="creator-note">
            {notice}
          </p>
          <button className="creator-popover-done" onClick={closePopup}>
            Done
          </button>
        </CreatorPopover>
      )}
      {popup?.kind === "name" && (
        <CreatorPopover title="Name your level" onClose={closePopup}>
          <label className="creator-name-label">
            Level name
            <input
              autoComplete="off"
              value={draft.name}
              maxLength={80}
              onChange={(e) =>
                setDraft((d) => ({ ...d, name: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") closePopup();
              }}
            />
          </label>
          <button className="creator-popover-done" onClick={closePopup}>
            Done
          </button>
        </CreatorPopover>
      )}
      {popup?.kind === "challenge" && (
        <CreatorPopover title="Choose a challenge" onClose={closePopup}>
          <div className="creator-objectives">
            {OBJECTIVES.map((o) => (
              <button
                key={o.kind}
                aria-pressed={draft.objective.kind === o.kind}
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    objective: {
                      ...d.objective,
                      kind: o.kind,
                      count: o.kind === "crowd" ? 2 : 1,
                    },
                  }))
                }
              >
                {o.label}
                <span aria-hidden="true">
                  {draft.objective.kind === o.kind && <Icon name="check" />}
                </span>
              </button>
            ))}
          </div>
          {draft.objective.kind === "paired" &&
            draft.bodies
              .filter((core) => core.kind === "attractor")
              .map((core, index) => (
                <Stepper
                  key={core.id}
                  label={`Core ${index + 1} planets`}
                  min={1}
                  max={8}
                  value={
                    draft.requirements?.find((goal) => goal.bodyId === core.id)
                      ?.count ?? 1
                  }
                  onChange={(count) =>
                    setDraft((d) => ({
                      ...d,
                      requirements: d.bodies
                        .filter((body) => body.kind === "attractor")
                        .map((body) => ({
                          bodyId: body.id,
                          count:
                            body.id === core.id
                              ? count
                              : (d.requirements?.find(
                                  (goal) => goal.bodyId === body.id,
                                )?.count ?? 1),
                        })),
                    }))
                  }
                />
              ))}
          {draft.objective.kind === "crowd" && (
            <Stepper
              label="Planets"
              value={draft.objective.count}
              min={2}
              max={6}
              onChange={(count) =>
                setDraft((d) => ({
                  ...d,
                  objective: { ...d.objective, count },
                }))
              }
            />
          )}
          {draft.objective.kind !== "none" && (
            <>
              <Stepper
                label="Revolutions"
                value={draft.objective.turns}
                min={1}
                max={3}
                onChange={(turns) =>
                  setDraft((d) => ({
                    ...d,
                    objective: { ...d.objective, turns },
                  }))
                }
              />
            </>
          )}
          <button className="creator-popover-done" onClick={closePopup}>
            Done
          </button>
        </CreatorPopover>
      )}
      {popup?.kind === "levels" && (
        <CreatorPopover title="In this browser" onClose={closePopup}>
          <p className="creator-note">
            Your draft saves automatically. Saved levels stay in this browser.
          </p>
          <button
            className="creator-new"
            onClick={() => {
              setPortable(exportDraft(draft));
              setPopup({ kind: "transfer" });
            }}
          >
            Import, export or share
          </button>
          <button
            className="creator-new"
            onClick={() => replaceDraft(newDraft())}
          >
            + New level
          </button>
          {library.length ? (
            <ul className="creator-library">
              {library.map((level) => (
                <li key={level.id}>
                  <button onClick={() => replaceDraft(level)}>
                    {level.name}
                    <small>{level.bodies.length} bodies</small>
                  </button>
                  <button
                    aria-label={`Delete ${level.name}`}
                    onClick={() => {
                      try {
                        setLibrary(deleteLevel(level.id));
                        if (level.id === draft.id) {
                          setDraft(newDraft());
                          setSelected("");
                        }
                        setNotice(`Deleted “${level.name}” from saved levels.`);
                      } catch {
                        setStorageError(
                          "Browser storage is unavailable. This level could not be deleted.",
                        );
                      }
                    }}
                  >
                    <Icon name="trash" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="creator-note">
              Save your first level to start a collection.
            </p>
          )}
        </CreatorPopover>
      )}
    </main>
  );
}
