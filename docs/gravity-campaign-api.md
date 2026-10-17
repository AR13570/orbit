# Gravity campaign and endless provider

The 45-level campaign is newly authored and inspired by the reference game's App Store screenshots. It is not a copy of its undisclosed levels. The first eight stages already alternate isolated capture, twin homes, shared loops, opposing directions, same-planet handoffs, repeller pockets and three-core fields.

## Campaign design

`src/gravity/campaign-design.ts` defines all 45 spatial arrangements and their goals. Titles describe the current challenge. Every six-level window contains at least three challenge types. Most stages need one or two planets, with a maximum of four assigned orbiters, so progression comes from trajectories and field interactions rather than bigger crowds.

- **Local orbits:** assign separate living planets to the marked cores. Some fields have non-target cores that disturb the route. Curved arrows identify required clockwise or counterclockwise orbits.
- **Shared orbits:** each qualifying planet must circle every named core in one shared loop. Circling their midpoint alone does not qualify. Later stages add strong mass imbalance and repellers directly on outer flight lanes.
- **Opposing shared orbits:** establish a shared loop in each direction with different planets. The goal cannot be satisfied by two planets moving the same way.
- **Relays:** one living planet must sweep a curved arc inside each encounter region, in order. Different planets cannot pool visits. The active region has a faint dashed boundary and a filling arc, with a matching lettered progress row.
- **Transfer and capture:** complete the relay and then remain inside the destination region for a full revolution. Levels 28, 41 and 45 use this finish. Level 45 returns to its starting core after visiting the other two.
- **Moving fields:** wells move physically; late motion is more pronounced. Tidal balance asks for two revolutions around the outside cores while a moving central well disturbs their paths.

Flyby sweep demands increase in later relays. A visit is not credited for simply spawning inside a region, remaining stationary, or approaching cores out of order. Partial sweep resets on leaving the encounter region; completed legs persist while that planet remains alive. No goal depends on elapsed time. The normal three-second Next level transition is presentation, not a win condition.

Grouping remains independently configurable in Advanced and defaults off. Mutual particle attraction remains on by default. Levels preserve the player's physics preferences; they never silently enable grouping or disable gravity.

## Provider and authoring evidence

`getGravityLevel(seed, index)` in `src/gravity/campaign.ts` supplies fixed campaign indices 0 through 44, followed by seeded endless levels. Campaign coordinates are seed-independent. `getCampaignCatalog()` returns cloned `{ index, title, family, mechanics }` entries. Catalog `family` is the layout identifier; `GravityLevel.family` retains the legacy objective adapter for compatibility.

`campaign-witnesses.json` records physically reachable launch positions, velocities and launch times. These never launch on the player's behalf. Normal startup loads the recorded data without running a solution search. `tests/gravity/campaign-authoring.test.ts` is an opt-in authoring search:

```sh
GRAVITY_AUTHOR_CAMPAIGN=1 npm test -- tests/gravity/campaign-authoring.test.ts --maxWorkers=1
```

The authoring pass rejects candidates that fail at world radii 4, 6, 8, 12 or 16, at the actual camera-calibrated default sizes for desktop, phone, small phone and landscape, or with half-sized physics steps. `campaign-playability.test.ts` also replays all 45 against actual outermost-view removal bounds. The browser campaign suite replays all 45 through the live engine, completion UI and level navigation on desktop, portrait and landscape. Separate input playtests cover real mouse and touch launches.

## Endless play

Level 46 onward uses `campaign-endless.ts` and all 45 campaign structures. The eight introductory layouts receive advanced goals: opposing local directions, opposing shared duets, multiple orbiters or a destination capture. Local, shared and relay families alternate, while each family reshuffles deterministically without immediately repeating a template. Every six-stage window includes all three families. Opposing shared loops, moving wells and transfer captures remain part of the pool.

Difficulty is a global band: Level 46 starts at band 0, Level 76 at band 1, and Level 106 at band 2. Stable orbit goals gain up to two turns, capped at three. Chaotic fields have explicit verified ceilings of one or two turns so their challenge remains finding a trajectory rather than surviving an arbitrarily long wait. Non-capture relay arcs increase by 10% and then 20%; destination captures remain one full orbit. Populations, force baselines and playback speed do not increase with the band. A given template's demand never decreases.

Seeded variants rotate and reflect bodies, launches and well motion together; reflections also reverse directional requirements. Bounded changes to individual well positions and strengths produce additional field variation. The generator accepts a variant only after its recorded solution succeeds at minimum/maximum planet sizes, calibrated desktop/phone/small-phone/landscape sizes with actual outermost removal bounds, and half-sized physics steps. Failed field perturbations retry the same template and difficulty with its unperturbed transform, then its canonical orientation. A failure never substitutes a lower-demand goal.

`campaign-endless-witnesses.json` records solutions for every template and band. Authoring searches run offline through `GRAVITY_AUTHOR_ENDLESS_CAMPAIGN=1 npm test -- tests/gravity/campaign-endless-authoring.test.ts --maxWorkers=1`; runtime only replays these solutions to validate bounded variants. Returned levels are cloned and the runtime cache remains bounded. Old `endless.ts` formation helpers and their fixtures are retained solely for authoring and physics regressions, and are not scheduled by the game.

## Progress

Browser progress uses `orbit.gravity.progress.v1:<unsigned seed>`. Current index, unlocked index and completed indices remain intact across this campaign revision. Skipping does not record a completion. Replay the rebuilt campaign by choosing Level 1 in Pause. Odessey and creator saves are separate and unchanged.
