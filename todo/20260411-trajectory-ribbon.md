# Trajectory preview: upgrade line → semi-transparent ribbon

**Priority:** LOW — later in the process, after gameplay and wave feel are locked in.

## Description

The current cannon trajectory preview (`src/effects/TrajectoryPreview.tsx`) renders a single thin `THREE.Line` from the active quadrant's mean mount position along the firing arc. Functional, but flat.

**Inspiration: Assassin's Creed IV: Black Flag.** In Black Flag the trajectory preview is not a thin line — it's a **semi-transparent white ribbon** whose width reflects the number of cannons in the active broadside. A port broadside with 4 cannons shows a wider ribbon than a fore cannon with 1. The ribbon gives you:

- A sense of how much firepower you're about to unleash
- A visual of roughly how wide the impact area will be (spread along the firing arc)
- A much more readable aiming cue than a 1-pixel line

## Acceptance Criteria

- [ ] Trajectory preview rendered as a semi-transparent white ribbon, not a line
- [ ] Ribbon width scales with the number of cannons in the active quadrant (4 broadside cannons → ~4× wider than a single fore cannon)
- [ ] Ribbon smoothly follows the projectile trajectory arc (gravity-adjusted)
- [ ] Opacity is noticeable but not distracting (~0.4 range)
- [ ] Fades out toward the end of the arc (optional)
- [ ] Follows the existing active-quadrant selection behavior (user confirmed aim-line behavior is perfect as-is)
- [ ] Works with the existing camera / post-processing (bloom, vignette)
- [ ] Unit test: ribbon width proportional to `mounts.filter(m => m.quadrant === active).length`
- [ ] Scenario test: ribbon mesh exists and has the expected geometry vertex count

## Relevant Files

- `src/effects/TrajectoryPreview.tsx` — current line implementation
- `src/utils/boatStats.ts` — mount counts per quadrant (read-only)
- Three.js `MeshLine` or a custom tube/plane geometry may be used

## Notes

- Consider `three/addons/lines/Line2` or `MeshLine` for thick screen-space ribbons
- Alternative: extruded plane with a trail texture
- Keep it performant — this renders every frame and must not tank FPS
- Save until after the current combat feel is locked in; this is a polish pass, not a blocker
