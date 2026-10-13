# Orbit

A full-screen, minimalist gravity slingshot game built with React, TypeScript, Vite and Canvas2D. Flat weighted objects and ripple bands sit on one solid ground. Twenty structural families vary gates, clusters, shelves, anchors and other arrangements, with verified curved routes to a nearby checkpoint. Seeded randomness varies the arrangement as you progress, while shared seeds reproduce the same journey.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:5173. Phones on the same network can use the Network URL printed by Vite. No backend, keys, remote fonts or images are needed. Add `?seed=42` to share the initial field of a deterministic run.

## Deploy with Docker on Vercel

Import this repository into Vercel and set the project root to the directory containing `Dockerfile.vercel`. Vercel automatically detects that filename, builds the container and routes requests to its HTTP server on port 80. See [Vercel's Docker deployment guide](https://vercel.com/kb/guide/does-vercel-support-docker-deployments) and [Docker documentation](https://vercel.com/kb/guide/docker).

The multi-stage build installs locked dependencies with `npm ci --include=dev`, runs TypeScript and Vite through `npm run build`, then copies only `dist` into the nginx runtime. No custom server configuration or environment variables are required for Orbit.

Deploy through the connected Git repository, or, with the Vercel CLI already installed, run this from the project root:

```sh
vercel deploy
```

To build and run the same container locally with Docker installed and running:

```sh
docker build -f Dockerfile.vercel -t orbit .
docker run --rm --name orbit -p 8080:80 orbit
```

Open http://localhost:8080 or http://localhost:8080/?seed=42. Stop the foreground container with Ctrl+C.

## Play

Click or touch anywhere in the field, pull backward, and release. Your ship flies opposite the drag. Pull farther for more power. Small taps cancel. Double-tap or double-click the field to switch between single and split modes. Both launch one ship; in split mode, tap during flight to split it into three pieces around its current direction. Each shot can split once. The selected mode persists across checkpoints and New seed. There are no sliders or separate launch action. A short dotted prediction appears during the pull. You cannot steer in flight.

Aim to curve through the obstacle arrangement. Larger bodies exert stronger forces. Blue-marked bodies attract, rust-marked bodies repel, and all solid surfaces can crash your ship. The small blue checkpoint well, marked with a flag, pulls approaching ships strongly inward. Reach its capture ring to advance automatically to the next field, where it becomes your new launch point.

Each drag release launches one ship. A missed shot automatically resets at the current checkpoint after brief feedback, with unlimited retries and checkpoint progress retained. Every solid object attracts or repels according to its size.

Use the top reset icon or R to reset the current shot while keeping the seed, layout, checkpoint progress and shoot mode. Reset also cancels a held pull. It is briefly disabled while a completed checkpoint advances. R ignores key repeats, typing fields and browser modifier shortcuts. Use the pause icon, Escape or P to pause and cancel a held pull. The pause menu contains help, optional sound, New seed and a free Reset shot action during flight. New seed creates a fresh procedural field and resets checkpoint progress. Switching apps pauses until you manually resume. Resize or orientation change cancels a pull safely. Shots keep moving under gravity outside the visible field. Each piece has six active seconds to return; re-entry resets its timer, and pause freezes it. When every surviving piece is outside, a quiet countdown shows the longest remaining chance. The shot retries only after every piece is lost.

## Checks

```sh
npm test
npm run build
npm run test:e2e
```

Browser tests expect the local server on port 5173 and Chromium (`npx playwright install chromium`). Tests use seeded engine metadata only in the harness, then operate real mouse/touch gestures. They cover automatic consecutive checkpoints, unlimited retries with retained progress, pause/help, gesture cancellation, multi-touch, full viewport layouts and console errors.

## Architecture

- `src/game`: pure fixed-step physics, size-based forces, global offset landscape sectors and deterministic verified generation.
- `src/render`: flat Canvas2D geometry, camera interpolation and uniform coordinate transforms.
- `src/styles`: full-screen responsive scene and modal controls.
- `src/App.tsx`: gestures, semantic overlay, active-time lifecycle, sound.

The current contracts are `docs/engine-api.md` and `docs/visual-api.md`. The replacement brief and verification history are in `docs/redesign-plan.md` and `docs/redesign-progress.md`; earlier implementation docs are historical.
