# Campaign-based endless Gravity

**Goal:** Continue after Level 45 using the rebuilt campaign's mechanics and geometry, with deterministic variation and verified solutions.

**Design:** Use all 45 campaign structures, promoting introductory stages with advanced goals. Alternate local, shared and relay families so every six stages contains all three. Preserve opposing shared goals, moving cores and transfer captures. Three global difficulty bands add at most two orbital turns (capped at three total, with lower verified ceilings in chaotic fields) and modestly increase curved relay sweeps. Keep small populations and untimed goals.

**Implementation:** Keep legacy formation helpers only for physics regression fixtures. Route the runtime generator through a new campaign-based provider. Record robust solutions for each template and difficulty band offline. Transform positions, velocities, directional requirements and well motion consistently for seeded rotations and reflections. Try bounded geometry/force variation with a verified witness, then use the same template and difficulty without perturbation if needed. Never substitute an easier goal.

- [x] Add failing tests for family rotation, relay/shared semantics and deterministic generation.
- [x] Implement template provider, bounded difficulty and offline solution authoring.
- [x] Update generator and responsive HUD framing for procedural campaign challenges.
- [x] Verify every template and band at calibrated mobile/desktop sizes, half physics steps and removal bounds.
- [x] Run browser replays and actual mouse/touch launches of generated local, shared and relay stages.
- [x] Have the gamer review, fix criticisms, re-review, then commit and push once all checks pass.
