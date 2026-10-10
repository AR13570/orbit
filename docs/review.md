# Independent review

Status: complete, no blocking findings. Reviewed 9 October 2026. Both P2 findings and the phase re-entry fix have been independently re-reviewed and verified.

## Active findings

None.

## Resolved findings

- Per-frame deep snapshot cloning: `src/game/engine.ts:98` now caches a detached and recursively frozen static sector. Independent assertions confirm repeated snapshots share body geometry and `solution.path`, nested static writes throw, mutable aim/powers/penalties/pending pickups/collected flags remain isolated, and advance/restart replace the cached geometry. Repeated reads no longer traverse or copy the solution path. The public snapshot contract now documents shared immutable geometry.
- Mobile touch target width: portrait header override and text-button minimum width are now 44px. Fresh read-only Playwright geometry checks at 320x568, 390x844 and 844x390 confirm every visible button is at least 44 by 44px and fully contained in the viewport. No page errors or document overflow.
- Phase re-entry: independently confirmed that a projectile can cross one obstacle, then crashes when returning to that same obstacle after exiting. The owner changed immunity cleanup before this confirmation. No permanent immunity remains in the tested case.

## Verification executed

- Read the implementation plan, engine/visual contracts, progress log, integration, renderer, CSS, controls, sound, physics, generator, engine, and current test coverage.
- Focused Node/Vite harness: 2,000 generated sectors across seeds 0 through 49, indices 0, 1, 12, 40 and 1,000,000, and eight initial origins including all four inset corners, center, and edges. Every ordinary-speed solution docked without a solid collision or leaving world bounds. Seven fallback boards were exercised. No body overlaps found.
- Focused Node/Vite harness: 10 seeds times 100 consecutive sectors, using each former checkpoint as the next origin. All 1,000 verified routes docked.
- After the snapshot fix, a fresh actual-engine harness completed 1,000 consecutive docks across 10 seeds and 100 sectors per run, carrying banked modifiers forward, recalculating selectable power, confirming former-checkpoint origins, and confirming new static geometry after every advance. No failures.
- Exact preview/live harness: 7,200 samples matched within 1e-8 world units across 100 volleys, including ordinary launches and combined charge, overdrive, multishot, phase, slow and scatter. Predictions left all 100 engine snapshots unchanged. All 100 corresponding verified powered/ordinary routes docked.
- Controlled state-machine harness: last-shield damage docking banks 125 points and one checkpoint without allowing advance; damage followed by collision loses only one shield; repeated retry adds no second charge and clears failed loot; multishot banks one pickup/reward and advances once; former checkpoint becomes next origin; phase same-rock re-entry crashes.
- Fresh local Playwright interaction pass: help first focus, forward/backward Tab trap, Space close and focus restoration; real landscape letterbox start rejection; pause button and launch guard; single-cost abort; three-shield exhaustion; game-over focus trap; restart; enabling sound and launch/failure tones. No browser page errors. A separate focused visibility check confirms hidden-document events pause, visible events require explicit resume, and help suppresses pause/abort shortcuts without spending a shield.
- Viewed integration-generated screenshots at 1440x1000, 390x844, 320x568 and 844x390. Composition, shaded body, uniform world geometry and control containment are intact. The visual owner subsequently increased marker and label visibility at small scales; reviewed code preserves the uniform world transform and physical collision geometry.
- Reviewed lifecycle cleanup: RAF cancellation, observer disconnection, visibility/key listener removal and audio close exist. Hidden documents pause and reset frame timing. Preview refresh occurs on retry and checkpoint advance. Sliders have native input semantics and avoid global shortcuts. Best-score reads/writes guard unavailable or invalid storage.
- Renderer background and body sprites cache by sector; decorative spark array caps at 90; particle trails cap at 180; DPR caps at 2. Sector generation occurs on restart/advance, not snapshot reads.

## Assessment

No blocking findings remain in this review. The resolved allocation, touch-target and phase issues have concrete independent verification. Final full-suite/build ownership remains with integration, and the orchestrator has inspected the screenshots.

## Verification boundaries

- Integration owns the final full test suite, production build and E2E suite. This review used focused harnesses and local browser interaction checks, without competing installs or lints.
- The first one-off letterbox assertion accidentally targeted the square portrait canvas and was discarded after confirming its geometry. Repeating against the actual landscape letterbox passed.
- An initial Aside guide request found no running daemon. Read-only Playwright checks succeeded with the permitted local browser escalation. Existing sandbox launch errors were environmental, not product defects.
- No implementation edits, dependency installation, lint, commit, push, publishing, agent spawning or cross-chat messaging performed. Only this review document was written.

## Declined to judge

None.
