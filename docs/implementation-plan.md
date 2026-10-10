> Historical initial implementation. Superseded by docs/redesign-plan.md and docs/redesign-progress.md.

# Orbit implementation plan

Approved design: a playable infinite procedural gravity journey. Aim and power are selected before explicit launch, flight is unsteered, successful docking banks rewards and opens the next stretch. Three shields, fair retries, bounded powers and penalties, an accessible semantic HUD, optional synthesized sound, and a responsive square Canvas2D world.

## Ownership

- Engine: src/game/**, tests/engine/**, docs/engine-api.md. Pure TypeScript fixed-step physics, deterministic verified generation, force prediction, volley and reward rules.
- Visuals: src/render/**, src/styles/**, docs/visual-api.md. Canvas renderer, responsive ink/mint/coral/gold visual system, uniform square transform.
- Integration: remaining files. React lifecycle and controls, package/configuration, help, sound, persistence, app and browser verification, local server.

## Sequence

1. Scaffold Vite, React, TypeScript and Vitest. Publish integration progress.
2. Consume the engine and visual contracts. Add keyboard, pointer, lifecycle and persistence tests before their implementations.
3. Build semantic HUD, launch/pause/retry/continue/restart controls, help and sound.
4. Run the full suite and production build sequentially. Browser smoke desktop, portrait and landscape including actual flight and state transitions.
5. Leave local server on port 5173 and report URLs, screenshots and remaining issues.

## Decisions

The human authorized concurrent work in this checkout. No worktree, commit, push, publishing, backend or external asset dependency. Never run parallel lints. Shared APIs must be consumed as published by owners. No production test hooks.
