# Minimal scene visual contract

Status: continuous free-play and selected shooter-mode visuals complete. Renderer/API/type checks and final live responsive inspection pass. Ready for integration final suite/captures. Visual ownership: `src/render/**`, `src/styles/**`, `tests/render/**`, this document.

## Direction and critique

Tokens: uniform ground `#e9ecef`, charcoal `#303943`, slate `#626d78`, attraction blue `#527c9a`, repulsion rust `#b76550`, electric checkpoint blue `#168dff`. System sans appears only in tiny status and menus.

The viewport is an uninterrupted solid ground. Flat weighted discs, subtle offset contact shadows and low-opacity concentric rings carry the scene. Only checkpoint progress and pause persist. No title, frame, texture, stars, gradients, shiny planets, grids, controls panel or teaching paragraphs. No power-ups, negative collectibles, inventory symbols or inert rubble remain. Every physical solid comes from engine `Body[]` and has a force cue. Small bodies use two compact ripple rings; larger bodies use three. The scene's physical arrangement is its one expressive element.

## Public renderer API

```ts
interface SlingshotVisual {
  anchor: Vec2; // Actual checkpoint in global coordinates.
  pull: Vec2;   // VIRTUAL: anchor + (currentClient - startClient) / lockedCameraScale.
  power: number; // Actual chosen power, 0..1.
}
interface RenderOptions {
  reducedMotion?: boolean;
  paused?: boolean;
  cameraLocked?: boolean;
  slingshot?: SlingshotVisual | null;
}
createRenderer(canvas: HTMLCanvasElement): {
  resize(width: number, height: number, dpr?: number): void;
  prepareFrame(snapshot: GameSnapshot, timeSeconds: number, options?: RenderOptions): void;
  render(snapshot: GameSnapshot, preview: Vec2[][], timeSeconds: number, options?: RenderOptions): void;
  screenToWorld(clientX: number, clientY: number): Vec2;
  worldToScreen(worldPoint: Vec2): Vec2; // CLIENT coordinates, with canvas rect offset.
  getVisibleBounds(): WorldBounds;
  getViewport(): { center: Vec2; scale: number; transitioning: boolean; bounds: WorldBounds };
  destroy(): void;
}
```

All APIs are available now. DPR caps at 2. `getVisibleBounds` and `getViewport().bounds` return the ACTUAL visible world rectangle, computed from the displayed camera and canvas CSS bounding rectangle. They are not `sector.bounds`. For example, portrait's visible width starts at about900 world units and widens for longer checkpoint spans and its visible vertical area may exceed the generated field; desktop also shows extra uniform ground around the fitted field.

## Required camera/physics frame ordering

1. Read the current engine snapshot and call `renderer.prepareFrame(snapshot, rafTime / 1000, options)` BEFORE advancing physics.
2. Inject `renderer.getVisibleBounds()` into the engine's published runtime flight-bounds API.
3. Advance engine physics and controller docking/failure timers.
4. Call `renderer.render(updatedSnapshot, preview, THE SAME rafTime / 1000, options)`.

`prepareFrame` handles framing/following once per timestamp. `render` calls it internally for standalone use, but a second call at the same time never advances the camera again. Therefore the rendered world edges match the edges supplied to physics. If automatic advance changes the sector during step3, render initializes the new transition at zero elapsed time; the next prepared frame moves it. Preview generation also receives the currently displayed bounds while the pull locks the camera. No physics or flight limits live in the renderer.

## Camera and gesture policy

Desktop and landscape fit the whole global `sector.bounds` uniformly. Portrait starts with a close 900-unit stretch. It widens only as needed to include the launcher and the checkpoint's full physical radius with a 32px horizontal inset at rest, then shifts the settled center to keep both endpoints visible. The same uniform scale is retained during flight. It smoothly follows the first live projectile horizontally with160 world units of forward lead. Y stays at field center. A tiny blue edge ring/chevron indicates a checkpoint outside the screen. No text or new control chrome is added.

