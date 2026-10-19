# Stable Gravity implementation requirements

User approval: implement the physics review recommendations with the corrections supplied on 2026-10-18.

- Preserve the success latch and the existing three-second next-level countdown once earned. Do not revoke a win.
- Every Gravity campaign/procedural orbit objective requires at least two full revolutions. No partial-sweep relay wins.
- Replace the current campaign with the distinct reviewed base structures. Population variations can fill 45 introductory levels, then generate further challenges. Do not count rotations as new base layouts.
- Prove solutions are humanly sequential, with at least four real seconds between launches, thinking pauses, modest aim/power perturbations, and sustained bounded survival after completion. Particle interaction on and grouping off are the default. Check responsive/default-size behavior.
- Smooth short-range particle attraction without eliminating visible distant influence. Preserve equal/opposite forces, mass response, shared prediction/play simulation, and stable fixed-step integration.
- Optional grouping must be momentum-dependent: slow bound encounters can settle on surfaces, fast or tangential encounters can transfer momentum and separate without bouncing or merging away a particle. Preserve independent bodies and masses.
- Gentle temporary playback slowdown while aiming, restored on cancel/release/pause. No trajectory-changing drag or automatic orbital snapping.
- Subtle mobile haptics at valid aim start and successful release, with graceful unsupported-browser fallback. Apply to both gameplay modes.
- Full path assist should update smoothly against the current moving world, including other particles, without stale jumps or endless restarts under load.
- Apply approved core display: larger visible face with horizontal room for tiny extra-light inward chevrons close to a semibold current count; no letters or fractions. Keep forces independent from presentation size.
- Keep sound, saves, zoom, controls and general app styling intact. No commits or pushes without a fresh instruction.

## Follow-up decisions during implementation

- Minimum attractive core radius96 world units (1.5x prior64), repeller radius57, gravity strength independent from face size. Campaign-specific extended field softening can be authored to create stable lanes; legacy fields retain their existing40 default.
- Center numbers using measured ink bounds, use14px semibold counters with6px-high extra-light chevrons and4px contentgap. Remove decorative/progress rings aroundcores.
- Actual Full Path Assist horizon20 physicalseconds, display easing followsmoving particles, aimdots1.5px CSSradius with existingfade.
- Restore Space-drag and middle-button panning inGravity as well as two-finger touchpanning, with resetview available afterpan andnoaccidentallaunches.
