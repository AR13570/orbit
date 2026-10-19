# Stable Gravity Implementation Plan

> For agentic workers: use focused subagents where useful; preserve the user's explicit implementation authorization. No commits.

**Goal:** Make Gravity forgiving and sustainably solvable, with responsive aiming and physically understandable particle encounters.
**Architecture:** Keep the existing fixed-step simulation and shared predictor. Separate close-contact tuning, campaign authoring/verification, and live aiming feedback. Integrate approved core presentation without changing force strength.
**Tech Stack:** TypeScript, React, Canvas, Vitest, Vite, existing browser automation.
**Spec:** docs/superpowers/specs/2026-10-18-stable-gravity.md

## Global constraints

Preserve latched wins. Minimum two full revolutions. Interaction on/grouping off. Sequential launches. No automatic snapping or blanket drag. No emoji icons, no em dashes, no parallel lints, no commit/push.

## Review focus

Fast glancing and unequal-mass impacts must separate rather than stick. Prediction must stay live under dense moving systems. Pause/cancel/zoom must restore normal playback and suppress false haptics. Campaign proof must not stop at the first success frame. Minimum-size core labels must remain legible without masking physical collisions.

### Task 1: Particle encounters

- [ ] Add regression tests for softened near-field gravity, momentum conservation, slow capture, fast/glancing separation and unequal masses.
- [ ] Tune pair softening and contact energy dissipation. Retain surface support only for physically bound, slow contacts.
- [ ] Run focused physics tests and report numerical tradeoffs.

### Task 2: Stable sequential campaign

- [ ] Replace old flyby campaign with reviewed spatial structures, using population variants for 45 levels.
- [ ] Enforce two full orbits on all orbit objectives; keep the engine's completion latch.
- [ ] Build deterministic sequential witnesses and long-term stability/tolerance validation with current particle forces and UI sizes.
- [ ] Extend procedural generation using validated structures, with increasing population demand rather than nominal rotated variants.

### Task 3: Live aiming feedback

- [ ] Test and implement aiming slowdown and robust release/cancel restoration.
- [ ] Add feature-detected mobile haptics to valid aim start and successful launch in both modes.
- [ ] Smooth, continuously refresh full-path prediction against moving particles while retaining frame budgets and preview/play agreement.

### Task 4: Presentation, integration and release verification

- [ ] Apply approved core symbols/count styling, with no labels or fractions.
- [ ] Integrate all tasks, update relevant docs and fixtures, and run affected unit tests plus production build.
- [ ] Test desktop and mobile gameplay, settings, sequential launch, preview, pause, countdown and procedural progression in the browser.
- [ ] Independent review, fix material findings, then leave changes uncommitted for user testing.

## Final independent player review follow-up

The final reviewers found gaps after the first integration pass:

- Seven single-particle Deep stages were exact time-rescaled versions of Gentle stages. A changed spatial force profile must pass verification before replacing them.
- The final eight stages repeated single-core three-particle play. Reorder the campaign to interleave existing shared and local arrangements and finish on a shared challenge. Reindex witness data together with the campaign.
- Shield/Crown repeller influence is weak on the recorded orbit. Strength changes are experiments and must not ship without stable witnesses.
- A separate pure-thinking grid passed 324/360 cases, with 36 losses across 16 levels and nine before completion. The earlier mixed perturbation case did not cover pure delay5. Add pure delay3 and delay5 at radius/mass4/1,6/1,8/4,32/4 to the permanent proof protocol.

Use isolated physics/profile experiments. Preserve genuine mutual attraction, momentum, independent optional grouping and permanent completion. Reauthor timing-sensitive witnesses if needed. Then rerun the expanded proof, browser sequential controls and focused regressions, and ask the reviewers again. No commit or push is authorized.
