# Independent sequential campaign verification

All 45 final campaign levels passed all 12 independently replayed cases, totaling 540 replays. No planet was lost, no objective qualification dropped, and no launch was blocked by the gameplay clearance check. The verifier used a fresh Rolldown bundle of the actual campaign provider and simulation, without the author's proof helper or acceptance result.

The four normal timing cases per level use radius/mass pairs 4/1, 6/1, 8/4 and 32/4 with particle gravity on at 96,000 and grouping off. All 180 earned the objective after at least two independently measured full revolutions, then survived at least 120 physical seconds and ten further independently measured revolutions per required planet. The eight pure timing cases per level add 3 or 5 physical seconds to every authored launch gap, across the same four radius/mass pairs. All 360 earned the objective and stayed alive, bounded and qualified through three further physical seconds.

The shared fixed step was 1/120 physical second. All adjacent launches were at least five real seconds apart at normal playback 1.2, allowing 1e-7 seconds numerical tolerance. Each launch also passed the actual UI well-clearance predicate and reachable launch-speed cap. The driver checked survival, the authored bounded region, live objective qualification and independent unwrapped angular winding every physical step. The campaign requires at least two complete revolutions, and all attractive cores have radius at least 96.

The normal cases completed in 10.033 to 35.842 physical seconds. Thinking cases completed in 10.033 to 53.108 physical seconds. The minimum normal post-win survival was 120.000000000024 physical seconds, with a minimum 10.0000065759 further laps. All thinking cases survived at least 3.008333333333 physical seconds after completion. These are different verification boundaries: the pure thinking matrix establishes completion plus the three-second transition window, while the normal matrix establishes extended post-win stability. Earned gameplay wins remain latched regardless of later evolution.

The narrowest observed body clearance was 1.18979 world units on level 28, The shield · Gentle · 3, in the +5 physical-second thinking case at radius 32/mass 4. The narrowest normal timing clearance was 3.82953 world units on the same level and size. These positive margins passed the tested witnesses but do not establish tolerance for arbitrary aim errors or indefinite stability. This independent matrix does not claim to replace the separate authored aim perturbation, viewport or browser checks.

The source files under `src/gravity` and `src/game` were SHA-256 hashed immediately before bundling and after the replay. Every hash matched. Exact per-file hashes and the bundle hash are retained in [the complete replay evidence](independent-sequential-results.json). Exact per-level results are also in [the CSV summary](independent-sequential-summary.csv). No game source was changed by this review.

Bundle SHA-256: `ae6832bcbe02cf75d2f17b6af33a55b4303d73e6a605250b0f8badea9b8c5d52`.

## Per-level results

Every row passed 4/4 normal cases and 8/8 thinking cases. Completion ranges include both timing matrices and use physical seconds.

