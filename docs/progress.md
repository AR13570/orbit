> Historical initial implementation. Superseded by docs/redesign-plan.md and docs/redesign-progress.md.

# Integration progress

- Scaffold started. Node v24.14.0, npm 11.9.0 available.
- Waiting for docs/engine-api.md and docs/visual-api.md before binding React to shared APIs.
- Integration alone owns dependency installs and full build/test commands.

- Dependencies installed successfully with sandbox network escalation: React 19, Vite 8, TypeScript, Vitest 5, Testing Library, Playwright. Audit reports zero vulnerabilities.
- Frozen shared APIs consumed. Preview explicitly uses 1.6 seconds and caches on aim/state changes.
- Implemented semantic HUD, single captured pointer, explicit launch, keyboard guards, pause on hidden document, accessible focus-trapped help, shield-cost abort label, safe best-score storage, optional user-enabled WebAudio.
- Input and safe storage tests: 4 passing. App tests authored first; execution currently blocked by engine implementation not yet present.
- Visual request: please verify .game-canvas touch-action:none, mobile header button widths with text labels Sound off / Help / Pause, and flight-deck no overflow at 390x844 and 844x390. App follows published classes exactly.
- Regression check proved pause shortcut was initially ignored after a button click. Updated keyboard guards so P/M/R remain available from buttons while native Space/Enter behavior stays intact. Input/slider shortcuts remain untouched. Controls: 4/4 pass.
- Renderer/CSS owner request: current CSS reduces some mobile controls below 44px (.text-button 35/31/32 and landscape ranges 35/30, icon-button 38). Please preserve the approved minimum 44px touch targets while fitting short landscape.
- Chromium installed successfully for browser QA. Local dev server requires sandbox escalation because sandbox denies listening on 0.0.0.0:5173; escalated server launch requested.
- First build run accurately reports only missing src/game/engine.ts and src/render/renderer.ts, which owners are still implementing. No integration type errors reported yet.
- Header now uses compact SVG icons with accessible sound/help/pause labels.
- Letterbox aim starts rejected against canonical bounds before pointer capture. Regression test initially failed then passed. Controls now 5/5 passing.
- Added focus-managed game-over dialog with final score and restart action. Component test passes.
- Formatted only integration-owned TS/JSX/tests/config files with Prettier. Exact package versions are pinned and package-lock updated.
- Dev server running: http://localhost:5173/ and http://192.168.178.189:5173/ (session 51381).
- Full suite attempted while engine stub exists: 12 pass, 13 fail. All failures are engine stub getSnapshot/state access; app tests fail for same unavailable engine. Will rerun after engine implementation lands. Build was not run after failed suite because command was sequential.
- Added shareable deterministic run URLs (?seed=42) with finite safe integer validation and regression coverage. This is normal replay behavior, not a global test hook.
- Expanded E2E to 320x568, viewport containment of main controls, and an actual verified UI slider flight, docking and Continue to sector 02. Waiting on engine implementation before executing.
- Production build succeeds, but this does not prove playability while the engine stub remains. Full suite remains blocked by that stub.
- Real engine arrived. Full unit suite: 26/26 pass across six files. Production build passes (259.33 kB JS, 81.98 kB gzip at this checkpoint).
- First browser attempt failed before any page launched because macOS sandbox denies Chromium MachPort rendezvous. Retrying with sandbox escalation; this is an environment launch restriction, not app failure.
- Browser results in progress: desktop 1440x1000 and landscape 844x390 pass; actual seed-42 flight docks and Continue reaches sector 02. Portrait 390x844 and 320x568 fail because header Help/Pause widths are 40px, below approved 44px. VISUAL OWNER REQUEST: `.header-actions .icon-button` portrait min-width:40px must become 44px. Height already 44px. Keep total header fitting 320px.
- Available initial screenshots: test-results/orbit-1440x1000.png, test-results/orbit-844x390.png, test-results/orbit-docked.png.
- Visually inspected desktop and landscape screenshots: premium ink/mint composition, readable gold docking and planet shading, entire uniform world visible. Desktop board letterboxes correctly and compact landscape keeps main controls visible. No visual clipping in those inspected images.
- E2E keyboard test corrected to focus gameplay before Space. Space on a focused Pause button correctly follows native button activation, so the old test expectation was wrong; P shortcut itself already passes.
- Browser rerun after visual owner target fix: 6/6 PASS. Sizes 1440x1000, 390x844, 320x568, 844x390 all pass document bounds, visible/contained 44px header/main controls, launch/abort/shield reset/help, and no page errors. Real seed-42 launch reaches dock and Continue advances exactly to sector 02. Pointer release preserves aiming; pause blocks launch; keyboard P/Space verified from appropriate focus.
- Final screenshot paths available: test-results/orbit-1440x1000.png, test-results/orbit-390x844.png, test-results/orbit-320x568.png, test-results/orbit-844x390.png, test-results/orbit-docked.png.
- Visually inspected final 390x844 and 320x568 screenshots: full world, score/shields, aim controls, launch and status are readable and contained. 320px gives the world less space but remains playable.
- Final accessibility review: secondary text buttons may have 44px height but intrinsic widths under 44px. VISUAL OWNER REQUEST: `.text-button` needs min-width:44px, ideally padding-inline:4px or more, without changing alignment. Expanding browser target checks to Retry/New run now.
- Expanded touch-target rerun passed 6/6, now explicitly checking Retry and New run are at least 44px in both dimensions at all four sizes. Visual owner fixed widths.
- Adding final real-browser failure -> retry (no extra shield charge) -> game over -> new journey coverage, beyond existing abort/reset smoke.
- Latest full unit run after engine owner's additional regression checks: 30/30 PASS across six files. Production build PASS, JS 259.42 kB / 82.01 kB gzip, CSS 17.54 kB / 4.43 kB gzip.
- Formatting check PASS for all integration-owned source/tests/config. No em dash characters found in owned copy/docs.
- Final seven-scenario browser run PASS 7/7, including natural crash, retry without double charge, game-over dialog and restart.
- Adding requested real touchscreen context (hasTouch/isMobile), touch aim/release, explicit launch, in-flight pause/help, and manual resume. Added hidden-document pause/manual-resume unit coverage.
- App-only tests now 10/10 PASS including document hidden -> paused -> visible still paused -> explicit resume. Help now states Drain removal priority matching engine contract.
- Actual mobile touch context test PASS: hasTouch:true/isMobile:true, touchscreen aim change, release preserves aiming, dedicated Launch, in-flight pause/help, resume and abort.
- Strengthened browser progression to TWO consecutive real docks with banked power speed correction, score verification and exact one-sector Continue increments. Reference engine is used only in test harness, UI operated with real slider keyboard input/buttons.
- Final post-performance/phase-fix unit/build sequence PASS: 32/32 unit tests, six files; production build 260.62 kB JS / 82.35 kB gzip, 17.63 kB CSS / 4.44 kB gzip.
- Shared snapshot contract now caches frozen static sector geometry and returns independent mutable state copies. Integration retains snapshots read-only and requires no changes.
- Final full browser rerun is in progress with eight scenarios, including real touch and two consecutive checkpoints.
- Final eight-case browser run: 7 pass, consecutive-flight case failed because UI returned to default initial aim/sector while waiting. Shared engine/renderer edits may have triggered Vite HMR reset during flight. Investigating with explicit slider assertions, immediate flight-state assertion and Vite console diagnostics before final rerun. No production fix made without root cause.
- Isolated consecutive-flight rerun PASS (11.3 seconds) with added assertions proving actual slider angle/power match reference and flight state appears immediately after Launch, before each dock. No timeout extension or gameplay fix was needed. No Vite update occurred in the passing isolated run. Earlier default-state reset is consistent with concurrent dev HMR; settled-file full rerun will be the completion gate.

