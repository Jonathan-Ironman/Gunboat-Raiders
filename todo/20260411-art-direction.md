# Art direction exploration — HTML mood page

## Description

The current visual identity of Gunboat Raiders feels like a generic American 60s military stencil look: plain typeface, very basic color palette, no real design voice. The user wants to explore alternative directions before locking in a final art style.

**Deliverable:** a single self-contained HTML page (`docs/art-direction/index.html` or similar) presenting 3–5 distinct art direction proposals for the game's UI/HUD. The user will review, pick favorites, and give feedback. The agent does NOT touch any in-game styling — this is pure exploration.

## Each proposal should include

- **Name** (e.g. "Salt-Worn Cartography", "Neon Torpedo", "Wartime Propaganda")
- **Mood line** — one sentence
- **Typography** — 2–3 web fonts (headline, body, HUD), loaded from Google Fonts or similar
- **Color palette** — 5–8 swatches with hex codes and roles (background, accent, danger, water, etc.)
- **HUD mockup** — fake health bar, ammo counter, wave indicator, minimap stub rendered in the HTML using the proposed fonts + colors
- **Title screen mockup** — big title text + start button
- **Sample in-game text** — damage numbers, score, kill feed
- **Inspiration thumbnails / references** — either inline SVG or linked images (public domain or Unsplash)

## Style directions to cover (suggestions — agent can substitute)

1. **Modern clean** — think Hades / Slay the Spire polish: strong headline font, flat colors, tight HUD
2. **Weathered nautical** — aged parchment, rope edges, handwritten navigator font, brass/copper accents
3. **Arcade neon** — 80s synthwave, glow, chromatic aberration, bold display font
4. **Grim war documentary** — muted desaturated palette, typewriter font, brutalist layout
5. **Kenney / stylized toon** — bright saturated, rounded fonts, playful HUD (matches our current Kenney assets)

## Acceptance Criteria

- [ ] Single HTML file, self-contained (can be opened with a double-click, no build needed)
- [ ] 3–5 art direction proposals on one scrollable page with clear separation between sections
- [ ] Each proposal is visually complete (not just swatches — mockups that show how the game HUD would feel)
- [ ] All fonts loaded via CDN (Google Fonts / Bunny Fonts) — no missing-font fallback
- [ ] Opens in Chrome without errors
- [ ] Saved under `docs/art-direction/` — do NOT modify any existing game code or assets

## Constraints

- Do NOT modify in-game components, CSS, or asset files
- Do NOT add npm dependencies
- Use inline SVG / CSS / HTML only — no framework, no bundler
- Match fonts to the naval combat game vibe; avoid yet another stencil military font
