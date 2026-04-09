# Phase 10: Build Optimization and Deployment

## Objective

Optimize the production build, deploy to Cloudflare Pages, and verify the deployed game loads and runs correctly.

## Prerequisites

- ALL phases 0-9 complete (game is fully playable and polished)

## Files to Create/Modify

```
vite.config.ts              # Production build optimization
wrangler.toml               # Cloudflare Pages config (optional, can use CLI)
```

## Implementation Details

### 1. Vite Build Optimization (`vite.config.ts`)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei', '@react-three/postprocessing'],
          rapier: ['@react-three/rapier'],
          quarks: ['three.quarks'],
        },
      },
    },
  },
});
```

### 2. Asset Budget Check

Before deploying, verify:
- Total JS bundle (gzipped): target under 2 MB
- Total assets (models, audio, textures): target under 20 MB total
- No unnecessary dev dependencies in production bundle

```bash
pnpm build && du -sh dist/
# Check individual chunks:
ls -la dist/assets/*.js
```

### 3. Local Production Test

```bash
pnpm build && pnpm preview
```

Open `http://localhost:4173` and verify:
- Game loads without errors
- Title screen appears
- Game starts and plays correctly
- No console errors in production mode
- Assets (models, audio) load correctly

### 4. Cloudflare Pages Deployment

Option A: CLI deployment (recommended for automation):

```bash
pnpm add -D wrangler
pnpm build
pnpm exec wrangler pages deploy dist --project-name=gunboat-raiders
```

Option B: Git-connected deployment:
- Connect repository to Cloudflare Pages dashboard
- Build command: `pnpm build`
- Build output directory: `dist`
- Node.js version: 20+

### 5. Post-Deployment Verification

After deployment, verify at the live URL:
- Page loads within 5 seconds on broadband
- Canvas renders (WebGL context created)
- Title screen visible
- Game starts on click
- No CORS errors for assets
- No console errors

## Tests to Write

### `tests/smoke/production.spec.ts` (Playwright)

```
- test: production build serves without errors (run against preview server)
- test: canvas element exists
- test: title screen text is visible
- test: no console errors on page load
```

### Build Verification (shell commands)

```bash
# Build succeeds
pnpm build

# Bundle size check (JS under 2MB gzipped)
# This is a manual check - dev agent should report the actual sizes

# Asset size check (total under 20MB)
du -sh dist/
```

## Acceptance Criteria

- [ ] `pnpm build` completes with zero errors and zero warnings
- [ ] `dist/` directory is under 20 MB total
- [ ] `pnpm preview` serves the game locally without errors
- [ ] Playwright smoke against preview server passes
- [ ] `pnpm verify` passes one final time
- [ ] Game deployed to Cloudflare Pages at a public `*.pages.dev` URL
- [ ] Deployed URL loads within 5 seconds
- [ ] Deployed game is playable (title -> start -> combat -> game-over -> restart)

## Verification Command

```bash
pnpm verify && pnpm build && pnpm test:smoke
```
