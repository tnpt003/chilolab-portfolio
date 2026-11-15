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
- Type: Be Vietnam Pro (SIL OFL, self-hosted through `@fontsource/be-vietnam-pro`, weights 400/500/700) with the system stack as fallback. Chosen because it was designed for Vietnamese diacritics. No external font requests. Heading tracking stays at -0.03em.
- Radii: 14px for media, 0.5–0.6rem for buttons and the language switch. No pills, no hard offset shadows.
- Browser surfaces (selection, caret, scrollbar, accent) take their colors from the palette.

## Layout

Version pages use the existing tokens and readable article layout. Each product has a version index, an explicit status label and a detail article. Keep preview/development notices visible, links descriptive, and version history ordered by the editorial order field. Lists stay simple, with separators instead of repeated decorative cards.

All body text is left aligned. The homepage opens with a first-person headline next to the owner's real portrait (cropped to head and shoulders from the original photo, metadata stripped, `src/assets/phat-portrait.jpg`). It then shows each project as a full-width row that alternates media and text, followed by a short about section. Headings have no eyebrow labels, and links carry no arrow glyphs.

```text
brand                         projects / about / language
headline + lead + button      portrait + caption
[project media     ] title + description + link
title + description + link [project media     ]
about heading                 description
footer
```

Rows and the hero collapse to one column on narrow screens, with media above the text. Project pages retain shared navigation and offer a large preview, explicit preparation notice and readable article content. Product-specific visuals can diverge while tokens and navigation stay consistent.

## Review decisions

Do not add invented performance scores to the Auditor illustration. The current illustration shows shapes only. Do not imply that the concept pet represents the actual app artwork. Distinctiveness should ultimately come from real product assets, not decorative motion. Preserve default cursors and scrolling; all content remains accessible with JavaScript disabled.
