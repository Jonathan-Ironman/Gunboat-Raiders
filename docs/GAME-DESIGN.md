# Gunboat Raiders - Game Design Document

## Premise

In a drowned world, armed speedboats fight for the last resources on the open sea. You are a Raider.

The ocean is a lawless wasteland. Improvised gunboats -- fast hulls welded with salvaged cannons -- are the only law. Survive the waves. Sink the rest.

## Core Concept

**Genre:** Arcade speedboat combat
**Perspective:** Third-person, camera independent from boat direction
**Mode:** Wave-based arena combat
**Theme:** Post-apocalyptic ocean, Mad Max on water
**Tone:** Gritty, fast, visceral

## Inspirations

| Game | What we take |
|---|---|
| Assassin's Creed: Black Flag | Broadside cannon mechanics, trajectory preview |
| Firefly (our 2D space shooter) | ECS architecture, energy-shield-hull triangle, wave spawning, AI archetypes |
| Mad Max: Fury Road | Post-apocalyptic aesthetic, improvised weapons, relentless action |
| Dredge | Atmospheric ocean, dark undertones |
| Sunless Sea | Mysterious ocean, tension |

## Controls

### Movement (WASD)
- **W** - Forward thrust
- **S** - Reverse thrust (slower)
- **A/D** - Turn port/starboard

### Camera & Aiming (Mouse)
- Mouse moves camera independently of boat direction
- Camera orbits around the boat
- Firing direction determined by camera quadrant relative to boat

### Firing Quadrant System
```
         FORE (2 small cannons)
            ^
            |
PORT   <--- BOAT ---> STARBOARD
(4 broadside)    (4 broadside)
            |
            v
         AFT (1 small cannon)
```

- Camera facing left of boat heading -> fires PORT broadsides
- Camera facing right of boat heading -> fires STARBOARD broadsides  
- Camera facing forward -> fires FORE cannons
- Camera facing backward -> fires AFT cannon
- Click to fire the active quadrant
- Transparent trajectory arc shows where cannonballs will land (AC: Black Flag style)

### MVP: Single Cannon Type
All positions use the same cannon type (just different counts per side). Architecture supports different weapon types per mount point for later expansion.

## Combat Mechanics

### Damage System (from Firefly)
- **Armor** - Absorbs damage before hull. Regenerates slowly.
- **Hull** - Direct HP. No regeneration. When hull reaches 0, boat sinks.
- **Fuel** - MVP: unlimited. Designed for later implementation.

### Cannonball Physics
- Physical projectile entities with Rapier rigid body physics
- Affected by gravity (arc trajectory)
- Splash damage on water impact near boats
- Direct hit damage on boat collision
- Visual: cannonball trail, muzzle flash, impact explosion, water splash

## Game Loop

### Wave-Based Arena
1. Player spawns in open ocean arena
2. Enemy boats spawn in waves (seeded, deterministic)
3. Each wave is harder: more enemies, tougher types
4. Kill all enemies in a wave to advance
5. Brief respite between waves
6. Survive as many waves as possible
7. Score based on waves survived + enemies sunk

### Enemy Archetypes (MVP: 1-2 types)

**Skiff (Grunt)** - MVP
- Small, fast, lightly armed
- 2 broadside cannons
- Low armor, low hull
- Simple AI: approach and broadside

**Barge (Heavy)** - MVP stretch
- Large, slow, heavily armed
- 6 broadside cannons
- High armor, high hull
- Parks and fires broadsides

*Designed for later:*
- Raider (flanking AI)
- Torpedo Boat (ranged, homing weapons)
- Boss: Warship (massive, multi-phase)

## Environment

### MVP
- Endless ocean (Gerstner wave water shader)
- Procedurally placed rock formations (seeded)
- Skybox (atmospheric, post-apocalyptic)

### Designed for later
- Reefs (shallow water hazard)
- Shipwrecks (cover, loot)
- Floating mines (explosive obstacle)
- Weather changes (storm = bigger waves = harder combat)

## Visual Style

- Gritty post-apocalyptic
- Rusty metal, welded plates, improvised engineering
- Muted palette: steel grey, rust orange, deep ocean teal
- Contrast: bright muzzle flashes and explosions against dark water
- Bloom on all fire/explosion effects
- Camera shake on impacts

## HUD

- Health bars (armor + hull) - bottom left
- Wave counter - top center
- Score - top right
- Active quadrant indicator - around crosshair
- Trajectory preview - in-world transparent arc

## Tech Stack

| Component | Library |
|---|---|
| Rendering | Three.js via React Three Fiber |
| Physics | react-three-rapier v2 (Rapier WASM) |
| Helpers | drei |
| Post-processing | @react-three/postprocessing |
| Particles/VFX | three.quarks |
| Audio | Howler.js |
| State | Zustand |
| Water | Custom Gerstner waves (shader + CPU mirror) |
| Build | Vite + TypeScript |
| Deploy | Cloudflare Pages |

## Architecture

### ECS-Inspired (from Firefly)
- Entities as component-bearing objects
- Systems as per-frame logic (useFrame hooks)
- Components as typed data structures

### Key Systems
1. **WaterSystem** - Gerstner wave shader + CPU height sampling
2. **BuoyancySystem** - Multi-point hull sampling, applies forces via Rapier
3. **MovementSystem** - Thrust, drag, turning physics
4. **WeaponSystem** - Cooldowns, firing, projectile spawning
5. **ProjectileSystem** - Cannonball flight, collision, damage
6. **AISystem** - Enemy behavior state machines
7. **WaveSystem** - Enemy spawning, wave progression
8. **DamageSystem** - Armor/hull damage calculation
9. **CameraSystem** - Independent orbit camera, quadrant detection
10. **VFXSystem** - Particle effects, screen effects

## MVP Roadmap (Incremental)

| Step | Deliverable | Milestone |
|---|---|---|
| 1 | Water + skybox + camera | Visual foundation |
| 2 | Boat model + movement + buoyancy | Sailing works |
| 3 | Camera quadrant system + aiming | Targeting works |
| 4 | Cannons + projectiles + collision | Combat works |
| 5 | Enemy boat + basic AI | Enemies work |
| 6 | Wave spawning + scoring | **PLAYABLE GAME** |
| 7 | HUD (health, wave, score) | Game is readable |
| 8 | Rocks (seeded obstacles) | Tactical depth |
| 9 | Polish: particles, sound, juice | Game feels good |
| 10 | Deploy to Cloudflare Pages | **SUBMITTABLE** |

## Competition

- **Event:** Three.js Water Pro Giveaway
- **Judge:** Dan Greenheck (creator of Three.js Water Pro)
- **Deadline:** Monday 2026-04-13 00:00 UTC
- **Criteria:** Playable game, water/ocean theme, creative, built from scratch
- **Submit:** Reply to LinkedIn post with game link
