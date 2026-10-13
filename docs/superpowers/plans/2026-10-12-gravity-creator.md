# Gravity Creator Implementation Plan

> Implement inline in the shared checkout, as requested. No commits or server restart.

**Goal:** Let players design, save and play their own Gravity puzzles.

**Architecture:** A dedicated Creator screen edits bounded level data, then opens the existing Gravity game with a custom level. Custom playtests retain their layout and return to the editor instead of advancing into generated levels. Drafts and saved levels stay in browser storage, as requested.

**Tech stack:** Existing React, TypeScript, SVG and Canvas2D. No dependencies.

## Design

Keep the game's cool gray, charcoal, blue and rust palette and Avenir typography. The SVG canvas fills the editor, with floating attractor, repeller, move and library tools. Select a placement tool and tap the canvas to add a body. Selecting an existing body reveals independent Size and Gravity drag handles, with screen-sized touch targets and keyboard alternatives. Dragging Size preserves gravity strength; dragging Gravity preserves body size. The gravity ring indicates relative strength rather than a hard cutoff in the field.

Right-click, long-press or tap the selected object's actions button to duplicate, change type or remove it. Challenge selection, naming and browser saves use dismissible popovers instead of a persistent form. The five current objectives remain available; paired and tour require appropriate attractive bodies. Invalid overlaps, missing bodies and malformed stored data get clear messages. Custom puzzles are playtested by their authors, without a claim of automatic solvability.

## Tasks

- [x] Add normalized custom level data, layout validation, draft/library browser storage.
- [x] Allow the Gravity engine and screen to play a supplied custom level, retry after completion and return to editing.
- [x] Build the editor, object controls, local library and chooser entry.
- [x] Replace the form with a canvas, floating tools, object actions and independent size/gravity dragging.
- [x] Preserve independent strength through browser saves and custom playtests, including legacy draft normalization.
- [x] Verify malformed inputs, persistence, custom-level lifecycle, pointer editing and playtest return, then run the full suite and build.

## Constraints

- Preserve concurrent changes and the existing Zen game.
- No backend, dependencies, commits or pushes.
- Do not start or restart the dev server; use an existing preview when available.
- No em dashes.

## Verification

Full suite: 292 tests passed across 22 files. Production build and whitespace checks passed. Automated coverage includes independent size/strength physics and persistence, placement, duplication, object actions, long-press, secondary-touch cancellation, rectangular field mapping, edge resizing, keyboard controls, popover toggles, invalid layouts, custom engine completion/retry, and editor playtest return.

The existing in-app browser preview was reachable. Verified the canvas editor at its desktop size, 390 × 844 portrait, 844 × 390 landscape, and 568 × 320 landscape. Checked actual resizing, independent gravity adjustment, right-click actions, popover toggling, and minimum-strength handle separation. Restored the user's draft values and reset the viewport override. No console warnings or errors were observed. No server was started or restarted by this task. Physical touch testing remains unverified.

Latest steering: removed projectile interaction from Gravity and Creator, including mutual forces, state, settings and generator variants. Legacy stored interaction fields are ignored. Review regressions for ordinary coordinate typing and deleted-level resurrection pass.

The mode URL follows the selected screen so reloading the creator restores the editor and its saved draft.
