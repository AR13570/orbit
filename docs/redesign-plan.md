# Orbit current redesign plan

This is the current brief. Earlier generator plans and entries in redesign-progress.md are historical; the mandatory giant center blocker and universal80/100-unit bend claims are superseded. Exact current engine and renderer contracts remain in engine-api.md and visual-api.md.

## Current experience

One minimalist full-viewport gravity field advances automatically between checkpoints. Uniform cool-gray ground, weighted charcoal/slate discs, centered circular distance-faded wave relief, radius-dependent spacing, blue attraction, rust repulsion and violet aiming dots provide the visual language. The electric-blue flagged goal attracts independently of its small45-world-unit ring. With the ship radius5, actual capture contact remains50units. The persistent HUD contains tiny checkpoint progress and adjacent44px safe-area reset/pause targets. There are no lives, scores, inventory, power-ups, dashboard panels or separate launch controls.

## Twenty structural families

Twenty actual grammars define grouping, ordering, gaps, occupied regions and goal relations. They include open slalom gates, separated clusters and stepped shelves, alongside varied geometric arrangements such as sparse anchors, binaries, fans, pockets and banks. Fields contain three to eight mixed force-bearing solids, with no body exceeding radius104. A universal dominant central circle is no longer required.

Seventeen grammars use a distributed geometric capture-aperture obstruction proving at least70units of bend from the actual launch-to-contact chord. The three open grammars use bounded empirical dynamics screening, including adaptive refinement around shallow captures. Their finite sampled validation does not establish a continuous guarantee. Generated metadata honestly publishes geometric or sampled validation. All families preserve the ordinary successful route and four tolerated angle/power neighbors, unchanged physical forces and collision/contact sizes. See engine-api.md for exact grids, budgets, evidence and limitations.

Seeded selection, group variation and family-preserving randomized/certified backups produce reproducible journeys. Six-layout recent history rejects repeated families, similar compositions and similar geometry/size. Backups retain the selected structure and freshness; a finite certificate pool does not promise unique layouts forever. Actual solution.angle/power metadata drives verification, never a fixed launch speed or a displayed answer route.

## Gestures and reset

Anywhere-drag anchors at pointer-down and fires opposite the delta on release after at least8CSSpx. Full power is160CSSpx on desktop and120 on touch/mobile. A small tap cancels. Capture and pointer identity isolate extra fingers. Pointercancel, lost active capture, resize/orientation, Escape/P, pause/help and hidden tabs cancel held gestures safely. Release checks geometry and DPR synchronously.

Two true small taps while aiming select single or split mode. Each tap lasts at most250ms, stays below8px maximum travel, and pairs within300ms and24px. Every release launches one projectile with one preview path. In split mode, one valid short in-flight tap branches into three around the current tangent at plus/minus3degrees. Dragged/held/cancelled/stale/extra-pointer taps cannot branch. Single-mode flight taps do nothing. Mode persists across reset, checkpoints and New seed.

The exact transient hint remains: “Pull back. Release to fly. Double tap to change shoot modes.” Held pulls freeze the camera; flight taps do not. Zero tension predicts with power0. Preview stays short and cached after aim changes.

The top replay icon, R and pause-menu Reset shot share current-checkpoint retry behavior: cancel capture/preview, retry flying/failed shots, clear the feedback clock and resume/focus the canvas. Aiming reset cancels the held pull. Seed, layout, checkpoint count and mode stay intact. R ignores repeats, composition, editable targets and modifier shortcuts; Help retains its keyboard boundary. During docked feedback reset is disabled and R ignored, leaving the once-only advance untouched. New seed alone creates a fresh run and resets checkpoint progress.

## Offscreen flight, pause and transitions

Gravity, swept collision and docking continue beyond the actual displayed viewport. A circle overlapping the rectangle is still visible. Each fully outside piece has six continuous active seconds to return; re-entry resets its timer. Repeated bounds injection preserves elapsed time, and branching outside inherits elapsed time. Only expired pieces die; all-lost triggers an unlimited free retry at the same checkpoint. There is no overall on-screen lifetime.

A quiet bottom “Offscreen · Ns” cue appears only when every live piece is outside and shows the ceiling of the longest remaining time. Dead pieces do not influence it. Return hides it; the accessible status stays stable across numeric countdown changes. Pause/help/hidden stop simulation and the countdown. Returning from a hidden tab requires manual resume.

Dock and failure feedback last650ms of active time before one advance or retry. Pause/help stop the feedback clock. Menus manage focus; Escape/P controls pause. Sound unlocks only through user action and is optional.

## Camera

Uniform camera scale preserves circular bodies. Desktop/landscape fit the field. Portrait begins with close framing, expanding and centering when necessary to include the launcher and complete goal circle with margin. Follow tracking shares that scale; held aiming locks camera motion. Reduced motion snaps transitions. Every frame prepares the displayed camera before physics and injects its actual visible rectangle. Canonical generation bounds are not runtime failure limits.

The seed4 portrait checkpoint-1 regression reads actual blue goal pixels after settled progression, asserting a complete circular ring and viewport margins, then saves a screenshot. The open-shelves landscape case verifies a real metadata-based mouse docking and saves the initial layout.

## Final frozen-source verification

Serial final execution passed237/237 unit tests across14 files in14.74s with two workers, then production build (289.97kB JS /93.69kB gzip,8.23kB CSS), then all21 single-worker browser scenarios in1.6minutes. Browser output: /private/tmp/orbit-final-structures-camera-browser. No final suite was duplicated. Main's earlier manual IAB evidence covered four intended routes and five failed direct shots; main's final-build IAB spot check passed.

Port5173 serves index-Brrkncts.js; fetched JavaScript exactly matches the built asset. Preview session54448 remains running. The final opening-seed map still covers all20 family IDs by seed42, including slalom5, clusters28, shelves21, sparse4, hairpin1 and horseshoe19. URLs and separate solution metadata are in /private/tmp/orbit-opening-family-urls.json.

Integration inspected final test-results/redesign-portrait-complete-goal.png (390x844, seed4, checkpoint1, full goal visible) and test-results/redesign-open-shelves-landscape.png (844x390, seed21). Existing journeys, five misses, reset/R, mouse/touch split, offscreen timeout/freeze/re-entry and goal-assistance/prediction assertions all pass. The current assistance fixture is seed7, angle0.4018414979268322, power0.6, unassisted clear-pass miss254.23424702129418units. Genuine re-entry uses seed42, angle-1.2, power0.8.

## Ownership and constraints

Engine owns src/game, tests/engine and engine-api.md. Visual owns src/render, src/styles, tests/render and visual-api.md; the authorized reset feature also changed shared HUD styles. Integration owns App/components/controls and app/E2E tests/current docs. Reviewer owns redesign-review.md. Preserve React, TypeScript, Vite and Canvas2D with no new dependencies. No commits, pushes, publishing, worktrees or parallel lints.

Final main/reviewer sign-off: seed4 at390x844 docks and advances to checkpoint1 with the complete goal visible and about32CSSpx right margin; it remains visible at320x568. Seed21's intended rounded drag docks while the direct full-power goal shot fails. The viewport override was reset, and the browser reported no warnings/errors. Reviewer confirmed final hashes, docs and evidence resolved. Source, tests and current documentation are frozen. No further checks or product edits.