| Level | Base structure | Field | Population per core or shared | Passed | Completion range | Minimum normal post-win seconds | Minimum normal extra laps |
|---|---|---|---:|---|---:|---:|---:|
| 1 | open-sky | gentle | 1 | 12/12 | 11.825–11.825 | 120.000 | 20.12873 |
| 2 | neighbouring-systems | gentle | 1 | 12/12 | 18.492–23.500 | 120.000 | 19.03851 |
| 3 | the-shield | gentle | 1 | 12/12 | 11.742–11.742 | 120.000 | 20.26460 |
| 4 | long-channel | gentle | 1 | 12/12 | 12.042–12.042 | 120.000 | 19.78720 |
| 5 | common-centre | gentle | 1 | 12/12 | 18.058–18.058 | 120.000 | 13.38711 |
| 6 | open-crown | gentle | 1 | 12/12 | 11.683–11.683 | 120.000 | 20.33852 |
| 7 | closed-garden | gentle | 1 | 12/12 | 11.642–11.642 | 120.000 | 20.68564 |
| 8 | open-sky | deep | 1 | 12/12 | 10.308–10.308 | 120.000 | 23.18731 |
| 9 | the-divide | gentle | 1 | 12/12 | 17.383–22.383 | 120.000 | 20.85149 |
| 10 | the-shield | deep | 1 | 12/12 | 10.242–10.242 | 120.000 | 23.33221 |
| 11 | long-channel | deep | 1 | 12/12 | 10.483–10.483 | 120.000 | 22.80870 |
| 12 | open-crown | deep | 1 | 12/12 | 10.183–10.183 | 120.000 | 23.48454 |
| 13 | broken-necklace | gentle | 1 | 12/12 | 24.483–24.483 | 122.042 | 10.00049 |
| 14 | closed-garden | deep | 1 | 12/12 | 10.033–10.033 | 120.000 | 24.03909 |
| 15 | open-sky | gentle | 2 | 12/12 | 19.983–27.033 | 120.000 | 17.37401 |
| 16 | the-shield | gentle | 2 | 12/12 | 19.933–27.050 | 120.000 | 17.47104 |
| 17 | common-centre | deep | 1 | 12/12 | 15.133–15.133 | 120.000 | 16.02220 |
| 18 | long-channel | gentle | 2 | 12/12 | 19.642–26.550 | 120.000 | 17.74587 |
| 19 | open-crown | gentle | 2 | 12/12 | 19.950–26.758 | 120.000 | 17.51897 |
| 20 | closed-garden | gentle | 2 | 12/12 | 18.408–23.933 | 120.000 | 19.31522 |
| 21 | broken-necklace | deep | 1 | 12/12 | 20.533–20.533 | 120.000 | 11.59832 |
| 22 | open-sky | deep | 2 | 12/12 | 15.908–21.225 | 120.000 | 23.13741 |
| 23 | the-shield | deep | 2 | 12/12 | 16.008–21.350 | 120.000 | 23.04151 |
| 24 | long-channel | deep | 2 | 12/12 | 16.142–21.400 | 120.000 | 22.86373 |
| 25 | common-centre | gentle | 2 | 12/12 | 25.275–33.158 | 120.000 | 12.27898 |
| 26 | open-crown | deep | 2 | 12/12 | 15.967–21.258 | 120.000 | 23.09122 |
| 27 | closed-garden | deep | 2 | 12/12 | 15.625–20.733 | 120.000 | 24.40309 |
| 28 | the-shield | gentle | 3 | 12/12 | 22.500–35.300 | 120.000 | 19.48903 |
| 29 | common-centre | deep | 2 | 12/12 | 20.950–26.883 | 120.000 | 15.81769 |
| 30 | long-channel | gentle | 3 | 12/12 | 22.633–35.192 | 120.000 | 19.49104 |
| 31 | open-crown | gentle | 3 | 12/12 | 22.600–35.392 | 120.000 | 19.41917 |
| 32 | closed-garden | gentle | 3 | 12/12 | 22.808–35.092 | 120.000 | 20.46410 |
| 33 | broken-necklace | gentle | 2 | 12/12 | 35.767–39.842 | 148.675 | 10.00001 |
| 34 | open-sky | deep | 3 | 12/12 | 23.550–34.842 | 120.000 | 21.42136 |
| 35 | the-shield | deep | 3 | 12/12 | 23.583–34.825 | 120.000 | 21.41326 |
| 36 | long-channel | deep | 3 | 12/12 | 22.200–33.142 | 120.000 | 22.33993 |
| 37 | broken-necklace | deep | 2 | 12/12 | 31.133–35.142 | 125.283 | 10.00014 |
| 38 | open-crown | deep | 3 | 12/12 | 23.392–34.483 | 120.000 | 21.61084 |
| 39 | closed-garden | deep | 3 | 12/12 | 22.133–32.325 | 120.000 | 23.43125 |
| 40 | open-sky | broad | 3 | 12/12 | 21.225–32.208 | 120.000 | 23.16252 |
| 41 | common-centre | gentle | 3 | 12/12 | 35.575–53.108 | 120.000 | 10.06740 |
| 42 | the-shield | broad | 3 | 12/12 | 21.250–32.183 | 120.000 | 23.18928 |
| 43 | long-channel | broad | 3 | 12/12 | 21.592–32.233 | 120.000 | 23.10046 |
| 44 | closed-garden | broad | 3 | 12/12 | 21.233–31.392 | 120.000 | 25.02896 |
| 45 | common-centre | deep | 3 | 12/12 | 27.542–38.092 | 120.000 | 14.91119 |

## Match with final authored evidence

The final authoring evidence contains 45 campaign entries with 22 cases each, 200 generated candidates, 185 approved transformations and 15 rejected transformations. All required author cases passed their stated completion and survival boundaries. The runtime generation allowlist exactly equals the 185 accepted transformation records, with no rejected or unproved transform included.

All 45 final campaign descriptors matched the independent replay. All 540 overlapping scenario completion times agreed within the author's 12-step sampling cadence, with deltas from 0 to 0.0916667 physical seconds. Every replayed campaign, kernel and witness source file remains byte-identical to the recorded SHA-256 hashes. The only subsequent source change was `src/gravity/campaign-endless-transforms.json`, whose final allowlist was validated separately against all accepted 22-case proofs.

The final source and manifest audit passed. Exact hashes and counts are recorded in [the final audit evidence](independent-sequential-final-audit.json).