Current compact generation supplies 1250 × 900 bounds with origin `launch - (100,450)`. The camera consumes those actual bounds without a renderer override or old field-size assumption. Settled portrait framing includes the complete checkpoint ring, including the new 820-unit routes. The edge cue remains available during flight when horizontal tracking moves the checkpoint outside the view. Body spacing and route reachability remain engine responsibilities.

On a new sector, the camera eases right over about650ms; the old geometry fades during that transition. `getViewport().transitioning` blocks gesture starts. Pause freezes motion. A held pull (`cameraLocked` or `slingshot`) freezes all camera movement. Resize cancels the app's pointer and snaps framing. Reduced motion snaps transitions and uses direct predictable flight tracking. A failed or aborted portrait volley returns gently to its launcher before the next pull; no extra transition is introduced if it already has the correct framing.

Anywhere-drag uses pointer DELTA, not absolute pointer position. Launch angle is opposite `(pull - anchor)`, and release launches from the true anchor. The renderer shows a backward ghost/tether, forward release mark and short fading preview. The ghost is optically capped at 85 screen pixels and ray-clipped to a 14px safe inset. This does NOT alter physical launch origin, direction, or power. The launcher affordance is 44px diameter.

Both selected modes show exactly one projectile arrow at the launcher and pulled ghost. Snapshot `shotCount:3` adds a subtle three-dot cue behind that arrow, and three small anchor dots keep mode visible away from the finger while pulling. These dots indicate the option to split later; they are not additional launch projectiles. The safe ghost inset keeps the complete cue inside the screen. The pre-launch preview renders only the first supplied path from `engine.predict(1.6)`, with a short fade along its actual curvature. It never invents a future in-flight tap or side trajectories. During flight, each actual engine particle is rendered independently: one before branching, and up to three after `branch()` at the current position/tangent. Gesture recognition and branching belong to integration and physics, not the renderer.

The contact ring reads `sector.checkpoint.radius` directly, including the current 45-unit radius. The renderer never reads test solution metadata. The canvas cursor is `default` at rest and during active input; no grab or grabbing rule remains. The bottom hint includes “Double tap to change shoot modes.” and retains its existing safe-area bottom alignment and pointer transparency.

## Fullscreen HTML/CSS

```html
<main class="orbit-scene">
  <canvas class="scene-canvas" aria-label="Slingshot flight field"></canvas>
  <div class="scene-hud" aria-label="Journey status">
    <span class="journey-progress">3</span>
  </div>
  <button class="pause-button" aria-label="Pause">...</button>
  <p class="gesture-hint">Pull back. Release to fly.</p>
  <p class="scene-announcement visually-hidden" role="status">...</p>
  <!-- Only during pause/help. -->
  <div class="dialog-backdrop">
    <section class="game-dialog" role="dialog" aria-modal="true">
      <div class="dialog-header">
        <h1>Paused</h1>
        <button class="icon-button">...</button>
      </div>
      <div class="dialog-actions">
        <button class="button-primary">Resume</button>
      </div>
    </section>
  </div>
</main>
```

All buttons are at least44x44px; CSS includes safe areas, focus-visible, touch-action:none, fine-pointer-only hover, and reduced motion. Hint is transient and pointer-transparent. No body scrolling or separate playfield container.

Supported modal classes: `.dialog-header`, `.dialog-actions`, `.dialog-eyebrow`, `.muted`, `.help-list`, `.help-row`, `.help-icon`, `.help-copy`, `.help-controls`, `.icon-button`, `.button-primary`, `.button-secondary`, `.text-button`, `.visually-hidden`, `.sr-only`, `.negative`, `.positive`.

Integration owns pointer capture and one pointer. Cancel without firing on pointercancel, lost capture, resize/orientation, pause/help, and visibility loss. Integration owns final full unit/build/E2E commands. Visual owner runs only its isolated renderer tests and type check.

## Verification notes

