---
name: ChiloLab
description: The owner's Windows desktop, where the ChiloLab cat lives and real apps open in real windows.
colors:
  ink: '#184B58'
  ink-deep: '#113843'
  mint: '#C6E8DE'
  lavender: '#E3DFF3'
  apricot: '#FFBD8D'
  paper: '#F5F8F7'
  window: '#FFFFFF'
  desk: '#DBE7E4'
  muted: '#496570'
  line: '#CDDBDC'
typography:
  display:
    fontFamily: "'Be Vietnam Pro', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
    fontSize: 'clamp(2.4rem, 4.4vw, 4rem)'
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: '-0.03em'
  headline:
    fontFamily: "'Be Vietnam Pro', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
    fontSize: 'clamp(2rem, 3.8vw, 3.1rem)'
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: '-0.03em'
  title:
    fontFamily: "'Be Vietnam Pro', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
    fontSize: 'clamp(1.4rem, 2.3vw, 2rem)'
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: '-0.03em'
  body:
    fontFamily: "'Be Vietnam Pro', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
    fontSize: '1.0625rem'
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "'Be Vietnam Pro', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
    fontSize: '0.85rem'
    fontWeight: 600
    lineHeight: 1.3
rounded:
  badge: '0.4rem'
  control: '0.5rem'
  window: '12px'
  brand-frame: '28px'
spacing:
  gutter: '1.5rem'
  block: '4rem'
  section: '5rem'
  container: '1180px'
components:
  button-primary:
    backgroundColor: '{colors.ink}'
    textColor: '{colors.window}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    padding: '0.8rem 1.4rem'
    height: '48px'
  button-primary-hover:
    backgroundColor: '{colors.ink-deep}'
  button-quiet:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: '0.8rem 1.4rem'
    height: '48px'
  button-quiet-hover:
    backgroundColor: '{colors.window}'
  window:
    backgroundColor: '{colors.window}'
    rounded: '{rounded.window}'
  window-bar:
    backgroundColor: '{colors.ink}'
    textColor: '{colors.paper}'
    typography: '{typography.label}'
    padding: '0.35rem 0.9rem'
    height: '2.4rem'
  taskbar:
    backgroundColor: '{colors.ink}'
    textColor: '{colors.paper}'
    padding: '0.4rem 1rem'
  input:
    backgroundColor: '{colors.window}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
    padding: '0.65rem 0.8rem'
  status-badge:
    backgroundColor: '{colors.lavender}'
    textColor: '{colors.ink}'
    rounded: '{rounded.badge}'
    padding: '0.2rem 0.7rem'
---

# Design System: ChiloLab

## Overview

**Creative North Star: "The Cat's Desktop"**

ChiloLab is the owner's Windows desktop, and the ChiloLab cat lives on it. Both products are Windows apps and the brand mark is a window with cat ears, so the site borrows the vocabulary of a real desktop: products open as app windows with a title bar and minimise/maximise/close glyphs, the home hero is a desk surface, and a centred Windows 11-style taskbar closes it with the cat walking along its top edge, exactly as Pet Desktop sits on a real taskbar. That taskbar moment is the one bold element. Everything around it stays quiet, so the real screenshots carry the page.

Components are clear and firm, like a real desktop app: a confident ink outline, heavy headings, shadows only where a window lifts off the desk. The system was chosen on 2026-11-25 after the owner found the earlier scaffold looked generated; the anti-reference is that generic kit (icon tiles, tag chips, an icon beside every line, identical left/right section headings, decorative gradients).

Distinctiveness comes from real product assets, never from invented visuals: screenshots stay uncropped, development captures carry a visible preview caption, and the Auditor never shows invented performance scores. The concept drawings in `ProjectVisual.astro` are fallbacks and must never be presented as the actual app artwork. All body text is left aligned, and all content stays usable with JavaScript disabled.

**Key Characteristics:**

- Real product media always sits inside an app window.
- One signature moment: the desk, the taskbar and the walking cat.
- Heavy, tight headings; plain, readable body; no decoration standing in for content.
- Cool teal-ink palette with three soft tints reserved for product surfaces and labels.
- Personality from the cat and the owner's first-person voice: Vietnamese uses the friendly "mình", English a warm "I" (owner’s choice, 2026-11-25). Meta descriptions, job duties and the privacy page stay neutral.

## Colors

A cool, low-chroma teal-ink world: one deep ink does all the talking, and three pale tints mark products and kinds.

### Primary

- **Desk Ink** (ink): headings, body text, primary buttons, window title bars, the taskbar, window borders and the brand mark. The theme colour of the site.
- **Night Ink** (ink-deep): hover state of primary buttons only.

### Secondary

- **Pet Mint** (mint): the surface behind Pet Desktop media, the mark and the "open app" bar inside title bars and the taskbar, the Work label, the step 1 bar, and the email button on the dark contact panel.
- **Auditor Lavender** (lavender): the surface behind Auditor media, version status badges, the Study label and the step 2 bar.

### Tertiary

- **Apricot Glow** (apricot): small accents only: the in-development status dot, the Release label (mixed 55% with white), the step 3 bar.

