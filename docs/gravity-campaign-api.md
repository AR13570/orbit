# Gravity campaign and endless provider

The campaign contains 45 challenges across nine distinct base arrangements. They are original layouts inspired by the reference game’s orbital play. Rotations and reflections are treated as variations, not additional layouts.

## Campaign design

`src/gravity/campaign-design.ts` defines the structures, field profiles and populations. The nine bases are Open sky, Neighbouring systems, Common centre, The shield, Long channel, The divide, Open crown, Closed garden and Broken necklace. Gentle, Deep and Broad profiles change the field itself independently of the core’s visible radius. Population variants ask players to add more planets to an established system. The sequence has no more than three consecutive single-core challenges, leaves at least three other levels between repeats of one base arrangement, and finishes on a three-particle shared orbit. Deep uses a different softened field shape, rather than a uniform speed increase. Shield and Crown remain gentle practice variations.

Every campaign objective requires at least two complete revolutions. Local challenges require living orbiters around each attractive core. Shared challenges require each qualifying planet to circle every participating core in one shared loop. A partial flyby or a relay visit cannot complete these objectives. The campaign has no relay goals.

Core faces show only a semibold established-orbiter count between subtle directional symbols. They have no names or fractions. Attractive core radii are at least 96 world units, with repellers at least 57. Independently authored force profiles keep larger visual surfaces compatible with stable orbits. There are no decorative outer rings in addition to the gravity waves.

Mutual particle attraction defaults on. Grouping is independent and defaults off. Advanced preferences are preserved across levels. Slow, bound encounters can settle when grouping is enabled; fast encounters use limited momentum transfer and soft passage rather than immediate sticking or rigid bouncing. Playback gently slows while aiming and returns to normal after release or cancellation.

Once earned, completion stays earned. The three-second Next level border countdown advances automatically; pause stops the countdown. Skipping requires confirmation and does not record completion.

## Provider

`getGravityLevel(seed, index)` in `src/gravity/campaign.ts` supplies campaign indices 0 through 44, followed by seeded endless variants. Campaign coordinates are seed-independent. `getCampaignCatalog()` returns cloned entries. Recorded witness launches are authoring evidence only and never launch on behalf of players.

Runtime startup does not search for a solution or run a physics replay. The provider loads the authored data, selects an approved seeded variant, and returns a clone. Its cache is bounded.

## Sequential stability evidence

`campaign-witnesses.json` and `campaign-endless-witnesses.json` contain launch positions, velocities and physical release times. The exhaustive verification uses the actual fixed-step simulation with particle gravity enabled and grouping disabled, matching the defaults.

The protocol checks at least five real seconds between launches at normal playback, additional thinking pauses, small aiming errors, both size extremes, and actual outermost-view removal bounds on desktop, portrait, small portrait and landscape viewports. The normal, size, viewport and aim scenarios continue for at least 120 physical seconds and ten additional full revolutions after completion. Separate pure thinking-pause cases verify that sequential launches reach the two-orbit goal and remain qualified for three more simulated seconds. This is finite numerical evidence, not a promise of indefinite stability or proof that every nearby shot succeeds.

Run the portable exhaustive proof with checked-in witnesses:

```sh
GRAVITY_VERIFY_STABILITY=1 npm test -- tests/gravity/stable-authoring.test.ts --maxWorkers=1
```

The report is `docs/verification/stable-campaign.json`. It records all campaign scenarios, generated candidates, rejected variants and any failures. No scratch files or external search outputs are required. Normal regression tests also replay campaign solutions and validate profile scheduling. Browser checks replay the live engine on desktop, portrait and landscape; separate mouse and touch tests exercise the real pullback controls.

## Endless play

Level 46 onward schedules the nine base structures in seeded shuffled cycles without consecutive repeats, including cycle boundaries. Twenty authored field profiles provide additional variation. Demand bands begin at Levels 46, 86 and 126. Populations grow within the verified limits, up to three planets for the eligible single or shared fields. Local multi-core fields retain their proved per-core populations.

Gentle profiles retain two revolutions while population demand grows. Deep and Broad profiles increase from two to three to four revolutions. These explicit ceilings protect the verified solution envelope; difficulty does not grow without bound. Later play continues to generate seeded combinations of the proved profiles and approved orientations.

Only offline-proved transforms enter runtime. Lower bands use their proved canonical orientation. The highest band can use quarter turns and reflections that passed the same sequential, size, viewport and stability protocol. Rejected orientations are excluded by `campaign-endless-transforms.json`. The generator never substitutes an easier objective after a failed runtime search because no runtime search occurs.

Legacy `endless.ts` and `layouts.ts` helpers remain available for custom authoring and compatibility. They are not the runtime campaign or procedural pool, and their old simultaneous witness formations are not current solvability evidence.

## Progress

Browser progress uses `orbit.gravity.progress.v1:<unsigned seed>`. Current index, unlocked index and completed indices remain intact across this revision. Choose Level 1 in Pause to replay the rebuilt campaign. Odessey and creator saves are separate.