- Close portrait framing, clamped follow, pause/drag freeze, retry return, offset mapping, reduced motion, resize and cleanup are covered in renderer tests.
- Reviewed force-chevron origin bug is fixed: translation precedes path construction, with a regression test.
- Thirty-three isolated renderer tests pass, including exact viewport edges, matching pre-physics/render cameras at one timestamp in normal/reduced motion, and full horizontal pulls at 320px/390px with ghost endpoint x14px and unchanged gesture direction/power.
- Latest no-collectible real app inspected after reload at1440x900,390x844,320x568,844x390. In every case canvas equals the whole viewport, document has no overflow, Pause is44x44px, and Pause is the only visible button/input. Close portrait screenshot was shown in this visual chat. Integration owns writing final shared screenshot artifacts after all owners are idle.
- Strict isolated renderer TypeScript check passes. No remaining visual source changes are pending. No temporary fixtures, dependency installs, full-suite runs, lints or git actions were performed.

## Continuous free-play cleanup

Removed finite-life indicator styles and obsolete tracking fields from renderer fixtures. The scene contract now contains only checkpoint progress and pause; menus cover pause/help. Renderer geometry, camera, gestures and generation are unchanged.

## Shooter-mode verification

Focused tests verify one launcher/ghost projectile glyph in both modes at 320px and 390px, the split-mode dot cue, only one fading pre-launch trajectory in either mode, and one versus three actual live pieces before/after branching. The checkpoint-radius test still verifies an arbitrary engine-provided radius. Renderer fixtures include `shotCount:1` and `canBranch:false` by default. No additional buttons, panels or camera behavior were introduced.

Live preview confirms the exact bottom hint at both widths: two lines inside a 272px box at 320px, and one line inside the existing maximum width at 390px. Both have no overflow, pointer-events:none and a 28px bottom inset in the inspected viewport. Split mode displays one arrow with the dot cue. No hint layout change was necessary.

## Compact-field visual verification

Inspected the live compact seed 42 field at 1440 × 900, 390 × 844, 320 × 568 and 844 × 390 after the 1250 × 900 engine update. Desktop and landscape uniformly fit the actual field; portrait retains the close 900-unit view. The blue checkpoint is fully visible in the initial phone views for this seed, with readable separation from nearby bodies. Double-click selected the three-piece shooter, and its launcher cue remained visible through all viewport changes. Canvas matched every viewport, no document overflow appeared, and Pause remained 44 × 44px. No concrete visual defect required a renderer or style change.

All 33 isolated renderer tests and the strict renderer TypeScript check pass after the blue checkpoint refinement. This evidence covers framing and selected-mode presentation only; final generator fallback/reachability checks and full app validation remain with their owners.


## Electric-blue checkpoint

The checkpoint uses electric blue `#168dff`, distinct from the muted obstacle attraction blue. Its complete capture ring sits at the engine-provided physical radius, currently 45 world units, with a scale-aware 2.8 CSS-pixel stroke. Two restrained concentric inner rings and a small centered geometric flag identify safe docking. The interior stays ground-colored. Goal chevrons and the previous pale filled center are removed; obstacle force chevrons remain unchanged.

Three quiet outer gravity rings and a subtle fixed-opacity outer band keep the checkpoint integrated with the field. No gradients, bloom, text, crosshairs or continuous animation are added. Successful capture uses the electric accent for its confirmation ring and bounded particle burst; reduced motion retains static confirmation and omits particles. The offscreen cue matches the electric accent. Camera/framing, physical gravity, one-piece launch/ghost, split dots, one predicted path, controls and bottom hint are unchanged.

All 33 isolated renderer tests and the strict renderer/test TypeScript check pass. Updated regressions verify the exact physical capture radius, optical border width, two inner circles, open interior, centered flag segments, absence of goal chevrons, electric offscreen cue and success feedback. Visual source is frozen. Live seed 42 was inspected after the engine's 0.8 centerline row placement update loaded, at 1440 × 900, 390 × 844, 320 × 568 and 844 × 390. The electric boundary, two inner rings and flag remain readable and distinct from neighboring charcoal bodies; only outer decorative ripples may clip naturally at a phone edge. The capture ring stays visible in this seed. No camera or layout adjustment was needed. Main owns final full app verification after all owners are idle.


## Near-edge guidance correction

