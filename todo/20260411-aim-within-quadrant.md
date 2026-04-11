# Variable Aim Within Quadrant (Black Flag style)

**Created:** 2026-04-11 (playtest feedback)
**Priority:** Critical — Jonathan says current fixed-quadrant aim makes it impossible to aim properly

## Problem

Current behavior: the four cannon quadrants (fore/aft/port/starboard) have a fixed firing direction. You pick a quadrant with your camera, and the cannonball goes in that quadrant's default direction.

Jonathan's problem: **inside a quadrant, you cannot nudge the aim up/down or left/right.** This makes it impossible to adjust for distance (important: cannonballs arc) or for targets that are not dead-center in the quadrant. "Onmogelijk om iets fatsoenlijk te mikken als je die trajectory niet omhoog en omlaag kan doen."

## Reference

**Assassin's Creed IV: Black Flag** — ship combat. Quadrants are fixed (port broadside / starboard broadside / front mortar / back chaser) but **within a quadrant you get fine aim control via the camera/reticle**. Pitch adjusts range (arc trajectory), yaw adjusts lateral position within the quadrant's cone.

## Wanted behavior

- Quadrants stay as-is (camera azimuth picks the quadrant).
- Within the active quadrant, the player's mouse/camera direction provides a **fine aim offset**:
  - **Yaw offset** (horizontal): ±N degrees within the quadrant cone so you can pan left/right in a ~60–90° window
  - **Pitch offset** (vertical): this is the critical one — a meaningful range like ±15° so you can arc longer or shoot flatter at closer targets
- The trajectory preview (aim line) must reflect the combined quadrant + offset in real time, so the player sees where they're actually aiming
- Firing uses the preview direction, not the pure quadrant default

## Design questions for research

1. How is the current active quadrant computed from camera angle? Where is that code?
2. How does the trajectory preview currently work? Does it already have the knobs for arbitrary direction, or is it hardcoded to the quadrant's default vector?
3. What's the right way to feed a "fine offset" from mouse/camera into the firing direction without breaking the existing quadrant gating logic?
4. Does the projectile physics support pitch (arc launch), or are cannonballs fired as straight flat shots?
5. What's a sensible offset range per quadrant? ±30° yaw × ±15° pitch? Match Black Flag if possible.
6. How does this interact with the pending-fire queue? The queued intent uses quadrant at drain-time — should it also capture the offset at click-time or at drain-time?

## Out of scope

- Not reworking the quadrant system entirely
- Not per-mount targeting (each mount still shares the quadrant aim)
- Not changing the fire rate / overheat / cooldown mechanics

## Deliverable

- Research report with answers to the questions above, proposed approach, and file + line pointers
- Dev implementation based on the approved approach
- Unit test + Playwright smoke: fire at different camera angles within the same quadrant, assert projectile initial velocity vector differs
