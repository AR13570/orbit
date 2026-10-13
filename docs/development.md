# Development and hosting

For contributors and anyone who wants to run or host their own copy of Orbit.

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

The current contracts are [engine API](engine-api.md) and [visual API](visual-api.md). The replacement brief and verification history are in [redesign plan](redesign-plan.md) and [redesign progress](redesign-progress.md); earlier implementation docs are historical.