Resolved the reviewer's phone overlap: the checkpoint edge cue now appears only when the entire physical capture ring, including its 1.4px outer stroke extent, is outside the viewport horizontally. It cannot paint its ground backing over a fully or partly visible goal. Five focused cases cover the reported 320px center at x302.09, partial visibility on either side, and fully offscreen guidance on either side. All 33 isolated renderer tests and strict renderer/test TypeScript checking pass. The live seed 42 320 × 568 view confirms the real flag and both inner rings remain intact near the right edge.

Renderer source remains frozen. After the engine owner's final source freeze, live seed 42 fields 0 and 1 were inspected at 1440 × 900, 390 × 844, 320 × 568 and 844 × 390 in one uninterrupted run. A normal inverted drag captured field 0 and automatically advanced to field 1, changing the spatial cluster from four to five solids. Both retain a substantial launch-line obstacle and readable blue goal; the phone capture ring, inner rings and flag remain intact. No control overlap or horizontal overflow appeared, and Pause measures 44 × 44px. The certified routes bend approximately 44.7 and 43.1 world units away from their terminal chords. No new renderer defect or product edit was needed. Integration owns final full-suite verification and fresh PNG capture; earlier mutable-source screenshots remain provisional.

The final E2E 320px PNG was subsequently reported black beneath its DOM HUD. Narrow investigation confirmed that artifact, then inspected three fresh 320 × 568 browser captures across initial navigation and two reloads: all rendered the correct scene, with no console warnings/errors, a 320 × 568 canvas buffer and no overflow. A persistent 320px rendering failure was not reproduced. Source exposes a capture race: opaque canvas width/height assignments clear its pixels to black, App resize prepares geometry without painting, and the next animation frame paints the scene. E2E `ready()` checked only DOM status. Integration resolved capture readiness by polling actual opaque-ground corner pixels before all four viewport screenshots. The focused run passed 4/4 in 3.0 seconds, with results at `/private/tmp/orbit-final-viewport-painted`. Main inspected the regenerated 320 × 568 PNG and final desktop, phone, landscape and trajectory captures and reported visual sign-off PASS. Product renderer and App remain unchanged. The original failing PNG's timing cause remains inferred rather than traced; final capture readiness and visual review are resolved.

## Directional obstacle ripples

Obstacle rings flow inward for attractors and outward for repellents on a steady 5.4-second cycle. The attractive checkpoint now shares inward flow in its three outer electric-blue rings. Following the user's visibility correction, animated ring peak opacity is 0.22 across obstacles and goal, roughly three times the earlier obstacle peak; reduced-motion static rings retain fixed positions with stronger 0.16–0.24 opacity. Existing small-body counts of two rings and large-body counts of three remain bounded inside the prior outer extent. A squared-sine opacity envelope reaches zero at the radial wrap limits, avoiding a visible reset. No discs, physical radii, contact edges, chevrons, positions or particles changed. The goal's thick physical border, two inner rings and flag stay stable.

The renderer accumulates active frame time once per rendered timestamp, capped by the existing 50ms frame delta. `paused:true` freezes phase, covering pause/help/hidden through App's existing render contract. The first active frame after a pause does not advance motion. Gaps over 100ms also contribute no motion, covering suspended RAF without a resume jump. Reduced motion uses fixed ring positions. No new animation timers, objects, event listeners or cleanup obligations are introduced.

All 41 isolated renderer checks and strict renderer/test TypeScript checking pass after the stronger goal-flow correction. Eight focused motion cases cover both obstacle force directions, stronger bounded opacity, pause/resume and duplicate frame preparation, long suspended gaps, static reduced motion, bounded ring counts/radii, invisible wraps, goal inward direction/electric color and unchanged checkpoint identity. The supplied faint-ring screenshot was inspected before this correction. Fresh time-separated desktop 1440 × 900 and phone 390 × 844 frames visibly strengthen both obstacle and goal flow with fixed solids and a steady readable checkpoint identity. Browser warnings/errors are empty. Comparison PNGs are `/private/tmp/orbit-strong-desktop-a.png`, `/private/tmp/orbit-strong-desktop-b.png`, `/private/tmp/orbit-strong-phone-a.png` and `/private/tmp/orbit-strong-phone-b.png`. Renderer source is frozen for integration's final validation.

