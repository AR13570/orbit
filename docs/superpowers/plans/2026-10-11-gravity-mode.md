# Gravity Mode Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task with tests first. Execution is authorized by the user's explicit request to implement. Do not commit.

**Goal:** Add playable, endlessly generated orbital puzzles alongside Zen.

**Architecture:** Isolated Gravity simulation, generator, renderer and React screen. Share existing input and drawing primitives where useful, and connect both modes through a root chooser.

**Tech Stack:** Existing TypeScript, React, Canvas2D, Vitest.

**Spec:** docs/superpowers/specs/2026-10-11-gravity-design.md

## Global Constraints

- Preserve the existing Zen engine, generator and behavior.
- No new dependencies, commits or pushes.
- Leave the shared browser and server untouched.
- No em dashes in generated text.

## Review Focus

- Fast shots cannot tunnel through bodies or earn phantom loops.
- Failed projectiles cannot retain objective credit.
- Pause, resize and second pointers cannot release a held shot.
- Completion advances once; skipping does not count as completion.
- Generation stays bounded, reproducible and playable beyond 100 levels.

### Task 1: Simulation and goals

Files: src/gravity/types.ts, simulation.ts; tests/gravity/simulation.test.ts.
Interface: GravityLevel, GravityParticle, GravityState; createState(level, interaction), fire(state, aim), step(state, dt), goalProgress(state).

- [x] Write tests for stable orbits, simultaneous goals, direction reversal, swept collisions, mutual gravity, expiring trails, dead-particle credit and population bounds.
- [x] Run failing tests, implement fixed-step simulation and goal tracking, rerun tests.

### Task 2: Validated procedural sequence and engine

Files: src/gravity/generator.ts, engine.ts; tests/gravity/generator.test.ts, engine.test.ts.
Interface: generateGravityLevel(seed, index, interaction); GravityEngine snapshot, update, launch, predict, retry, skip, advance, setInteraction.

- [x] Write tests for deterministic layouts, witness completion over 100 levels, varied families, interaction settings, retry/skip/advance and snapshots.
- [x] Run failing tests, implement constrained generation using simulation-validated witnesses and bounded attempts, rerun tests.

### Task 3: Renderer, mobile controls and mode selection

Files: src/gravity/renderer.ts, GravityGame.tsx, src/ModeChooser.tsx, App.tsx, components/PauseMenu.tsx, styles/global.css; tests/gravity/interface.test.tsx and renderer.test.ts.
Interface: independent Gravity screen with onExit; default App is the mode chooser, named ZenGame preserves existing screen and tests.

- [x] Write tests for mode choice, repeat launches, pause cancellation, retry, skip, interaction setting, safe resize and completion timing.
- [x] Implement fixed-field rendering with existing body/field visuals, fading colored trails, orbital progress, short preview and launcher feedback.
- [x] Connect accessible chooser and menus, keep seeded direct mode links for reproducible review.
- [x] Run full test suite with a timeout suitable for existing long simulations and run production build.
- [x] Review diff and document verification and limitations. No browser/server changes.

## Verification and review

Implemented and integrated into the shared checkout without touching concurrent README or deployment work. Zen's engine, physics and procedural layout generator are unchanged.

- `npm test -- --testTimeout=60000`: 264 tests passed in 19 files. The extended timeout accommodates the existing 144-checkpoint Zen simulation, which timed out at the default 5 seconds in the baseline.
- `npm run build`: passed.
- `git diff --check`: passed.
- Generator tests replay 120 consecutive levels, 36 interaction-enabled early puzzles, and 48 distant-level/seed-boundary cases using real simulation witnesses.
- Independent read-only review found living-particle eviction and overly broad paired-orbit credit. Both were reproduced with failing tests and fixed. Active palette reuse was also reproduced and fixed.
- Browser playtesting, physical touch-device behavior, visual layout, audio and assistive-technology behavior remain unverified. The shared browser and server were left alone.
- No commits or pushes.

## Follow-up: faster motion, orbit counting and procedural generation

- Gravity launch velocities now run at 1.6 times the original speed; body and mutual gravity scale by 2.56. Generation and previews use the same tuned physics. Shared Zen physics stays unchanged.
- Revolution tracking retains angular progress through wide and elliptical paths. Separate-body goals classify completed laps by angular travel around neighboring bodies and replace previous local capture credit when a projectile moves to another body.
- Objectives are shuffled from level one. Removed the fixed introductory sequence and preset fallback layouts. Procedural candidates use wider randomized placements and zero to two repellers, retained only when they delay the validated solution by at least 0.5 seconds. Candidate retries stay bounded at 24.
- Added regression coverage for wide and elliptical loops, sustained faster orbits, wide local captures, shared loops, stale paired credit and randomized initial objectives. Completion UI tests replay the full generated solution sequence.
- Verification: 32 Gravity tests and 271 total tests passed; production build and diff whitespace checks passed.
- Additional generation audit: 1,200 puzzles across seeds 0 to 99, all five objective families and both interaction settings completed their simulated witnesses. Maximum measured generation time was 23 ms, with all five objective families represented. Obstacle counts may range from zero to two, and an obstacle is retained only when it delays the verified solution by at least 0.5 seconds.
- The requested separate chat, Add fading tails to Zen, completed normal-game fading tails in this same checkout. Its changes are included in the final full-suite verification.
- No commits or pushes.

## Follow-up: remove vague goals and unhelpful obstacles

- Removed the inner and outer orbit family and its unused radius tracking. Gravity now shuffles five objective families.
- Repeller candidates are sampled near orbital paths. Each is added only if the same verified launch sequence still solves the puzzle and takes at least 0.5 seconds longer than the unobstructed layout.
- Added a deterministic generation check across 80 seed/level/interaction combinations to confirm every included repeller changes solution time by the required amount.
- No commits or pushes.