### Neutral

- **Cool Paper** (paper): the open page background.
- **Window White** (window): inside app windows, the download panel, inputs and cards on the account pages.
- **Desk Surface** (desk): full-bleed band behind the home and About heroes.
- **Slate Muted** (muted): secondary text, captions, input borders; passes 4.5:1 on paper and desk.
- **Hairline** (line): dividers between list rows and sections.

### Named Rules

**The One Ink Rule.** Text, actions and chrome all use Desk Ink. There is no second accent colour for links or buttons.

**The Tints Belong to Products Rule.** Mint, lavender and apricot mark a product surface, a status or a kind of entry. They are never used as decorative tiles behind icons.

**The Browser Surfaces Rule.** Selection, caret, scrollbar and accent colour take their colours from the palette (mint selection, ink caret and accent).

## Typography

**Display Font:** Be Vietnam Pro (with Segoe UI, Helvetica Neue, Arial)
**Body Font:** Be Vietnam Pro

**Character:** One family, chosen because it was designed for Vietnamese diacritics (SIL OFL, self-hosted through the Fontsource npm package for Be Vietnam Pro; weights 400/500/700/800; no external font requests). Personality comes from weight contrast: 800 headings over a plain 400 body.

### Hierarchy

- **Display** (800, clamp(2.4rem, 4.4vw, 4rem), 1.05): the home headline, max 19ch. Other page titles use 800 at up to 5.8rem.
- **Headline** (800, clamp(2rem, 3.8vw, 3.1rem), 1.15): section headings; project titles in home rows use the same weight at up to 2.6rem.
- **Title** (700, clamp(1.4rem, 2.3vw, 2rem), 1.15): article subheads and version titles.
- **Body** (400, 1.0625rem, 1.6): running text, max 65–70ch; leads at 1.2rem.
- **Label** (600, 0.85rem): window titles, status lines, captions, facts.

### Named Rules

**The No Eyebrow Rule.** Headings have no labels above them, no all-caps kickers and no single highlighted word.

**The Stacked Heading Rule.** A section heading sits above its short muted note, never split left and right.

**The Tight Tracking Rule.** Headings track at -0.03em; nothing goes tighter than -0.04em.

## Layout

A single 1180px container with a 1.5rem gutter (1rem below 720px). Sections are separated by about 4–5rem and a hairline. The homepage opens with a first-person, role-first headline (BA/QC who also builds software), a lead, plain facts separated by thin rules, a Projects button, an About me button and the email as a text link, beside the owner's real portrait in the eared brand frame (`src/assets/phat-portrait.jpg`, cropped to head and shoulders, metadata stripped). Projects follow as full-width rows that alternate a windowed screenshot (about 1.6fr) and text (1fr), each with real status from its newest version note and its stack (`stack` in project frontmatter) as plain comma-separated text. A short "About me" teaser with a skills definition list and an "About ChiloLab" statement close the page.

```text
brand                              projects / about / language
[desk] headline + lead + facts     portrait in brand frame
[desk] ......... cat walks ..........
[taskbar: mark  Pet Desktop  Auditor (centred)]
[project window    ] title + description + link
title + description + link [project window    ]
about me + skills list
about ChiloLab statement
footer
```

The About page (`/about`, `/en/about`, data in `src/lib/profile.ts`) opens on the desk with the portrait in the brand frame, a tilted real Pet Desktop capture overlapping its corner, and email, projects and GitHub actions. Sections: experience and education with dates; "How I work" as a four-step numbered pipeline whose top bars run mint, lavender, apricot, ink; skills as a two-column definition list; "My journal", newest first, under large faded year numbers with Study/Work/Release labels, where the logo cat rides down a dashed rail (position: sticky, no script) and Pet Desktop release entries come from published version notes; Athena courses as an undated, ruled list linking to athena.edu.vn (the owner does not want course dates shown); project screenshots uncropped inside app windows; languages with an optional TOEIC slot; and a closing contact panel shaped like the brand frame.

Project pages keep the shared navigation and offer the download panel, the media in a window (Pet Desktop shows its silent 32-second introduction video with controls, no autoplay, the screenshot as poster), and a readable article. Version pages use a readable article layout: each product has a version index, an explicit status label and a detail article; preview notices stay visible and history follows the editorial order field. Lists use separators, not repeated cards.

Below 720px every row and hero collapses to one column with media above text, facts stack, definition lists drop to one column, and the taskbar keeps one row and scrolls sideways.

## Elevation & Depth

Mostly flat, tonal layering (paper, desk, window). Shadows are structural and appear only where a window lifts off the desk.

### Shadow Vocabulary

- **Window lift** (`--shadow-window`: a 1px close shadow plus a 14px offset, soft blur in ink at 12% and 32%): app windows and the download panel.
- **Polaroid** (0 12px 28px ink at 16%): the tilted Pet Desktop capture on the About hero.

### Named Rules

**The Lift Means Window Rule.** Only windows (and the polaroid that sits on one) cast a shadow. Rows, lists and sections do not.

**The No Hard Shadow Rule.** No zero-blur offset shadows, no coloured halos.

