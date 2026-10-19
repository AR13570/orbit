# Stable campaign implementation report

The campaign contains 45 distinct authored challenges across 9 reviewed base structures and 20 named field profiles. Population and field variants are identified as variants, never counted as additional geometry. Every campaign objective requires 2 full revolutions. Local multicore challenges target every attractive core equally; shared challenges require each qualifying planet to encircle every attractive core. There are no relay or partial-sweep objectives.

## Verification

- Full portable proof passed in 218.76 seconds. Command: `GRAVITY_VERIFY_STABILITY=1 npx vitest run tests/gravity/stable-authoring.test.ts`.
- All 45 campaign entries passed all 22 scenarios, totaling 990 campaign replays.
- All 20 profiles have approved generation in all 3 demand bands. 185 generated field/band/transform variants passed all 22 scenarios, totaling 4070 approved generated replays. 15 candidates were rejected and are absent from the runtime allowlist.
- The full run examined 200 generated variants, totaling 4400 generated scenario replays. Required failure list is empty.
- Final TypeScript compilation passed. The owned campaign/generator regression run passed 16 tests across 5 files, with 2 opt-in authoring files skipped.
- The original 15 scenarios require survival for at least 120 simulated seconds AND 10 additional complete revolutions after the first completed objective. These include normal sizes, responsive sizes, aim perturbations, the radius 32 pure+3 pause, and the combined opposite-aim/+5 pause. Every particle must survive, remain bounded, and satisfy the objective at the end.
- Seven added pure+3/+5 pause scenarios independently cover radius 4/mass 1, radius 6/mass 1, radius 8/mass 4 and radius 32/mass 4. These require the actual objective followed by 3 simulated seconds. They do not claim 120-second survival. The existing radius 32/+3 case retains the longer original requirement. Each raw result records its exact required duration and laps.
- All shots are at least 6 simulated seconds apart, equivalent to 5 real seconds at default playback 1.2. Selected Deep three-planet witnesses use 6.5-second gaps. Thinking scenarios add 3 or 5 simulated seconds per gap. Aim perturbations alternate +/-0.01 radians, +/-1 percent speed, and +/-1 world unit in both starting-position axes.
- Particle interaction is on at pair strength 96000 with near-field softening `max(60,1.5*(radiusA+radiusB))`; grouping is off. Default mass 1 grows to mass 4 at size factor 2. Responsive evidence covers 1200 x 800, 390 x 844, 320 x 568 and 844 x 390 with the actual fitted default radius `clamp(6/defaultScale,4,16)`, both size factors, and true outermost gameplay flight bounds.
- Maximum authored launch speed is 304.38, below the reachable 460 cap. Powers use the actual inverse launch response.
- The proof calls the actual simulation and tracks first completion independently of the engine victory latch. The gameplay win remains earned once achieved.

## Authored fields, progression and limits

Attractive cores have minimum physical radius 96; repellers have radius 57. Gentle fields use core strength 12000000 and softening 180, Deep 18000000 and softening 200, Broad 24000000 and softening 240. Deep therefore changes the spatial force profile rather than duplicating Gentle trajectories under a faster clock. Force and potential match; legacy bodies retain default softening 40.

The 9 included structures are Open sky, Neighbouring systems, A common centre, The shield, Long channel, The divide, Open crown, Closed garden and Broken necklace. Maximum population is 3. Neighbouring systems and The divide each require 1 planet around each of 2 cores. The reordered campaign never exceeds 3 consecutive single-core challenges and finishes with the 3-planet Deep common-centre shared orbit. Ordering changes preserve each authored witness identity.

Shield, Channel and Crown are gentle practice fields whose canonical paths have comparatively weak repeller influence. They should not be described as radically different orbital mechanics. Stronger profile-wide repellers were tested but rejected because population 2/3 or Broad configurations lost planets. Singleton-only force changes were not shipped. Their positions still constrain off-route launches, while Divide, Garden and Necklace have stronger demonstrated repeller effects.

Giant and companions, Three harbours and Uneven constellation were excluded after actual core collisions in compact local-well experiments. Unstable 4-planet populations were excluded. Illustrated paths are design intent, not numerical evidence. Unverified prototypes are not shipped as solved levels.

The generator deterministically shuffles 9 base structures without consecutive same-base repeats and cycles their proved profiles by seed. Population grows only to the profile's validated ceiling. Gentle profiles retain 2 revolutions in every band; Deep and Broad progress 2, 3, 4. Bands start at displayed levels 46, 86, 126. Approved quarter turns/reflections are variations, not new structures. Runtime uses checked-in witnesses and the offline allowlist, without expensive searches or reducing difficulty after a failure.