## Offscreen countdown visual QA

After engine freeze and the countdown UI landed, normal upward drag flight produced `Offscreen · 6s` at 1440 × 900, 390 × 844 and 320 × 568. The existing `gesture-hint offscreen-countdown` styles need no changes: muted text stays centered in one line, 28px above the bottom, at 12px desktop and 11px phone, with pointer events disabled and no overlap or overflow. Pause removes the label. Expanding the viewport from desktop to portrait brought the same projectile back into view; the countdown disappeared and the accessible status returned to `In flight`. This verifies viewport-induced visibility return, not natural gravitational re-entry, which remains with integration's generated-fixture search. The label reappeared on the next real exit, and stayed hidden during the inspected phone pauses. Browser warnings/errors are empty. No additional product edits or broad checks were needed.

## Final verification and visual sign-off

Main reported visual sign-off PASS after inspecting fresh final desktop, 320px, 390px and landscape screenshots, actual countdown/return captures, and both time-separated desktop/phone comparison PNG pairs. Stronger ring colors remain clear and checkpoint identity stays stable. Main's final application verification passed all 124 unit checks in 4.99 seconds with `maxWorkers=2`, the production build, and all 16 browser checks in 46.1 seconds. Final browser results are at `/private/tmp/orbit-final-offscreen-gravity-browser`. These application-wide results are main's reported evidence; visual ownership ran only the isolated checks documented above. Source remains frozen, with no further product edits or checks. The local preview remains running.

## Shallow wave-ridge refinement

The user's subsequent relief reference was inspected and translated into the existing pale top-down scene. Thin wave lines are now shallow concentric ridges, each drawn with three solid-color bands: a modest lower-right charcoal shadow, a broad blue/rust body and an upper-left white crest highlight. The attractive goal uses electric blue. No gradients, blur, glow, wire mesh, full-screen effects, libraries or WebGL are used. Solid discs and the checkpoint's capture border, inner circles and flag are unchanged.

The same 5.4-second force phase moves attractor and goal ridges inward and repellent ridges outward. All three shaded bands share the wrap fade and existing active clock, pause/help/hidden freeze and resume-gap protection. Reduced motion keeps stationary shaded relief. Ridge widths scale from the existing local spread with a 10 CSS-pixel cap. Radius padding contains the full shadow/highlight footprint inside the previous outer extent. Ring counts stay two or three per obstacle and three for the goal. A steady scene has at most 24 local ridges and 72 ridge strokes per frame; simultaneous previous/current sector geometry during transitions can reach 45 ridges and 135 strokes, still bounded. No growing allocations, new timers or event listeners were introduced.

All 43 isolated renderer checks and strict renderer/test types pass. Desktop/phone relief regressions verify broad crests, offset solid shading, no gradient calls, fixed stroke counts and the complete footprint across a full motion cycle. Existing direction, pause, reduced-motion, wrap, collision-radius and checkpoint-identity checks remain passing. Fresh time-separated 1440 × 900 and 390 × 844 frames show visible shallow relief with stable contact silhouettes and distinct blue goal identity; browser warnings/errors are empty. Review PNGs: `/private/tmp/orbit-wave-desktop-a.png`, `/private/tmp/orbit-wave-desktop-b.png`, `/private/tmp/orbit-wave-phone-a.png`, `/private/tmp/orbit-wave-phone-b.png`.

Main reported final PASS for this refinement: 126/126 unit checks across 10 files in 10.24 seconds with `maxWorkers=2`, a successful build producing 272.66 kB JavaScript (87.98 kB gzip) and 8.18 kB CSS, and 16/16 browser checks in 56.6 seconds at `/private/tmp/orbit-final-wave-relief-browser`. Main visually approved all four relief captures, and review found no issues. These application-wide results are main's reported evidence; earlier application-wide results above remain historical. Source is frozen with no further product changes or checks.

## Spaced wave crests and radial fade