## Shapes

Windows have gently rounded corners (12px) and a 1.5px ink outline. Buttons and the language switch use 0.5rem; badges and labels 0.4rem. The contact panel is the one large-radius shape (28px). The portrait is the one round photo (owner’s choice, 2026-11-25): a circle with a 12px ink ring, the triangular cat ears behind it, and the caption below in muted text. Both carry the ears, which rise once on load and twitch on hover. No pills, and no other geometric masks around photos.

The brand mark is a desktop window with cat ears and two eyes, drawn in `src/components/Logo.astro` and mirrored in `public/favicon.svg`; keep both in sync. Its eyes carry `class="eye"` and blink every few seconds.

## Components

### Buttons

Clear and firm.

- **Shape:** gently rounded (0.5rem), at least 48px tall.
- **Primary:** Desk Ink fill, white 600-weight text; hover to Night Ink.
- **Quiet:** transparent with a 1.5px ink outline; hover fills with window white (paper on the desk).
- **Text links:** underlined, 0.3em offset; thicker underline on hover. No arrow glyphs.
- **Focus:** 3px ink outline (mint on dark surfaces), offset 2px.

### App window (signature)

`src/components/WindowBar.astro` inside a `.window`: an ink title bar (2.4rem) with the mark in mint, the app name, a muted version, and minimise/maximise/close glyphs drawn on the right as on Windows, never macOS dots. The bar is aria-hidden; the content inside carries the meaning. Product windows tint their body mint (Pet Desktop) or lavender (Auditor) behind uncropped screenshots; captions sit outside, below the window.

### Taskbar (signature)

A full-width ink bar closing the home desk, items centred as on Windows 11: the mark as a start button, then one link per project with its icon and name, each with a small mint "open app" bar beneath. The ChiloLab cat (`src/components/WalkingCat.astro`, inline SVG) walks in once along its top edge, stops, says hello in a speech bubble, then blinks and sways its tail; decorative, CSS-only, still under reduced motion.

### Download panel

A white window-styled panel (1.5px ink border, window lift): heading, version, title, date and the live download count, the primary download button with a download icon, then portable, notes and feedback as text links.

### Status and labels

Version status uses lavender badges (0.4rem). Home rows show a status dot (apricot in development, a darker mint when released), the version in bold and the status in muted text. Journey labels use mint (Work), lavender (Study) and apricot (Release).

### Inputs / Fields

Window-white fields with a 1px Slate Muted border and 0.5rem radius; focus draws a 3px ink outline. Form status messages sit on mint. Held comments sit on a pale apricot background (#FFF4E8) with brown text (#7A3B12). The destructive account action is red (#A3261B, hover #7E1D14).

### Navigation

Header: the mark and "ChiloLab" on the left; Projects, About me and the language switch (outlined, 0.5rem) on the right, 500 weight, underline on hover. Footer: brand line and plain link columns with no icons. A skip link appears on focus.

### Icons

Inline stroke SVGs in `src/components/Icon.astro` (24px grid, 1.8 stroke, currentColor, aria-hidden). No icon library. Icons sit beside text, never replace it, and appear only in the taskbar, the primary download button and the comment and account UI.

### Download counts

Public Pet Desktop download counts sit in the download panel and the home project row, in muted text with a download icon. They come from GitHub Releases (installer and portable only), refresh every minute while visible, and stay hidden without JavaScript or when GitHub cannot be reached.

### Admin panel and owner mode

`/admin/manage` deliberately leaves the public palette: dark surfaces (#101417 / #171D21), an amber accent (#F5B545), a fixed amber "QUẢN TRỊ" bar, its own favicon and a "· Quản trị ChiloLab" tab title, so it can never be mistaken for a visitor page. Navigation is grouped (Kiểm duyệt, Cộng đồng, Thống kê, Hệ thống). It stays script-free and keyboard-focusable (light-blue focus ring), with a skip link and tables that scroll sideways on narrow screens. When the owner browses the public site, a thin amber "Chế độ chủ site" bar at the top links back to `/admin/manage`; visitors never see it.

## Do's and Don'ts

### Do:

- **Do** put every real product screenshot or video inside an app window with its title bar.
- **Do** keep screenshots uncropped, served as responsive WebP through Astro, with a visible development-preview caption where it applies.
- **Do** keep motion to the logo blink, the brand-frame ear reveal and the walking cat, all stopped under reduced motion.
- **Do** keep visible keyboard focus, the skip link, default cursors and native scrolling.
- **Do** write stacks and skills as plain text and facts as plain text separated by thin rules.

### Don't:

- **Don't** add tinted icon tiles, tag chips, or icons beside facts, headings, general buttons or footer links.
- **Don't** add eyebrow labels, arrow glyphs on links, or middle-dot meta strings.
- **Don't** add invented performance scores to Auditor visuals or imply the concept pet is the real app artwork.
- **Don't** draw macOS window dots; these are Windows apps.
- **Don't** add a shadow to anything that is not a window.
- **Don't** use the admin palette (dark surfaces, amber) on visitor pages, except the owner bar.
