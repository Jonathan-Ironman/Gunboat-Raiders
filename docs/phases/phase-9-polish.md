# Phase 9: Visual Polish (VFX, Post-Processing, Audio)

## Objective

Add particle effects (muzzle flash, explosions, water splash), post-processing (bloom, vignette), camera shake, and audio (cannon fire, explosions, ambient ocean). This phase is ALL polish -- the game must be fully playable before this phase begins.

## Prerequisites

- ALL phases 0-8 complete (game is fully playable)

## Files to Create/Modify

```
src/
  effects/
    PostProcessing.tsx       # EffectComposer: Bloom + Vignette
    ParticleManager.tsx      # three.quarks BatchedRenderer
    MuzzleFlash.tsx          # Cannon fire particle burst
    Explosion.tsx            # Hit impact particle system
    WaterSplash.tsx          # Water impact particles
    CameraShake.tsx          # Wrapper for drei CameraShake
  audio/
    AudioManager.ts          # Howler.js setup, sound loading, pooling
    sounds.ts                # Sound definitions and file paths
  systems/
    WeaponSystemR3F.tsx      # Modify: trigger VFX + audio on fire
    DamageSystemR3F.tsx      # Modify: trigger VFX + audio on hit
    ProjectileSystemR3F.tsx  # Modify: trigger splash VFX on water impact
  App.tsx                    # Add PostProcessing, ParticleManager
```

## Implementation Details

### 1. Post-Processing (`PostProcessing.tsx`)

```tsx
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';

// Bloom picks up emissive materials with toneMapped={false}
// Vignette adds atmospheric darkening at edges
// Dynamic vignette: pulse darkness on player damage
```

Configuration:
- `<Bloom luminanceThreshold={1} luminanceSmoothing={0.9} intensity={0.5} />`
- `<Vignette eskil={false} offset={0.1} darkness={0.5} />`
- On player damage: animate vignette darkness to 0.9 then back to 0.5 over 0.3s
- Use a zustand state flag or event emitter for damage flash trigger

Key: all emissive particle materials must use `toneMapped={false}` to exceed the HDR threshold and trigger bloom.

### 2. Particle Manager (`ParticleManager.tsx`)

- three.quarks `BatchedRenderer` added to the R3F scene
- Single instance, created on mount
- Particle systems registered/unregistered as effects fire
- Alternatively: if three.quarks integration proves difficult, fallback to drei `<Sprite>` + `<Billboard>` based simple effects

### 3. Muzzle Flash (`MuzzleFlash.tsx`)

- Triggered when cannons fire (from WeaponSystem)
- 5-10 bright orange/yellow particles
- Short lifetime: 0.15 seconds
- High initial velocity outward from cannon mount
- Emissive material: `color={[5, 3, 0]}` with `toneMapped={false}` for bloom
- Spawn at each mount position that fires

### 4. Explosion (`Explosion.tsx`)

- Triggered on cannonball-boat impact (from DamageSystem)
- 20-30 particles: orange/red core + grey smoke
- Expanding sphere pattern
- Lifetime: 0.5 seconds
- Core particles emissive for bloom
- Smoke particles: non-emissive grey, slower, larger, fade out

### 5. Water Splash (`WaterSplash.tsx`)

- Triggered on cannonball water impact (from ProjectileSystem)
- 15-20 white/light-blue particles
- Column shape (upward velocity)
- Lifetime: 0.3 seconds
- Not emissive (no bloom on water splashes)

### 6. Camera Shake (`CameraShake.tsx`)

- drei `<CameraShake>` component
- Triggered on nearby explosions
- Intensity proportional to distance from explosion: `intensity = maxIntensity * (1 - dist / maxDist)`
- Duration: 0.2 seconds
- MaxDist: 30 meters (explosions further than this don't shake)
- Frequency: 10-15 Hz

### 7. Audio Manager (`AudioManager.ts`)

```typescript
import { Howl, Howler } from 'howler';

interface SoundConfig {
  src: string[];
  volume: number;
  pool: number;    // max simultaneous instances
  loop?: boolean;
}

const SOUNDS: Record<string, SoundConfig> = {
  cannon_fire: { src: ['/audio/cannon.mp3'], volume: 0.7, pool: 10 },
  explosion:   { src: ['/audio/explosion.mp3'], volume: 0.8, pool: 5 },
  splash:      { src: ['/audio/splash.mp3'], volume: 0.5, pool: 8 },
  engine_hum:  { src: ['/audio/engine.mp3'], volume: 0.3, pool: 1, loop: true },
  ambient:     { src: ['/audio/ocean-ambient.mp3'], volume: 0.2, pool: 1, loop: true },
};
```

- `AudioManager.init()`: preload all sounds
- `AudioManager.play(name, position?)`: play a sound, optionally with 3D position
- `AudioManager.setListenerPosition(position)`: update Howler listener position each frame
- Engine hum: volume modulated by player thrust input (0 when idle, 0.3 when full thrust)
- Ambient ocean: always playing, constant volume

### 8. Sound Files

Sound files go in `public/audio/`. Use royalty-free sound effects:
- For MVP: placeholder sounds are fine. Even simple generated tones work.
- If no audio files are available, create minimal placeholder `.mp3` files or skip audio gracefully (AudioManager should handle missing files without crashing).

### 9. System Integration

**WeaponSystemR3F.tsx** modifications:
- After spawning projectiles, trigger `MuzzleFlash` at each mount position
- Play `cannon_fire` sound at boat position

**DamageSystemR3F.tsx** modifications:
- On projectile-boat collision, trigger `Explosion` at impact point
- Play `explosion` sound at impact point
- If player was hit, trigger vignette damage pulse

**ProjectileSystemR3F.tsx** modifications:
- On projectile water impact, trigger `WaterSplash` at impact point
- Play `splash` sound at impact point
- Trigger camera shake if within range

## Tests to Write

This phase is primarily visual/audio, so testing is limited to:

### `tests/smoke/polish.spec.ts` (Playwright)

```
- test: canvas renders with post-processing active (no crash)
- test: game does not crash when audio context is blocked (autoplay policy)
```

### No new unit tests

VFX and audio are rendering-only concerns. The logic they respond to (firing, damage, impacts) is already tested in prior phases.

## Acceptance Criteria

- [ ] `pnpm verify` passes (no build errors from new components)
- [ ] Post-processing does not crash the renderer
- [ ] Bloom is visible on emissive particles (manual visual check)
- [ ] Audio plays without errors (or fails gracefully if files missing)
- [ ] Camera shake does not cause motion sickness (short duration, moderate intensity)
- [ ] FPS remains above 50 with all effects active (manual check in dev tools)
- [ ] Playwright smoke: page loads and canvas renders with all effects

## Verification Command

```bash
pnpm verify
```
