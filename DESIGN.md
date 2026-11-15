# ChiloLab visual foundation

## Direction

A friendly maker's workspace with products as the eventual visual focus. This is an initial scaffold, not a finalized brand identity. Real Pet Desktop art and Auditor screenshots should replace the concept drawings before launch.

Current refinement: preserve the palette, typography and two-column layout; use an actual Pet battle-hub screenshot rather than the concept drawing wherever project media is shown. Keep screenshots uncropped, generate responsive WebP sizes through Astro, and show an explicit development-preview caption. The project page includes the silent introduction video with controls and no autoplay. Auditor remains a clearly labeled concept until a real screenshot is supplied. This makes the existing work the focal point without adding decorative movement.

## Tokens

Source of truth: `src/styles/tokens.css`.

- Paper `#F9FBFC`: open page background.
- Ink `#184B58`: typography and primary actions.
- Muted `#496570`: secondary text.
- Mint `#C6E8DE`: pet illustration surface.
- Lavender `#E3DFF3`: auditor illustration surface.
- Apricot `#FFBD8D`: a small accent in the homepage illustration.
- System font stack with Vietnamese coverage. Avoid external font requests in the initial scaffold. A future brand font must cover Vietnamese diacritics and be self-hosted with its license.

## Layout

Version pages use the existing tokens and readable article layout. Each product has a version index, an explicit status label and a detail article. Keep preview/development notices visible, links descriptive, and version history ordered by the editorial order field. Lists stay simple, with separators instead of repeated decorative cards.

All body text is left aligned. The homepage introduces the maker's space alongside a single playful illustration, then presents two large project previews and a short about section.

```text
brand                         projects / about / language
intro + headline              playful illustration
project preview               project preview
about heading                 description
footer
```

Two columns collapse to one on narrow screens. Project pages retain shared navigation and offer a large preview, explicit preparation notice and readable article content. Product-specific visuals can diverge while tokens and navigation stay consistent.

## Review decisions

Do not add invented performance scores to the Auditor illustration. The current illustration shows shapes only. Do not imply that the concept pet represents the actual app artwork. Distinctiveness should ultimately come from real product assets, not decorative motion. Preserve default cursors and scrolling; all content remains accessible with JavaScript disabled.
