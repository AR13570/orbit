# Stable Gravity integration verification

Historical verification from 18 October 2026. Particle gravity, solution recordings and the generation allowlist were revalidated on 22 October 2026; see the [current stable campaign report](stable-campaign.md). The softening-floor claims below describe the earlier implementation.

## Independent player reviews

The final reviewers found actual problems in the first candidate: speed-only Deep repetitions, a long single-core ending, and pure thinking-pause failures missed by a combined perturbation case. Those findings led to the final changes:

- Deep cores use a softening radius of 200 rather than Gentle’s 180, producing different spatial precession rather than a uniform time rescale.
- Close particle attraction uses a softening floor of 60 world units. Distant attraction, momentum, distinct identities and optional grouping remain intact.
- Four witnesses received small speed or release-spacing corrections. Campaign and endless witness indices were remapped with the new sequence.
- The campaign has at most three consecutive single-core levels, at least three intervening levels between one base's repeats, and a three-particle shared-orbit finale.
- Shield and Crown remain mild practice variants. Stronger experimental repellers failed stability checks and were excluded.

The [critical gamer review](campaign-gamer-review.md) accepts the revised variety and pacing within the approved population-variant scope. It does not claim that source inspection or numerical solutions prove enjoyment.

The [independent sequential audit](independent-sequential-report.md) passed 540 cases across all 45 levels: 180 baseline runs continued at least 120 simulated seconds and 10 further full laps, while 360 pure thinking-pause runs reached the two-orbit goal and continued for 3 simulated seconds. Tight clearance and finite tolerance limits are explicitly recorded.

## Authored and generated proof

The [portable authoring report](stable-campaign.md) and [raw records](stable-campaign.json) contain 45 × 22 = 990 passing campaign scenarios and 185 × 22 = 4070 passing approved generated scenarios. Fifteen rejected orientations are excluded from the runtime allowlist. All profile/band groups retain their published demand without an easier fallback.

The original 15 scenarios require 120 simulated seconds and 10 extra full laps after completion. Seven additional pure-pause scenarios require objective completion and3 more simulated seconds. Every victory remains latched in gameplay, as requested.

## Browser and integration checks

Twenty-one distinct browser cases passed across the final focused run and the replay-selector locator correction: touch feedback in both modes, crowded live prediction, Space/middle-drag panning, 1.5px aiming dots at 50%, 100%, and 200% zoom, all 45 campaign completions on desktop/portrait/landscape, six representative levels through real mouse and touch pulls, and the review page's sequential replay without changing saved progress.

The [replay page](campaign-replay.html) uses the current provider and physics. It launches recorded shots one by one and continues after completion. It is a development review artifact, not an automatic solver in the game.

The final regression command excludes only the unchanged expensive Odessey exhaustive shortcut-search file:

```sh
npm test -- --exclude tests/engine/progression.test.ts --maxWorkers=2 --testTimeout=30000
npm run build
git diff --check
```

The focused physical suite independently passed 195 tests after the final softening change. The final broad regression passed 92 files and 922 tests, with five opt-in authoring tests skipped. TypeScript and the production build passed after the final allowlist was published. The replay-page test initially used a label locator that did not match the native selector; its accessible combobox locator passed on retry.

Mobile haptic API calls were verified through real browser touch input. Physical vibration feel was not tested on a device. iOS browsers without the Vibration API cannot provide this feedback.

No commit or push was made.