The user's crowded-crest screenshot was inspected. This subsequent refinement increases animated crest separation to 1.7 times its previous value and static reduced-motion separation to 1.7 times its previous value. The original ridge widths, shadow offsets and three solid shaded bands are retained, so increased spacing does not thicken the crests. Every band shares attenuation `exp(-(crestRadius - solidRadius) / (3.5 * baseSpread))`, where `baseSpread = 12 + 0.13 * solidRadius`. Attenuation uses actual radial distance for moving and stationary relief. The temporal wrap envelope remains separate, so both ends still disappear gently and outer waves become progressively softer.

The expanded footprint is finite, bounded by `solidRadius + 1.7 * ringCount * baseSpread`, including shading. Counts remain unchanged: at most 24 ridges/72 ridge strokes in a steady scene and 45 ridges/135 strokes during a sector transition. Attraction and goal motion stays inward, repulsion outward, on the existing 5.4-second clock with unchanged pause/help/hidden, resume-gap and reduced-motion guarantees. Contact geometry, discs, checkpoint border/inner circles/flag and the rest of the scene are unchanged. No engine, generation, App, controls or styles edits were made.

All 45 isolated renderer checks and strict renderer/test types pass. New animated/static checks verify wider spacing, softer distant shadows/color/highlights, shared attenuation across all three bands and a bounded expanded footprint; existing direction/timing/identity checks remain passing. Fresh desktop 1440 × 900 and phone 390 × 844 time-separated frames show distinct separated crests, softer outer waves and stable blue checkpoint identity. Browser warnings/errors are empty. Review PNGs: `/private/tmp/orbit-spaced-wave-desktop-a.png`, `/private/tmp/orbit-spaced-wave-desktop-b.png`, `/private/tmp/orbit-spaced-wave-phone-a.png`, `/private/tmp/orbit-spaced-wave-phone-b.png`. Renderer source is frozen for main review and final broad verification of this refinement; previous application-wide results above are historical. Preview was restored on loopback port 5173 and remains running.

## Centered sampled gravity surface and contrasting aim

This implementation supersedes the embossed stroke bands above. The user's surface reference is represented by a regular lattice of small solid quads throughout each local gravity patch, including valleys between the crests. Wave height changes their radial positions, size and flat light/shadow shade; these are sampled surfaces rather than points traced around ring outlines. The approved density, pale ground, restrained blue/rust accents and distinct electric-blue checkpoint are retained.

The final user refinement removes angular undulation and directional spatial projection. Lattice coordinates are symmetric about each physical body or checkpoint center. Relief displaces a sample only along its own radial direction, keeping circular crests concentric with the object; directional lighting affects shading, not contour geometry. The wavelength is `32 + 0.34 * physicalRadius` world units, so smaller objects have tighter crests and larger objects have wider gaps. The existing active-time accumulator drives inward attraction/checkpoint waves and outward repulsion, with a 2.7-second crest cycle. Pause/help/hidden freeze, suspended-gap handling, duplicate-frame handling and static reduced motion remain intact. Discs, contact radii, goal border/inner rings/flag, camera and physics remain fixed.

Surface opacity and height attenuate with actual distance from the solid edge using an exponential fade, a soft inner ramp and a squared outer taper. Samples are omitted inside the physical edge and beyond `physicalRadius + 140`. Radial relief adds at most 12.6 world units to sample centers; glyph footprints remain bounded by spacing and a maximum 2.8 CSS-pixel width. Each patch considers at most 73 × 73 desktop candidates or 49 × 49 at phone/low-zoom density, then omits samples outside the local annulus. One 85,264-byte scratch buffer and one wave sample are allocated per renderer and reused across all patches, sectors and frames. Sixteen flat-shade paths per patch batch the quads into at most sixteen fills. There are no per-point allocations, growing caches, gradients, blur, WebGL, dependencies or new timers/listeners.

The dotted aiming prediction now uses dedicated deep plum `#69408d`, distinct from goal/attraction blue, repulsion rust and physical charcoal. Leading opacity rises from `0.82 * fade²` to `0.98 * fade²`; the same short fading tail, sampled path positions, initial trajectory and single/split mode behavior remain unchanged. Flying trails retain their existing blue.

