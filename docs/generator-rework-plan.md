# Central Corridor Generator Implementation Plan

Status: completed and verified against frozen source. Final evidence is recorded below and in docs/redesign-progress.md.

> **For agentic workers:** Apply the existing delegated ownership task by task. Use superpowers:executing-plans for each owner's implementation. The human has approved this rework and execution method; no additional design approval or commits.

**Goal:** Replace the side-row generator with seeded spatial fields that put a substantial obstacle directly in the playable center and offer verified curved routes around it.

**Architecture:** Engine replaces the template/row proposal pipeline and its fallback. A seeded PRNG drives new positions, sizes, gravity kinds and nearby goal placement throughout the continuous index sequence, without modulo-five geometry; the actual shared assisted physics verifies ordinary angle/power candidates and publishes the successful trajectory. Integration consumes the resulting metadata through unchanged gesture APIs; renderer continues drawing engine geometry without layout assumptions.

**Tech Stack:** Existing TypeScript, React, Vite, Canvas2D, Vitest and Playwright.

**Spec:** Latest approved generator rework, recorded in docs/redesign-plan.md. Existing input/camera contracts remain in docs/engine-api.md and docs/visual-api.md.

## Global Constraints

- Same shared checkout and ownership boundaries. Engine owns src/game/**, tests/engine/** and docs/engine-api.md. Visual owns src/render/**, src/styles/**, tests/render/** and docs/visual-api.md. Integration owns app/help/README/E2E/current plans/progress.
- No engine/render implementation edits by integration. No controls, exact bottom hint, camera, goal appearance, lives, scores or control panels changed. Engine may strengthen goal attraction; ordinary-body force remains unchanged.
- Strengthen checkpoint attraction independently of its small visual size; preserve radius45 capture plus ship radius5 (actual50-unit contact), flagged electric-blue goal, one-piece initial launch and once-only in-flight split. Earlier18000/480/range8 goal tuning is superseded.
- Preserve unlimited retries, checkpoint retention, New seed, actual visible bounds and short one-path prediction.
- No commits, pushes, dependencies, worktrees, broad duplicate checks or lints. Main performs one full final unit/build/browser sequence after every owner freezes. Narrow browser checks use a temporary --output directory and preserve shared captures.

## Review Focus

- Repeating compositions: coarse launch-relative geometry must vary over long journeys, while identical seed/index/launch inputs remain reproducible.
- Empty center: a guaranteed substantial centerline body must exist in every generated field, including fallback and translated checkpoints.
- Unreachable center obstruction: successful routes must actually pass around it without collision; metadata must come from live-equivalent assisted physics at its published power.
- Disguised old rows: additional bodies must fill the playable spatial corridor rather than merely move paired side bands inward.
- Fixture fragility: browser gestures use actual solution.angle/power; rescue proof compares assisted and deliberately unassisted motion, not a memorized old seed42 angle.
- Integration regression: touch/desktop journeys, once-only split, free retries and visible-edge behavior must survive replacement generation.

## Task 1: Replace proposals and fallback (engine owner)

**Files:** src/game/generator.ts, src/game/composition.ts, src/game/certified-layouts.ts, src/game/engine.ts, src/game/physics.ts, tests/engine/generator.test.ts, tests/engine/physics.test.ts, relevant tests/engine/engine.test.ts and docs/engine-api.md. Ordinary-body physics stays unchanged; goal attraction is independently strengthened as explicitly authorized.

**Interfaces:** Preserve OrbitEngine constructor/launch/update/retry/advance/restart and publish any additive bounded history/context contract for generateSector and generateFallbackSector, Sector launch/checkpoint/bodies/bounds, and solution {angle,power,speed,flightSeconds,path}. Family/proposal metadata may reflect the new generator. Consumers must not assume speed240 or fixed route angles. Actual and reference engines must advance the same run history in order; never compare isolated direct generation against a context-dependent journey.

- [x] Add failing geometry tests: four to seven readable force-bearing bodies; at least one central body radius>=55 (the published substantial-body floor), center.y equal to launch.y within1e-6, and center.x between launch and goal with the published spawn/goal clearances. Its collision circle blocks the horizontal forward launch ray.
- [x] Add non-sparse spatial checks: additional mixed wells occupy the playable spatial corridor, not only side bands. Record the engine contract's corridor occupancy measurements. Goal remains forward and near the corridor. Keep existing positive body/goal/launch clearance requirements; do not shrink collisions to manufacture a route.
- [x] Add goal-force tests proving strong inward rescue beyond the historical80-unit miss, exact zero at center, smooth finite range/softening, bounded combined acceleration and unchanged50-unit docking contact. Use identical force for live flight, prediction, every split piece and generation validation. Goal tuning targets the newly published strong-pull evidence rather than freezing historical coefficients.
- [x] Add a30-field coarse anti-repeat regression: normalize positions by launch, use the published coarse descriptor (currently80-unit position bins and16-unit radius bins), include gravity kind, sort independently of IDs, and quantize goal position using the same published80-unit bins. Record distinct full/body-only fingerprints and lag-five similarities, alongside changes in major geometry, size mix, clusters, attraction/repulsion balance and goal placement. Validate bounded recent-layout rejection using the published compositionDistance threshold1.2, separate geometry-and-size floor0.75, and six-layout history cap. Changing only kinds or goal position cannot satisfy the geometry floor; fingerprint uniqueness alone is insufficient. Exclude seed/index/IDs/global translation from fingerprints. Repeat the same inputs for exact reproducibility; inspect a second fixed seed for different compositions.
- [x] Replace row/family geometry construction with PRNG-driven seeded spatial placement and bounded rejection for clearance. Randomness must materially vary major geometry, positions, sizes, clusters, gravity balance and goal location over the continuous journey, not select five templates plus jitter. Use bounded recent-composition similarity rejection; history is the published last six accepted descriptors, candidate retries are bounded, and New seed resets history. Identical replays must reproduce composition rejection and accepted geometry. Retain mixed attractive/repulsive objects with coherent room above/below the central obstruction. Do not derive the central object by shifting an old side row.
- [x] Search bounded ordinary angle/power candidates using shared goal-assisted stepping with the new strong pull and collision/escape rules. Require a route past the central object's forward edge, plus neighboring valid shots; publish actual assisted contact path/time and matching launchSpeed(power).
- [x] Replace fallback with an independently bounded set of genuinely distinct, populated central-obstruction layouts satisfying the same geometry, recent-freshness, neighbor-route and assisted verification requirements. Apply transforms relative to launch, including negative/large coordinates.
- [x] Run isolated engine tests/type checks and a deterministic multi-seed/translated sample. Record central-body presence, corridor population, minimum clearance, capture success, power range, fallback behavior and bounded search evidence. Freeze source before integration browser checks.

## Task 2: Update copy and integration assumptions (integration owner)

**Files:** src/components/Help.tsx, README.md, docs/redesign-plan.md, docs/redesign-progress.md, tests/e2e/game.spec.ts only as required. App/controls remain unchanged.

**Interfaces:** Read current sector.solution.angle/power for meaningful shots, launchSpeed(power) for reference simulations, and renderer-derived visibleWorldBounds. No product test hooks.

- [x] Explain curving around central obstacles toward the attracting flagged checkpoint. Remove the shifted-side-row description from the current brief.
- [x] Audit every journey/touch/reference shot for fixed240speed, old row coordinates or fixed goal angle. Keep deliberate leftward miss/visible-edge fixtures where their intent is independent of generation.
- [x] Preserve the near-miss rescue proof: select a deterministic real generated angle/power that captures with goal attraction and misses without it. If seed42 no longer provides that case, use a bounded fixed seed/candidate list and record the chosen seed in the browser URL. Require an unobstructed unassisted pass that misses by at least120units (beyond the historical80-unit baseline), then actual physical contact with the new strong pull. Never remove the counterfactual or reduce the capture assertion.
- [x] After engine and visual freeze, run only affected narrow browser checks as needed with temporary output. Verify real drag release, initial prediction parity and checkpoint advance; retain all desktop/touch/split/free-play tests for main's full sequence.
- [x] Record agreed verification evidence and freeze integration. No broad duplicate build, suite or lints.

## Task 3: Final verification and review (main)

- [x] Run one full unit suite, production build and complete browser suite against frozen source.
- [x] Inspect desktop and phone scenes: obvious central obstruction before release, visible curved route, coherent mixed wells and readable flagged blue goal. Inspect initial/checkpoint1/checkpoint2 compositions; engine tests independently cover certified fallback clearance, routes and recent freshness.
- [x] Confirm real mouse/touch progression, single launch plus once-only split, more than three missed shots retaining progress, cancellation/resize and true visible-edge failures.
- [x] Record fresh results and captures in progress/review docs; leave server running. No commit or push.

## Generator-rework evidence before challenge correction

Main ran the single frozen-source sequence:99/99 unit tests across8 files in2.01s; production build passed (266.72kB JS /86.02kB gzip,5.64kB CSS); all15 single-worker browser scenarios passed in45.1s, with output at /private/tmp/orbit-final-generator-rework-browser. No duplicate broad run was performed by integration.

The real-gesture strong-goal fixture uses seed42, angle-0.25 and power0.624. Without goal force it misses by179.0947 world units; with the new force it captures the unchanged50-unit contact boundary. Initial assisted prediction, mouse/touch split, sequential journeys, unlimited retries, resize and actual visible-edge behavior pass.

Main inspected fresh desktop initial/checkpoint1/checkpoint2 captures and320/390px phone views: different body arrangements/count/occupancy, a substantial centerline well, clear blue checkpoint flag/rings and no edge-cue overwrite. Source remains frozen. No commits.

## Completed challenge correction

Implementation and frozen-source automated verification are complete. The capture-readiness follow-up is verified and main's final visual sign-off passed.


The generator rework above is complete. This follow-up rejects high-power shots aimed near the goal that bypass the intended challenge, while preserving a forgiving route that meaningfully uses obstacle gravity. Strong goal attraction, collision/contact radii, controls and UI remain unchanged.

- [x] Engine adds failing regressions for the published near-goal/high-power shortcut sweep. Published sweep: goal-bearing offsets0,±0.025,±0.05 at powers0.80,0.85,0.90,0.95,1.00. Every probe must positively collide under actual assisted physics; escape, timeout or docking rejects the layout. A visually central obstacle alone is insufficient.
- [x] Engine preserves an ordinary successful route and its useful angle/power neighbors. Its published body-gravity counterfactual keeps solid collisions and goal pull intact, and must positively collide, so the validation measures dependence on obstacle gravity rather than deleting the obstacles or relying on escape/timeout.
- [x] Engine applies the identical challenge predicates to primary generation, seed-varying backups and every emergency certificate. Replace/revalidate certificates as required while retaining bounded search, fresh compositions, deterministic replay and safe continuous progression.
- [x] Integration audits current published metadata/API after the contract lands. Adapt only genuinely invalid fixture assumptions; keep real desktop/touch journeys, once-only split, unlimited retries, visible-edge parity, initial prediction and the explicit assisted/unassisted near-miss proof. No App/control/UI changes.
- [x] After source freeze, run only necessary affected focused checks, using temporary browser output. Main owns one final full unit/build/browser sequence and final captures. Record evidence and coordinate the integration source/test freeze. No broad duplicates, parallel lints, commits or worktrees.

## Challenge verification evidence

Main verified frozen source:105/105 unit tests across9 files in1.77s; production build passed (269.25kB JS /86.88kB gzip,5.64kB CSS). After restarting the stopped preview server, all15 single-worker browser scenarios passed in45.8s. Output: /private/tmp/orbit-final-challenge-browser-ready. Integration performed no duplicate broad run.

Engine measured48 consecutive primary fields across seeds1,7,42 and indices0–15 with continuous checkpoint/recent-layout history, with zero fallbacks. Eight forced emergency backups and three direct random backups brought the sample to59 fields: all295 solution/neighborhood shots docked, all59 body-force-removed solutions collided, and all4,779 dense high-power probes collided, with no cheap captures or unresolved probes. The dense sweep used nine powers0.80–1.00 at0.025 intervals and nine angle offsets-0.05–+0.05 at0.0125 intervals, without canonical-edge termination and with a conservative22-second cap. The48 primary fields retained48 unique coarse compositions and both freshness floors. Exact engine evidence is in docs/engine-api.md.

The current real-gesture goal-rescue fixture uses seed137, angle-0.53 and power0.6000000000000001. The unassisted clear pass misses by122.32413184572555 world units; the assisted shot captures with initial prediction parity. This supersedes the earlier seed42 fixture above.

Final visual QA is pending: the fresh320x568 screenshot is black except for the DOM HUD/hint. Desktop,390px portrait, landscape and goal prediction captures are correct according to main. The visual owner is investigating narrowly. Passing browser assertions do not close this visual discrepancy. No further integration tests or product edits were made.

### Focused canvas-capture follow-up

The visual owner reproduced the original black320x568 PNG, then obtained three correctly painted fresh captures without errors, warnings or overflow. A likely resize/first-frame capture race exposed that the old readiness helper checked only DOM status. Integration added a screenshot-only polling check for the actual opaque ground color at all four canvas corners, without a fixed delay or product-source change.

Only the four full-viewport release scenarios were rerun:4/4 passed in3.0s, temporary Playwright output /private/tmp/orbit-final-viewport-painted. Chromium initially could not launch under the sandbox; the authorized run outside it passed. The regenerated viewport PNGs remain in test-results/redesign-{width}x{height}.png. Integration visually inspected the fresh320x568 PNG: ground, mixed bodies, launcher, blue flagged goal and DOM HUD/hint render correctly. Main inspected the final PNG and confirmed the complete field, goal, launcher and wrapped hint render correctly. Final visual QA passed, including desktop initial/checkpoint1/checkpoint2,390px portrait,844px landscape, curved preview and goal capture. No broad tests were repeated.

Final status: challenge correction, automated verification, focused capture-readiness follow-up and final visual QA are COMPLETE. Main reviewed the focused4/4 output and final captures. No further checks or product changes.
