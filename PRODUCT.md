# ChiloLab

A personal portfolio and product showcase, owned by Nguyễn Tấn Phát.

## Confirmed

- Owner: Nguyễn Tấn Phát; GitHub: https://github.com/tnpt003.
- Domain: https://chilolab.com (bought at Porkbun, DNS on Cloudflare). `www.chilolab.com` redirects to the apex; the `workers.dev` address is disabled. See docs/DEPLOYMENT.md.
- Hosting: Cloudflare Worker `chilolab-portfolio` serving the Astro static build (static assets, Workers Builds from the GitHub repo `tnpt003/chilolab-portfolio`).
- Budget preference: free services for the first phase; a public GitHub repository is acceptable. Use Markdown as the active CMS (Sveltia at `/admin`). WordPress is deferred; do not add paid hosting or services without an explicit decision.
- Projects: Pet Desktop and PageSpeed-Auth-Auditor.
- Bilingual Vietnamese and English; Vietnamese is the default.
- Each project has a permanent landing page, a version index and per-version notes.

## Visitor tasks

Discover projects, understand what they do, see actual work, download released builds, read version notes, and leave comments or feedback after signing in.

## Content integrity

Pet Desktop releases: https://github.com/tnpt003/Pet-desktop-share (public, releases only). A Windows desktop cat built with C#/WPF, plus optional adventures. Version posts exist for 1.4.0–1.5.0 and 1.5.2; only 1.5.2 has download links (per-tag Setup.exe and Portable.zip on Pet-desktop-share), because older binaries were on the old repository, which is no longer public. /pet-desktop shows the featured release (`featuredVersion`). 1.5.1 (2026-11-14) has no version post here. Verify release notes before promising a feature in a download. Download links and the app's auto-update feed both depend on Pet-desktop-share's releases being public.

Source move (decided 2026-11-18): Pet Desktop is now "all rights reserved" (1.5.1 and earlier stay MIT). Releases move to the public, code-free repo https://github.com/tnpt003/Pet-desktop-share; Done 2026-11-21: 1.5.2 (the bridge release) is on Pet-desktop-share; the source repository is private as Pet-Computer-source, and https://github.com/tnpt003/Pet-Computer is now a public bridge that only keeps 1.5.2 so old installs can update. Download links point at per-tag assets on Pet-desktop-share (docs/VERSIONS.md). Do not link the Pet source repository. The Desktop Pet privacy summary lives on /privacy#desktop-pet (the app's EULA links to /privacy).

PageSpeed-Auth-Auditor is local at `C:/Project VS/PageSpeed-Auth-Auditor`, not uploaded according to the owner. Its README describes an Electron Windows QA app with manual URL health checks, crawling, PageSpeed/Lighthouse audits and Excel reports. It requires Windows 10+ and Chrome. Do not expose its .env, audit reports or session data. A GitHub release destination in package metadata does not establish a public source repo or available downloads.

Biography and contact email are still unconfirmed. Pet media are real app captures of the 1.5 development preview; the Auditor visual remains a labeled concept until a real screenshot is supplied.

## Scope

Static Astro site plus a Cloudflare Worker (`worker/`) for visitor features: Google or email-code sign-in, threaded comments with AI moderation, feedback and download counts, stored in Cloudflare D1 (docs/DATABASE.md). `/manage` is the owner admin panel, opened by signing in at `/user/login` with the owner account (Cloudflare Access is an optional fallback). Cloudflare Web Analytics and Turnstile are the only third-party scripts.