All 51 isolated renderer checks pass across two files, and strict renderer/test type checking exits successfully. Checks cover centered surfaces for attraction, repulsion and goal; matching circular crest radii across quadrants and object sizes; increasing wave spacing with radius; force direction; bounded samples/footprints; distance fade in animated and reduced motion; full-cycle stability; freeze/resume guarantees; unchanged goal identity; and the darker plum trajectory in both shooter modes. No broad suites, build or lints were run by this worker. Main owns final application verification. Browser warnings/errors were empty.

Main visually approved the centered live preview captures at 1440 × 900 desktop and 390 × 844 phone: `/private/tmp/orbit-centered-dot-wave-desktop-a.png` and `/private/tmp/orbit-centered-dot-wave-phone-a.png`. Additional held-aim captures use the actual renderer and engine prediction with a temporary deterministic render fixture, not an automated live pointer hold: `/private/tmp/orbit-centered-dot-wave-desktop-aim-single.png`, `/private/tmp/orbit-centered-dot-wave-desktop-aim-split.png`, `/private/tmp/orbit-centered-dot-wave-phone-aim-single.png`, `/private/tmp/orbit-centered-dot-wave-phone-aim-split.png`. The temporary fixture was removed, the viewport restored and the live preview returned to checkpoint 0. Renderer source is frozen for main review and final application verification. No engine, generator, App, controls or styles edits were made by this worker.

## Berry aiming dots above the gravity surface

The aiming prediction now uses dark berry `#8a0f4b` with a consistent 2.1 CSS-pixel core radius and a 1.6 CSS-pixel pale keyline (0.8 pixels beyond the core). The original short squared-opacity tail and prediction sample positions remain unchanged. All gravity surfaces render first, then the aiming dots and their keylines, then physical bodies and goal markings. This preserves visibility over overlapping wave patches without letting a keyline erase a physical obstacle silhouette. The accepted gravity surface remains at its 0.70 opacity multiplier with unchanged geometry, color, animation and distance fade.

All 53 focused renderer checks pass, strict renderer/test types pass, and the production build succeeds. A desktop/phone ordering regression checks wave surface below halo/core, physical silhouette above prediction, a readable screen-space core size and matching halo/core fade. The earlier exact violet-color assertion was removed. No broad browser suite or lints were run. Held-aim captures use the actual renderer and engine prediction in a temporary deterministic browser fixture, now removed: `/private/tmp/orbit-berry-aim-desktop-single.png`, `/private/tmp/orbit-berry-aim-desktop-split.png`, `/private/tmp/orbit-berry-aim-phone-single.png`, `/private/tmp/orbit-berry-aim-phone-split.png`. The berry dots remain clear across overlapping fields in both modes and viewports. Fixture warnings/errors were empty and the viewport override was reset. Renderer and test source is frozen for main review.

## Long-span portrait checkpoint framing

Portrait framing now uses the actual checkpoint position and radius when choosing its uniform scale and settled center. The launcher center and checkpoint envelope receive a 32px horizontal inset; the checkpoint's 2.8px blue stroke leaves at least 30.6px to the right edge on the limiting route. The same scale is used during flight, preserving a stable launch view. Desktop and landscape continue to use `fitCamera` on the complete field bounds. Camera locking, pause, transitions, retry return and coordinate mapping retain their existing behavior.

A regression first reproduced clipping for an 820-unit checkpoint span at 320 × 568 and 390 × 844. Coordinate tests now cover those sizes plus desktop and landscape; renderer tests cover settled checkpoint transitions, full launcher/goal visibility and stable flight scale. All 60 isolated render tests and the strict renderer TypeScript check pass.

Temporary browser fixtures rendered the actual separated-clusters seed 0 sector at 320 × 568, 390 × 844 and 1440 × 900. Both phone canvases show the complete goal with 30.6px beyond the blue rim and 10px before the launcher's 44px affordance. Browser console warnings/errors were empty. Capture: `/private/tmp/orbit-camera-fit-review.png`. This is real renderer evidence on fixed-size canvases, not an end-to-end gesture playthrough. The temporary fixture and separate preview server were removed after inspection. Integration owns final full-app and generator verification.