The additional pure-pause tests were introduced after independent review found pause-sensitive encounters that combined aim/timing cases had missed. The floor 60 force profile and four modest witness corrections remove the observed pre-completion failures in the accepted matrix. They do not establish indefinite stability or every possible delay. Some independently tested pure-pause paths can fail well after earning their win; the finite matrix and separate 3-second/120-second requirements make that limitation explicit. No claim covers arbitrary launch errors, all intermediate viewports, or unlimited elapsed time.

## Full 45-level coverage

Completion ranges include all 22 scenarios. Long survival and additional laps use only the 15 long-proof scenarios. Pure-pause survival uses the 7 added completion-plus 3-second scenarios. Times are simulated seconds.

| Level | Base | Field | Population | Completion range | Long survival minimum | Extra laps minimum | Added-pause survival minimum |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | open-sky | gentle | 1 | 11.71-12.01 | 120.00 | 19.00 | 3.10 |
| 2 | neighbouring-systems | gentle | 2 | 18.31-23.71 | 120.00 | 19.00 | 3.10 |
| 3 | the-shield | gentle | 1 | 11.81-11.81 | 120.00 | 20.00 | 3.10 |
| 4 | long-channel | gentle | 1 | 11.91-12.21 | 120.00 | 19.00 | 3.10 |
| 5 | common-centre | gentle | 1 | 17.81-18.41 | 120.00 | 13.23 | 3.10 |
| 6 | open-crown | gentle | 1 | 11.71-11.71 | 120.00 | 20.00 | 3.10 |
| 7 | closed-garden | gentle | 1 | 11.61-11.81 | 120.00 | 20.00 | 3.10 |
| 8 | open-sky | deep | 1 | 10.21-10.51 | 120.00 | 22.00 | 3.10 |
| 9 | the-divide | gentle | 2 | 17.41-22.51 | 120.00 | 20.00 | 3.10 |
| 10 | the-shield | deep | 1 | 10.31-10.31 | 120.00 | 23.00 | 3.10 |
| 11 | long-channel | deep | 1 | 10.41-10.71 | 120.00 | 22.00 | 3.10 |
| 12 | open-crown | deep | 1 | 10.21-10.21 | 120.00 | 23.00 | 3.10 |
| 13 | broken-necklace | gentle | 1 | 24.41-24.71 | 121.40 | 10.00 | 3.10 |
| 14 | closed-garden | deep | 1 | 10.01-10.21 | 120.00 | 23.00 | 3.10 |
| 15 | open-sky | gentle | 2 | 20.01-27.11 | 120.00 | 17.00 | 3.10 |
| 16 | the-shield | gentle | 2 | 20.01-27.11 | 120.00 | 17.00 | 3.10 |
| 17 | common-centre | deep | 1 | 15.01-15.41 | 120.00 | 15.75 | 3.10 |
| 18 | long-channel | gentle | 2 | 19.71-26.61 | 120.00 | 17.00 | 3.10 |
| 19 | open-crown | gentle | 2 | 19.91-26.81 | 120.00 | 17.00 | 3.10 |
| 20 | closed-garden | gentle | 2 | 18.41-24.01 | 120.00 | 19.00 | 3.10 |
| 21 | broken-necklace | deep | 1 | 20.51-20.71 | 120.00 | 11.51 | 3.10 |
| 22 | open-sky | deep | 2 | 15.91-21.31 | 120.00 | 23.00 | 3.10 |
| 23 | the-shield | deep | 2 | 16.01-21.41 | 120.00 | 23.00 | 3.10 |
| 24 | long-channel | deep | 2 | 16.11-21.41 | 120.00 | 22.00 | 3.10 |
| 25 | common-centre | gentle | 2 | 25.21-33.21 | 120.00 | 12.15 | 3.10 |
| 26 | open-crown | deep | 2 | 16.01-21.31 | 120.00 | 23.00 | 3.10 |
| 27 | closed-garden | deep | 2 | 15.71-20.81 | 120.00 | 24.00 | 3.10 |
| 28 | the-shield | gentle | 3 | 22.51-35.31 | 120.00 | 19.00 | 3.10 |
| 29 | common-centre | deep | 2 | 20.91-26.91 | 120.00 | 15.82 | 3.10 |
| 30 | long-channel | gentle | 3 | 22.71-35.31 | 120.00 | 19.00 | 3.10 |
| 31 | open-crown | gentle | 3 | 22.61-35.41 | 120.00 | 19.00 | 3.10 |
| 32 | closed-garden | gentle | 3 | 22.81-35.11 | 120.00 | 20.00 | 3.10 |
| 33 | broken-necklace | gentle | 2 | 35.71-39.91 | 146.80 | 10.00 | 3.10 |
| 34 | open-sky | deep | 3 | 23.61-34.91 | 120.00 | 21.00 | 3.10 |
| 35 | the-shield | deep | 3 | 23.61-34.91 | 120.00 | 21.00 | 3.10 |
| 36 | long-channel | deep | 3 | 22.21-33.21 | 120.00 | 22.00 | 3.10 |
| 37 | broken-necklace | deep | 2 | 30.91-35.21 | 123.50 | 10.00 | 3.10 |
| 38 | open-crown | deep | 3 | 23.41-34.51 | 120.00 | 21.00 | 3.10 |
| 39 | closed-garden | deep | 3 | 22.21-32.41 | 120.00 | 23.00 | 3.10 |
| 40 | open-sky | broad | 3 | 21.31-32.21 | 120.00 | 23.00 | 3.10 |
| 41 | common-centre | gentle | 3 | 35.61-53.11 | 120.00 | 10.00 | 3.10 |
| 42 | the-shield | broad | 3 | 21.31-32.21 | 120.00 | 23.00 | 3.10 |
| 43 | long-channel | broad | 3 | 21.61-32.31 | 120.00 | 23.00 | 3.10 |
| 44 | closed-garden | broad | 3 | 21.31-31.41 | 120.00 | 25.00 | 3.10 |
| 45 | common-centre | deep | 3 | 27.61-38.11 | 120.00 | 10.00 | 3.10 |

