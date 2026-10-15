# Gravity rebuild specification

## Intent and authorization

Replace Gravity with the mechanics of Orbit Playing with Gravity, using Orbit's own colorful interface. The user authorized implementation in the existing checkout, preserving current start screen and help work. No commits, dependency installations, or parallel lints.

## Boundaries

The simulation core owns static attractor and repellent wells, moving colored planets, arbitrary position launches, mutual gravity, optional collisions, bounded trails, prediction and objective evaluation. The interface owns pointer gestures, presentation, menus and settings. A separate level provider owns campaign, procedural levels, progress and persistence. Existing creator v1 and legacy objective adapters continue to function.

## Simulation contract

Use physical world velocities and acceleration with fixed 1/120 second velocity Verlet steps. Playback defaults to 1.65 and can range from 0.25 to 2 without changing orbit geometry. Pause freezes all simulation time and trails. Planets have consistent mass and radius. Planet gravity is configurable, and collision policy is explicit. Wells absorb swept planet contacts. There is no launch count limit, age expiry or viewport expiry. Only unbound outward motion beyond a generous far field may be pruned. Memory is bounded to 512 points per trail and 96 dead particle remnants. Optional circle and oscillation motions position wells from physical time with swept relative collisions and velocity relative goal binding.

Launch from any finite world position with a finite velocity. Legacy aim launches remain available. Prediction clones the whole current state, adds the proposed planet and advances the identical physics without mutating live state. Colors are deterministic and vivid. Completion latches but motion and further launches can continue; retry works after completion and advancement is explicit.

## Objective contract

Retain the five legacy objective families and add explicit per body counts, revolutions and signed directions. Count living bound orbiters with completed signed winding and unique assignment so one planet cannot populate multiple wells. Shared loops are distinguishable from local loops. Completion depends on living bound orbiter populations and completed revolutions, with no elapsed-time waiting condition. Legacy hold metadata is ignored for compatibility. The criteria are configurable game rules, not a claim to reproduce undisclosed reference heuristics.

## Campaign and service uncertainty

The user authorized a new reference inspired campaign using the available images rather than exact original definitions. Build 45 authored levels and an endless continuation without describing them as the original campaign. A provider function supplies levels independently. Community publishing requires a real backend; local level storage and import/export cannot be presented as community publishing.

## Verification

Test momentum conservation, stable repeated orbits, collisions and absorption, prediction agreement and nonmutation, 128 planet launches, long lived offscreen orbits, playback geometry, pause, objective flyby rejection and unique assignment. Browser and UI verification belongs to the interface worker; the root coordinates the final complete suite.

## Published core API

`new GravityEngine(seed?, customLevel?, levelProvider?)` uses a provider `(seed, index) => GravityLevel`. `goTo(index)`, `skip()`, `advance()` and `retry()` manage the board without storage side effects. Custom levels disable provider navigation.

`launchFrom(position, velocity)` accepts physical world velocity. `setLaunch(position, aim)`, `setAim(angle, power)` and `launch()` provide legacy normalized power aiming. `predictFrom(position, velocity, seconds)` and `predict(seconds)` simulate physical seconds, independent of playback speed.

`setPaused(boolean)`, `setTimeScale(number)`, `setPhysics(options)` and `clearTrails()` control simulation. Settings are normalized and retained on retry. `getSnapshot()` returns an independent clone; `getRenderSnapshot()` is an ephemeral reference view whose nested state must never be retained or mutated.

`GravityLevel.requirements` supplies body IDs, counts, turns and optional clockwise or counterclockwise directions. `GravityLevel.physics` enables planet gravity, none/elastic/merge planet contacts, optional well absorption, mass, radius, gravity strength, trail duration and far field pruning distance. Defaults preserve legacy independent planets; new sandbox callers explicitly enable mutual gravity and merge contacts. `GravityLevel.motions` supplies circle or oscillation motion around immutable centers, with physical period and phase.

## Core verification record

The four focused core test files pass 42 tests. Coverage includes a 200 physical second offscreen orbit, 128 mutually attracting planets, swept elastic crossing, trail duration with 512 point bounds, moving well reset and prediction, relative velocity binding, nonmutating N body prediction, playback geometry and completion lifecycle. Final integration suite and browser checks are coordinated by the root worker.