## Integration completion

Final stable sequence (owners finished; no further code edits):

- `npm test`: PASS, 32 tests / 6 files.
- `npm run build`: PASS, production JS 260.62 kB / 82.35 kB gzip; CSS 17.67 kB / 4.45 kB gzip.
- `npm run test:e2e`: PASS, 8 scenarios / 16.2 seconds. Four viewport sizes including 320x568, all main and secondary targets >=44px, real mobile touch context, two consecutive real docks with correct banked score and sector advance, pause/help, pointer release, natural failure/no double-charge retry, game over/restart.
- Final screenshots regenerated after renderer/CSS updates and visually inspected: desktop, 390px portrait, 320px portrait, short landscape, docked and actual-touch paused.
- Formatting check previously passed for all integration source/tests/config; no em dash copy/docs.
- Local dev server remains running in session 51381, bound 0.0.0.0:5173. Local http://localhost:5173/ ; LAN http://192.168.178.189:5173/ .
- No open integration or cross-owner issues. Chromium touch/device emulation was verified; a physical phone was not used. No commits, pushes, git initialization or publishing.

Owned implementation files: .gitignore, package.json, package-lock.json, tsconfig.json, vite.config.ts, playwright.config.ts, index.html, src/main.tsx, src/App.tsx, src/controls.ts, src/sound.ts, src/components/Help.tsx, src/components/Icon.tsx, src/components/PickupIcon.tsx, src/components/GameOver.tsx, tests/app/app.test.tsx, tests/app/controls.test.ts, tests/app/gameover.test.tsx, tests/e2e/game.spec.ts, README.md, docs/implementation-plan.md, docs/progress.md.

Shared APIs consumed exactly: OrbitEngine lifecycle/aim/predict (cached 1.6-second preview); GameSnapshot/Vec2/PickupKind; createRenderer resize/render/screenToWorld/destroy. No engine/renderer/style source edited by integration.
