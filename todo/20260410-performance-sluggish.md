# Performance still feels sluggish — needs deeper profiling

## Description

Despite significant performance optimizations (commit d9a57fa), the game still feels sluggish to the user. Automated tests show FPS > 30 in headless Chromium which should mean 55-60+ in real Chrome, but the user's subjective experience is that it's still not fluid.

## Context

User feedback 2026-04-10 end of day: "Performance also seems a bit sluggish still."

Previous optimizations (commit d9a57fa):

- Water plane segments 512 → 128 (262K → 16K vertices)
- Fragment shader FBM 9 → 3 calls per pixel
- Removed castShadow from directional light
- Removed Bloom mipmapBlur

`window.__GAME_PERF__` shows decent numbers but the user's perception differs.

## Acceptance Criteria

- [ ] Profile with Chrome DevTools Performance tab, identify remaining bottlenecks
- [ ] Measure actual FPS in user's real browser (not headless)
- [ ] Identify any frame time spikes (hitches) that break fluidity perception
- [ ] Sustained 60 FPS on typical laptop hardware during active gameplay
- [ ] No visible stuttering during firing, enemy spawning, or wave transitions
- [ ] Physics step rate tuned appropriately (variable vs fixed timestep)
- [ ] Manual playtest confirms "smooth" feel

## Relevant Files

- `src/environment/Water.tsx` — water mesh config (currently 128 segments)
- `src/environment/waterShader.ts` — fragment shader complexity
- `src/entities/ProjectilePool.tsx` — 50-slot instanced projectiles
- `src/effects/ParticleManager.tsx` — particle pool management
- `src/effects/PostProcessing.tsx` — Bloom + Vignette passes
- `src/systems/PhysicsSyncSystem.tsx` — per-frame body state caching
- `src/App.tsx` — Physics timeStep config (`vary` vs fixed)

## Notes

- Possible culprits to investigate:
  - Rapier physics substeps too high (try reducing physics tick rate)
  - Too many particles active at once
  - Bloom pass still expensive even without mipmapBlur
  - Sky shader (Preetham) overhead
  - Rocks loading 6 GLB models per frame (batch instance if possible)
  - GLTF model instancing for enemies and rocks could use InstancedMesh
- Consider: frustum culling the water plane, LOD for distant rocks
- Consider: lower physics tick rate (30Hz instead of 60Hz for physics)
- Consider: adaptive quality — detect low FPS and auto-reduce effects
- Use Chrome DevTools Performance profiler, not just FPS counter
