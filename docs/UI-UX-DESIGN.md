# Gunboat Raiders - UI/UX Design Guide

## Title Screen

Live 3D ocean as background (NOT a static image). The water rendering IS the title screen.

- Camera slowly orbits the player gunboat at sunset/dusk
- Camera at waterline height: half above water, half looking into dark endless depth (no seabed)
- Title fades in after 0.5s, menu items animate in staggered (80ms delay each)
- Ambient ocean audio swells from 10% to 100% over 3 seconds
- Transition to gameplay: full-screen fade to black (0.4s), state switch, fade back

## Fonts

- **Display/Title**: Black Ops One (Google Fonts) - military stencil, free
- **HUD/Body**: Rajdhani (Google Fonts) - technical, compact, legible at small sizes

## Color Palette

| Element | Color | Hex |
|---------|-------|-----|
| Armor/Shield | Teal | `#0695b4` |
| Hull (full) | Amber | `#f97316` |
| Hull (low) | Red | `#ef4444` |
| Active quadrant | Amber glow | `#f59e0b` |
| Score positive | Green | `#22c55e` |
| Danger | Red | `#dc2626` |
| Primary text | Off-white | `#e2e8f0` |
| Secondary text | Muted slate | `#94a3b8` |
| UI panel bg | Dark glass | `rgba(10,15,25,0.7)` + `backdrop-filter: blur(12px)` |
| Panel border | Teal 15% | `rgba(45,212,191,0.15)` |

## HUD Layout

Minimal. Water must be visible. No panels over the ocean surface.

```
[Wave Counter]              [Score]
   top center              top right



        [Quadrant Indicator]
            center

                    
[Health Bars]
 bottom left
```

### Health Bars (Bottom Left)
- Armor bar on top (teal), Hull bar below (amber/red)
- No background panel - float directly with thin dark outline
- Update via direct DOM mutation (NOT React state)
- Icon: stylized ship silhouette (SVG, 24x24)

### Quadrant Indicator (Center)
- Compass rose style: 4 arc segments (FORE, AFT, PORT, STARBOARD)
- Active segment glows amber, inactive segments at 20% opacity
- ~80px diameter, CSS rendered

### Wave Counter (Top Center)
- "WAVE 3" in Black Ops One
- Dramatic entrance: scale 1.5x to 1x, fade in 300ms
- Fades to 50% opacity after 3 seconds
- Enemy count below: "3 / 7 REMAINING" in smaller Rajdhani

### Score (Top Right)
- Right-aligned, monospaced
- Flash animation on increase

## Wave Announcements

Cinematic moment:
- Letterbox bars animate in from top/bottom (CSS)
- Wave name in large font, centered, scale-down entrance (150% to 100%, 300ms)
- Sound: low rumble or horn
- Duration: 2.5 seconds, then letterbox retracts

## Wave & Enemy Naming (Narrative Flavor)

Wave names instead of numbers:
- "THE FIRST TIDE"
- "SKIFF PATROL ALPHA-7"  
- "THE RAIDERS OF THE SUNKEN GULF"
- "LAST FUEL RUN"

Enemy ship names (random from pool):
- "The Rusted Mercy", "Saltwater Judgment", "Hull No. 7"
- Appear in kill notifications: "SUNK: THE RUSTED MERCY"

## Damage Feedback (Stacked)

1. Red vignette pulse (postprocessing Vignette, 100ms attack, 600ms decay)
2. Chromatic aberration pulse (offset 0 to 0.005, back)
3. Camera shake (drei CameraShake, intensity proportional to damage)
4. Screen edge flash (CSS radial-gradient overlay, 300ms)

All driven by refs, NOT React state.

## Game Over Screen

- Freeze/slow-mo on killing blow
- 500ms pause
- Canvas blurred via CSS `filter: blur(8px)` + darkened overlay
- Score reveal: Wave Survived, Enemies Sunk, Total Score (counter tick animation)
- "PLAY AGAIN" button (SPACE or ENTER shortcut)
- No main menu button at MVP

## Implementation Architecture

```html
<div style="position: relative; width: 100%; height: 100%">
  <Canvas>
    <GameScene />
    <EffectComposer>
      <Bloom />
      <Vignette ref={vignetteRef} />
    </EffectComposer>
  </Canvas>
  <div id="hud-root" style="position: absolute; inset: 0; pointer-events: none; z-index: 10">
    <!-- All HTML UI lives here -->
    <!-- Interactive children need pointer-events: all -->
  </div>
</div>
```

Do NOT use drei `<Html fullscreen>` for the main HUD. Use a sibling div.
Use drei `<Html>` only for world-space elements (score popups, enemy health bars).

## Audio Sources (Free)

| Sound | Source | License |
|-------|--------|---------|
| UI clicks | Kenney Interface Sounds | CC0 |
| Cannon fire | Pixabay | Royalty-free |
| Explosions | Pixabay | Royalty-free |
| Water splash | Freesound.org | CC0 |
| Metal impact | Kenney Impact Sounds | CC0 |
| Ocean ambience | Freesound.org | CC0 |
