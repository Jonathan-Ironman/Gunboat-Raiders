# Weapon Overheat Mechanic

**Created:** 2026-04-11
**Owner:** Deferred — UI bar built in UI overhaul, mechanic implemented later
**Priority:** Design locked, implementation queued

## Vision (Jonathan, 2026-04-11)

Player can currently fire cannonballs indefinitely. This gets replaced with an **overheat system** that rewards short aggressive bursts but punishes sustained fire.

## Mechanic

- **Fire rate baseline:** significantly FASTER than current — player should be able to barrage with cannonballs (rapid succession) during green phase.
- **Heat accumulates** with each shot, slowly.
- **Heat bar color states** (already in Harbour Dawn UI design doc):
  - **Green:** > 50% full → normal fast fire rate
  - **Yellow / orange:** 25–50% → **slower fire rate** (already penalized)
  - **Red:** < 10% → **much slower fire rate**
  - **Past red / fully overheated:** **firing stops temporarily** until bar recovers
- **Cooldown / recovery:** heat dissipates over time when not firing.

## UI requirements (build in UI overhaul phase 1)

- Heat bar is part of the HUD, one per mount (or one shared — TBD in design review)
- Must animate smoothly (lerped), visible color transitions
- Must be visually prominent because it gates player agency
- Style per Harbour Dawn art direction (committed in `docs/art-direction/`)

## Implementation scope

**UPDATE 2026-04-11 (Jonathan):** The mechanic should be implemented **rudimentarily alongside the UI** so the bar binds to real data, not a placeholder. Keep values **very conservative** — during testing Jonathan wants to be able to fire freely without constantly hitting overheat.

**Conservative tuning for first pass:**

- **20 seconds of continuous sustained fire → 100% heat** (linear)
- So ~5% heat per second of active firing, or ~10s → 50%.
- Fire rate reductions (yellow / red / stop) **still apply** but thresholds are such that normal short bursts never get near them.
- **Dissipation:** heat should decay fairly fast when not firing so testing stays fluid — target value TBD by dev agent, reasonable default ~100% → 0 in 10–15 s of no fire.
- Per-mount vs shared: **shared for now** (one bar, one value) — simpler, revisit later.

**Ship in same slice as UI bar:**

- Store slice: `heat` (0–1) in weapon store, tick each frame
- Bar UI reads actual store value, renders color states
- Fire-rate gate reads same value

**Later (dedicated balance pass):**

- Re-tune curves for real combat feel
- Per-mount heat if desired
- Audio feedback (hiss on overheat?)
- Visual cannon glow at high heat

## Open questions

- Per-mount heat (each cannon overheats separately) or shared (one bar for all four)?
- Does heat transfer between mounts when swapping active quadrant?
- Visual feedback when a shot is "dampened" by yellow/red state?

These are decided in the dedicated implementation task, not now.

## Status: COMPLETED 2026-04-11

Overheat mechanic implemented. Store slice with `heat` 0–1, fire-rate bracketing (green/yellow/red), and sticky lockout at 1.0. Conservative tuning as specified. Hold-to-fire also added. Relevant commits:

- `a46bc3a` — `feat(combat): weapon overheat mechanic (conservative)`
- `c88785c` — `feat(combat): hold-to-fire with cooldown + overheat gating`
- `c439969` — `feat(ui): WeaponHeatBar HUD component (R13)`
- `54c65fa` — `feat(ui): HUD bar redesign — segmented heat + split hull/armor`

Heat bar wired to real store data and composited in HUD in `4d0cf5c`. Per-mount heat deferred to a later balance pass as documented.
