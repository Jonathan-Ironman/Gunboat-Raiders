# Research sound effect assets for the game

## Description

The game currently has no dedicated sound effect assets. Survey free / CC0 / CC-BY sources and propose a curated asset list the team can review before downloading anything. The goal is to pick a coherent, high-quality set of sounds in one pass, not to scatter random clips across the repo.

Categories that need coverage:

- **Cannon fire** — forward shot, broadside, dry-fire click (denied)
- **Impact / explosion** — cannonball hitting wood, cannonball hitting water, cannonball hitting rock
- **Water splash** — projectile splash, boat bow splash, big crest spray
- **Boat engine / hull** — propeller / wake loop, hull creak, hull impact with rock
- **Wind** — ambient layer at 2–3 intensities (calm, default, stormy)
- **Ambient ocean** — seagulls, distant waves, deep swell
- **UI clicks** — button hover, button press, menu open, menu close, settings slider tick
- **Damage / hit markers** — enemy hit confirm, enemy kill confirm, player taking damage, low-hull warning pulse
- **Wave-clear sting** — short musical/percussive "you cleared it" cue
- **Game-over sting** — short descending cue
- **Optional music** — main menu loop, in-game loop (low priority, mention sources only)

## Acceptance Criteria

- [ ] Assets downloaded directly into `public/audio/` (or a sensible subfolder structure per category, e.g. `public/audio/cannon/`, `public/audio/ambient/`, `public/audio/ui/`)
- [ ] Every category above has at least one downloaded asset
- [ ] Prefer CC0 / public domain; CC-BY acceptable if attribution is noted
- [ ] Favor Kenney audio packs (CC0) when possible for consistency
- [ ] Manifest file written to `docs/audio-sources.md` listing every downloaded asset with: name, source URL, license, attribution text (if required), path in repo, duration
- [ ] License summary at the top of the manifest listing all attribution obligations
- [ ] Total asset count and total size on disk

## Research sources the agent should survey

- **Kenney audio packs** (CC0) — https://kenney.nl/assets/category:Audio
- **Freesound.org** (mixed licenses, filter CC0 / CC-BY) — https://freesound.org
- **Sonniss GDC free bundles** (royalty-free commercial use) — https://sonniss.com/gameaudiogdc
- **Zapsplat free tier** — https://www.zapsplat.com (attribution required)
- **OpenGameArt audio** — https://opengameart.org/art-search?keys=audio
- **BBC Sound Effects Archive** — https://sound-effects.bbcrewind.co.uk (non-commercial only, flag carefully)
- **Mixkit free sound effects** (royalty-free) — https://mixkit.co/free-sound-effects

## Relevant Files

- `src/systems/AudioSystem.ts` (if it exists — otherwise create) — where the Howler.js instances will live
- `public/audio/` — eventual asset home
- `docs/audio-sources.md` — THE deliverable

## Notes

- Agent should download directly into `public/audio/` — no "proposal only" step, just go
- Prefer a small, coherent set over a huge sprawling one. 20–30 assets is plenty for MVP.
- Howler.js is already a dependency — the format preference is .ogg and .mp3 (both broadly supported).
- Keep individual clips short. Long loops are fine for ambience.
- Flag any asset with unusual license terms BEFORE downloading — do not silently include anything with restrictive terms
- For Kenney packs, download the whole pack and cherry-pick what we need, discarding the rest — keeps repo size down
