# Gravity campaign and endless provider

The campaign contains 45 newly authored, reference-inspired levels. It is not a reconstruction of the undisclosed original campaign. The source geometries include isolated wells with colorful orbital crowds, separated and close binaries, enclosed central wells, and increasingly varied constellations. There are 34 named structural families with different populations, adjacency, gaps, masses, repeller arrangements and physics settings.

## Provider

`getGravityLevel(seed, index)` in `src/gravity/campaign.ts` supplies the fixed authored campaign for indices 0 through 44, followed by seeded endless levels. The global index is preserved, including indices beyond 10000. `CAMPAIGN_LEVEL_COUNT` is 45. `getCampaignCatalog()` returns independent `{ index, title, family, mechanics }` entries for a selector. Catalog `family` is the structural layout identifier; `GravityLevel.family` remains the legacy objective adapter.

Inject `getGravityLevel` into `new GravityEngine(seed, undefined, getGravityLevel)` and navigate using `engine.goTo(index)`. Creator and Odessey callers can continue supplying their own levels and providers.

`generateGravityLevel(seed, index)` remains a standalone endless generator, including when called with an index below 45. Inputs normalize unsigned seeds and finite, nonnegative integer indices. A seeded coprime traversal visits 29 distinct eligible structural families from the first endless level, without repeating a family during a complete traversal. Orientation varies by seed; physical force and playback speed do not increase with difficulty. A failed orientation retries the verified orientation of the same family with exactly the same population and revolution demands. Validation has a strict two-candidate bound and a 30 physical second replay horizon. Generated cache size is limited to 96, and returned objects are cloned to prevent mutation of cached levels.

## Endless difficulty

`gravityDifficulty(index)` in `src/gravity/difficulty.ts` defines a nondecreasing objective budget. It begins at the final campaign level's six orbiters and two revolutions. Here, offset is the number of levels after the first endless level, global index 45.

| Endless offset | Required orbiters | Revolutions |
| --- | --- | --- |
| 0 | 6 | 2 |
| 15 | 7 | 2 |
| 30 | 8 | 2 |
| 45 and beyond | 8 | 3 |

There are no elapsed-time win requirements. A level completes as soon as the required number of living bound orbiters has completed the required revolutions. Population is capped at eight and revolutions at three to keep fields readable on mobile and avoid impractically long objectives. This is a bounded progression, rather than unlimited difficulty growth. Each profile's population is the total assigned across wells, not a random count multiplied by the number of bodies. Seeded formation changes never reduce that budget. Per-core markers retain their exact assigned counts, while longer objective descriptions summarize the total.

Legacy v1 `objective.hold` fields are accepted and normalized to zero when importing, loading, saving or creating simulation state. Goal evaluation also ignores legacy hold values in an already-restored state, so they cannot silently delay completion. Compatibility `hold` and `held` progress fields remain zero. The creator exposes only populations and revolutions for goal configuration. Physics integration time, playback, moving wells, prediction and trail fading retain their simulation clocks.

`src/gravity/endless.ts` selects and configures these profiles. All 29 eligible formations support the maximum eight-orbiter, three-revolution objective using recorded launch evidence. Double-ring and three-clusters remain in the campaign but are excluded from endless selection because they did not yield suitable long-lived captures. Counterflow remains in the campaign because the renderer currently expects one population goal per core. Compact-swarm and concentric-shells are omitted as selection aliases of the same visible single-core formation under a shared population budget. Other single-core formations remain distinct through repellers, motion or planet interactions.

## Authoring evidence

`src/gravity/layouts.ts` contains the structural definitions. `src/gravity/campaign.ts` contains the 45 authored configurations. Body radius encodes the square root of relative gravitational strength. Advanced layouts use the same default planet gravity constant as the simulation, with explicit collision policies and moving well definitions.

Hidden `witness` shots are authoring evidence. Each contains an arbitrary world position, physical velocity and physical launch time. They never launch on the player's behalf. `verifyLevel(level)` and `witnessCompletionTime(level, dt?)` replay `createState`, `fireFrom`, `step` and `goalProgress` with all configured wells, mutual forces, motions and collisions enabled. Per-well counts use the simulation's unique orbiter assignment. Tests replay all 45 levels and every canonical endless fallback, along with varied seeds, distant indices and half-size integration steps.

`witness-fixtures.json` stores capture trajectories found through an author-time angle, radius and velocity search. Completion times are synchronized across wells. Populations sample those same trajectories at distinct positions, preserving actual N-body replay validation. Campaign loading uses the stored trajectories and short phase sampling rather than a search or full solution replay. To regenerate the base capture fixtures deliberately, run `GRAVITY_AUTHOR_FIXTURES=1 npx vitest run tests/gravity/authoring.test.ts`, then rerun the campaign and generator tests. Normal test runs skip this source-writing authoring operation.

`endless-fixtures.json` is separate from the campaign fixtures. It stores complete maximum-demand solutions, including all eight launches when a lower profile requires six or seven orbiters. Retaining those extra planets preserves the validated mutual forces. To deliberately regenerate these long-lived captures, run `GRAVITY_AUTHOR_ENDLESS=1 npx vitest run tests/gravity/endless-authoring.test.ts`, then replay the progression and generator suites. This opt-in search is never run during normal tests or level loading. A campaign hash regression normalizes only the removed hold metadata, confirming the geometry, launch witnesses and orbital goals of all 45 authored levels remain unchanged.

## Gravity-only progress

`src/gravity/progress.ts` exports:

- `GravityProgress`: `{ version: 1, seed, currentIndex, unlockedIndex, completedIndices }`.
- `loadGravityProgress(seed)`: resume the seed's state or return fresh progress when storage is absent, corrupt, mismatched or disabled.
- `saveGravityProgress(progress)`: normalize and save, tolerating unavailable storage.
- `recordGravityCompletion(progress, index)`: immutable update recording completion, selecting the next global level and unlocking it.
- `setGravityCurrentIndex(progress, index)`: immutable navigation update. Skipping unlocks the selected index without recording a completion or imposing a penalty.

Storage uses `orbit.gravity.progress.v1:<unsigned seed>`. Campaign completion and endless completion share global indices. Creator and Odessey play must not save campaign progress. There are no competitive scores or launch penalties.