## Generated coverage

Population below is per core for local requirements, or the shared population for outer-orbit challenges.

| Profile | Band 0 | Band 1 | Band 2 | Approved band 2 orientations |
|---|---|---|---|---:|
| broken-necklace:deep | 1 / 2 laps | 2 / 3 laps | 2 / 4 laps | 8 |
| broken-necklace:gentle | 1 / 2 laps | 2 / 2 laps | 2 / 2 laps | 8 |
| closed-garden:broad | 3 / 2 laps | 3 / 3 laps | 3 / 4 laps | 8 |
| closed-garden:deep | 1 / 2 laps | 2 / 3 laps | 3 / 4 laps | 8 |
| closed-garden:gentle | 1 / 2 laps | 2 / 2 laps | 3 / 2 laps | 3 |
| common-centre:deep | 1 / 2 laps | 2 / 3 laps | 3 / 4 laps | 8 |
| common-centre:gentle | 1 / 2 laps | 2 / 2 laps | 3 / 2 laps | 4 |
| long-channel:broad | 3 / 2 laps | 3 / 3 laps | 3 / 4 laps | 8 |
| long-channel:deep | 1 / 2 laps | 2 / 3 laps | 3 / 4 laps | 8 |
| long-channel:gentle | 1 / 2 laps | 2 / 2 laps | 3 / 2 laps | 8 |
| neighbouring-systems:gentle | 1 / 2 laps | 1 / 2 laps | 1 / 2 laps | 8 |
| open-crown:deep | 1 / 2 laps | 2 / 3 laps | 3 / 4 laps | 8 |
| open-crown:gentle | 1 / 2 laps | 2 / 2 laps | 3 / 2 laps | 6 |
| open-sky:broad | 3 / 2 laps | 3 / 3 laps | 3 / 4 laps | 8 |
| open-sky:deep | 1 / 2 laps | 2 / 3 laps | 3 / 4 laps | 8 |
| open-sky:gentle | 1 / 2 laps | 2 / 2 laps | 2 / 2 laps | 8 |
| the-divide:gentle | 1 / 2 laps | 1 / 2 laps | 1 / 2 laps | 8 |
| the-shield:broad | 3 / 2 laps | 3 / 3 laps | 3 / 4 laps | 8 |
| the-shield:deep | 1 / 2 laps | 2 / 3 laps | 3 / 4 laps | 8 |
| the-shield:gentle | 1 / 2 laps | 2 / 2 laps | 3 / 2 laps | 4 |

Raw replay evidence is in `docs/verification/stable-campaign.json`. All permanent authoring commands use repository data; no temporary file is a required input.
