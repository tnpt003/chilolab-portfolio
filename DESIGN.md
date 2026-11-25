# ChiloLab visual foundation

## Direction

A friendly maker's workspace with products as the eventual visual focus. This is an initial scaffold, not a finalized brand identity. Real Pet Desktop art and Auditor screenshots should replace the concept drawings before launch.

Visual world (2026-11-25, owner chose "Desktop của Phát" after finding the earlier scaffold looked generated): the site is the owner's Windows desktop. Real product media always sits inside a Windows-style app window (`src/components/WindowBar.astro`: ink title bar, mint brand mark, app name and version, minimise/maximise/close drawn on the right, never macOS dots). The home and About heroes sit on a `--desk` surface; the home desk ends in a centred Windows 11-style taskbar linking to each project, and the ChiloLab cat walks along it, as Pet Desktop does. That is the one bold element; everything else stays quiet: no icon tiles, no tag chips, no icons in buttons or footer links, facts as plain text separated by thin rules, skills as a definition list.

Earlier refinement: preserve the palette, typography and two-column layout; use an actual Pet battle-hub screenshot rather than the concept drawing wherever project media is shown. Keep screenshots uncropped, generate responsive WebP sizes through Astro, and show an explicit development-preview caption. The project page includes the silent introduction video with controls and no autoplay. The Auditor uses its real main-screen capture from the app user guide (`src/assets/auditor-main-screen.png`, example.com URLs only, no client data). This makes the existing work the focal point.

## Tokens

Source of truth: `src/styles/tokens.css`.

- Paper `#F5F8F7`: open page background.
- Window `#FFFFFF`: inside app windows and the download panel.
- Desk `#DBE7E4`: the desktop surface behind the home and About heroes.
- Ink deep `#113843`: button hover.
- Ink `#184B58`: typography and primary actions.
- Muted `#496570`: secondary text.
- Mint `#C6E8DE`: pet illustration surface.
- Lavender `#E3DFF3`: auditor illustration surface.
- Apricot `#FFBD8D`: a small accent in the homepage illustration.
- Type: Be Vietnam Pro (SIL OFL, self-hosted through `@fontsource/be-vietnam-pro`, weights 400/500/700) with the system stack as fallback. Chosen because it was designed for Vietnamese diacritics. No external font requests. Heading tracking stays at -0.03em. Weights 400/500/700/800; h1, h2 and project titles use 800. Body is 1.0625rem.
- Brand mark: a desktop window with cat ears and two eyes (small Windows software; the cat that lives on the screen). Ink on paper, drawn in `src/components/Logo.astro` and mirrored in `public/favicon.svg`; keep both in sync. Its eyes carry `class="eye"` and blink every few seconds (CSS only).
- Icons: inline stroke SVGs in `src/components/Icon.astro` (24px grid, 1.8 stroke, currentColor, aria-hidden). No icon library. Icons sit beside text, never replace it. Use them sparingly: the taskbar, the primary download button, comments and account UI. Not in facts, section headings, buttons generally or footer links.
- No tinted icon tiles and no tag chips: stacks and skills are plain comma-separated text.
- Windows: 1.5px ink border, 12px radius, `--shadow-window` (offset, soft blur). Radii: 0.5rem for buttons and the language switch. No pills, no hard offset shadows.
- Browser surfaces (selection, caret, scrollbar, accent) take their colors from the palette.

## Layout

Version pages use the existing tokens and readable article layout. Each product has a version index, an explicit status label and a detail article. Keep preview/development notices visible, links descriptive, and version history ordered by the editorial order field. Lists stay simple, with separators instead of repeated decorative cards.

All body text is left aligned. The site doubles as the owner's CV portfolio. The homepage opens with a first-person, role-first headline (BA/QC who also builds software), quick facts with icons, and Projects / About me / Email buttons next to the owner's real portrait in the eared brand window (cropped to head and shoulders from the original photo, metadata stripped, `src/assets/phat-portrait.jpg`). Below the hero, on the desk and above the taskbar, the ChiloLab cat (`src/components/WalkingCat.astro`, inline SVG) walks in along a line once, stops, says hello in a speech bubble, then stays blinking and swaying its tail; it is decorative, CSS-only and still under reduced motion. It then shows each project, with its real status from the newest version note and its stack tags (`stack` in project frontmatter), as a full-width row that alternates a windowed screenshot and text, followed by a short "About me" teaser linking to `/about`, then "About ChiloLab". Section headings stack the heading over a short muted note (no left/right split). Headings have no eyebrow labels, and links carry no arrow glyphs.

```text
brand                         projects / about / language
[desk] headline + lead + button   portrait window
[desk] ............ cat walks ..............
[taskbar: mark  Pet Desktop  Auditor (centred)]
[project media     ] title + description + link
title + description + link [project media     ]
about heading                 description
footer
```

The About page (`/about`, `/en/about`, data in `src/lib/profile.ts`) opens with the portrait inside the brand mark, a dark window whose cat ears rise once on load (the right ear twitches on hover), with a tilted real Pet Desktop capture overlapping its corner, and an email button. Sections: experience and education with dates; "How I work" as a four-step numbered pipeline whose top bars run mint, lavender, apricot, ink; skills as a two-column definition list; "My journal", newest first, grouped under large faded year numbers with Study/Work/Release labels, where the logo cat rides down a dashed rail (position: sticky, no script) and Pet Desktop release entries come from the published version notes; Athena courses as an undated, ruled list linking to athena.edu.vn (the owner does not want course dates shown); real project screenshots uncropped inside app windows; languages with an optional TOEIC slot; and a closing contact panel shaped like the brand window with ears.

Rows and the hero collapse to one column on narrow screens, with media above the text. Project pages retain shared navigation and offer a large preview, explicit preparation notice and readable article content. Product-specific visuals can diverge while tokens and navigation stay consistent.

## Review decisions

Do not add invented performance scores to Auditor visuals. Do not imply that the concept pet represents the actual app artwork. Distinctiveness should come from real product assets; motion is limited to the logo blink and the About ear reveal, both off under reduced motion. Preserve default cursors and scrolling; all content remains accessible with JavaScript disabled.

## Admin panel and owner mode

`/admin/manage` deliberately does not use the public palette: dark surfaces (`#101417`/`#171d21`), an amber accent (`#f5b545`), a fixed amber "QUẢN TRỊ" bar, its own favicon and a "· Quản trị ChiloLab" tab title, so it can never be mistaken for a visitor page. Navigation is grouped (Kiểm duyệt, Cộng đồng, Thống kê, Hệ thống). It stays script-free, keyboard-focusable (light-blue focus ring), with a skip link and tables that scroll sideways on narrow screens. When the owner browses the public site, a thin amber "Chế độ chủ site" bar at the top links back to `/admin/manage`; visitors never see it.

Public download counts (Pet Desktop) sit in the download panel and in the home project row, in muted text with a download icon. They come from GitHub Releases (installer + portable only), refresh every minute while the page is visible, and stay hidden without JavaScript or when GitHub cannot be reached.
