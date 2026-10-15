# Gravity Rebuild Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for the simulation core. Interface and campaign workers consume the published types. Preserve the user's chosen same checkout execution.

**Goal:** Replace Gravity with an unrestricted, physically stable and colorful orbital puzzle simulation.

**Architecture:** A fixed step simulation owns physical state. GravityEngine adds playback, preview and lifecycle operations; injected level providers isolate campaign data and progress. Interface and creator adapters consume snapshots and launch methods.

**Tech Stack:** Existing TypeScript, React, Vite, Canvas2D and Vitest.

**Spec:** `docs/superpowers/specs/2026-10-14-gravity-rebuild.md`

## Global Constraints

- No commits, dependency installations, or parallel lints.
- Preserve current start screen and help work.
- Create the authorized reference inspired campaign; do not describe it as the original 45 levels or claim a community service exists.

## Review Focus

- Nonfinite launches must be rejected without affecting live state.
- Long lived and offscreen bound orbits must survive.
- Dense launches must retain existing planets and respect collision policy.
- Completion and retry must remain usable while the artwork moves.
- Prediction must account for existing planets without changing their live state.

### Task 1: Physics and simulation contract

**Files:** `src/gravity/types.ts`, `src/gravity/physics.ts`, `src/gravity/simulation.ts`, focused helpers, `tests/gravity/physics.test.ts`, `tests/gravity/simulation.test.ts`.
**Produces:** `fireFrom(state, position, velocity)`, `step(state, dt)`, normalized physics settings, orbit requirements and progress.

- [x] Add failing tests for mutual momentum, stable long orbits, free launch and 128 live planets, policy toggles, absorption and goals.
- [x] Run narrow Vitest files and confirm behavior fails against the old core.
- [x] Implement fixed step velocity Verlet, configurable mutual forces and collision policies, bounded trail memory and orbit tracking.
- [x] Run narrow tests and record results.

### Task 2: Engine and prediction

**Files:** `src/gravity/engine.ts`, `tests/gravity/engine.test.ts`.
**Consumes:** Task 1 simulation and types.
**Produces:** `launchFrom(position, velocity)`, `setLaunch(position, aim)`, `predictFrom(position, velocity, seconds)`, pause and playback controls, provider injection and legacy launch adapters.

- [x] Add failing tests for preview agreement, no mutation, playback geometry, pause and completion lifecycle.
- [x] Run narrow Vitest file and confirm missing behavior.
- [x] Implement engine APIs and latched completion with continued simulation.
- [x] Run core tests and hand the frozen API to interface and campaign workers.

### Task 3: Interface, campaign and verification handoff

**Files:** Owned by interface and campaign workers, outside core ownership.

- [ ] Consume core launch, prediction and playback APIs in gestures and settings.
- [ ] Integrate 45 new reference inspired authored levels and structurally varied procedural continuations, clearly labeled.
- [ ] Verify creator adapters and procedural provider separately.
- [ ] Root coordinates complete tests, typecheck and browser verification after integration.

## Core execution record

Tasks 1 and 2 implemented in the existing checkout without commits. Initial new behavior tests failed against the old core, then passed after implementation. Added followup red to green checks for kinematic well motion, provider navigation, swept elastic contacts and configured trail duration. Legacy physical scaling and active cap assertions were replaced with the newly authorized playback and unlimited launch contracts. Existing shared loop, wide local orbit, collision credit and living orbiter preservation tests remain in place.

Verification: `npx vitest run tests/gravity/rebuild.test.ts tests/gravity/physics.test.ts tests/gravity/simulation.test.ts tests/gravity/engine.test.ts`, 42 passed. `npx tsc -b --pretty false` passed before final formatting. Root owns final integration review and complete checks.
