# ChiloLab project instructions

- Read PRODUCT.md and DESIGN.md before changing UI or content.
- Stack: Astro static output, strict TypeScript, npm with committed lockfile.
- Vietnamese lives at `/` and `/<slug>`; English at `/en/` and `/en/<slug>`.
- Keep project slugs lowercase and stable. Add redirects for retired routes.
- Project content lives in `src/content/projects/<locale>/*.md`; schema is in `src/content.config.ts`. Keep matching slug/locale pairs for both languages.
- Keep content loading in `src/lib/content.ts`; do not fetch CMS data in visual components.
- Never invent product capabilities, scores, testimonials, download links or repository URLs. Mark conceptual visuals explicitly until real assets arrive.
- Add client JavaScript only for an interaction that needs it. Do not add React or an animation library for static layouts.
- Keep visible keyboard focus, a skip link, responsive layouts, and reduced-motion support.
- Project-local skills: `.agents/skills/frontend-design` for visual direction; `.agents/skills/impeccable` for critique and refinement. Read the selected skill before applying it; installation alone does not activate its scripts.
- Validate meaningful changes with `npm run verify`; format with `npm run format`. CI also checks formatting.
- Owner: Nguyễn Tấn Phát. Hosting choice: Cloudflare; chilolab.com is planned for purchase at Porkbun. WordPress is the preferred CMS candidate, not yet connected. Read docs/CMS-ROADMAP.md and docs/DEPLOYMENT.md before integration work.
- Pet releases: https://github.com/tnpt003/Pet-desktop-share (public, releases only; source is private since 2026-11-21, and https://github.com/tnpt003/Pet-Computer is now a bridge that only keeps 1.5.2 for old installs). Auditor source is local at C:/Project VS/PageSpeed-Auth-Auditor and has not been uploaded. Do not infer public downloads from package metadata. Never fabricate contact URLs or silently add account-dependent integrations.
- Editing UI: Sveltia CMS (git-based, free) at `public/admin/`; it writes the same Markdown files. Keep `public/admin/config.yml` in sync with `src/content.config.ts`. Read docs/CMS.md.
- Free-first: Markdown is the active content source, public GitHub is acceptable, Cloudflare is the hosting choice. WordPress is deferred. Do not add paid services without an explicit decision.
- Keep tokens and credentials out of source. No secrets in PUBLIC_* variables.
- Version notes live in src/content/versions/{vi,en}/<project>/<version>.md. Read docs/VERSIONS.md; preserve translation metadata, distinguish public posts from actual product release status, and never invent release dates or downloads.
- Visitor data (Google accounts, threaded per-version comments with AI moderation, feedback, download counts) lives in Cloudflare D1 via `worker/`; `/manage/*` is the owner admin panel (dashboard, comments, feedback, downloads, users, settings), opened by an owner session (`users.role = 'owner'`, signed in at `/user/login`) or, as a fallback, Cloudflare Access. Site settings live in the D1 `settings` table (`worker/settings.ts`). Read docs/DATABASE.md. Never store IPs or plain session tokens; keep `/manage` failing closed for anyone who is not the owner. The owner role is set only with SQL, never through the panel or API. Sign-in is Google or a 6-digit email code (Resend); there are no passwords — password hashing needs Workers Paid, which needs an explicit decision.
