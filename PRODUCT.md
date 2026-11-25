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

Pet Desktop releases: https://github.com/tnpt003/Pet-Computer (public; the owner chose it on 2026-11-21 as the download home). A Windows desktop cat built with C#/WPF, plus optional adventures. Version posts exist for 1.4.0–1.5.0 and 1.5.2; only 1.5.2 has download links (per-tag Setup.exe and Portable.zip on Pet-Computer); older posts have no links because their binaries are no longer published. Download buttons use the releases/latest form (docs/VERSIONS.md). The project page and home row show a live public download count: GitHub's own download_count for PetComputer-win-Setup.exe + PetComputer-win-Portable.zip across Pet-Computer releases (owner's choice, 2026-11-25), not the site's click counter. /pet-desktop shows the featured release (`featuredVersion`). 1.5.1 (2026-11-14) has no version post here. Verify release notes before promising a feature in a download. Download links depend on Pet-Computer's releases being public and keeping the asset names PetComputer-win-Setup.exe and PetComputer-win-Portable.zip.

Source move (decided 2026-11-18): Pet Desktop is now "all rights reserved" (1.5.1 and earlier stay MIT). Releases move to the public, code-free repo https://github.com/tnpt003/Pet-desktop-share; Done 2026-11-21: 1.5.2 (the bridge release) is on Pet-desktop-share; the source repository is private as Pet-Computer-source, and https://github.com/tnpt003/Pet-Computer is now a public bridge that only keeps 1.5.2 so old installs can update. Update 2026-11-21: the owner chose Pet-Computer, not Pet-desktop-share, as the repository the site links for downloads. Do not link the Pet source repository. The Desktop Pet privacy summary lives on /privacy#desktop-pet (the app's EULA links to /privacy).

PageSpeed-Auth-Auditor is local at `C:/Project VS/PageSpeed-Auth-Auditor`, not uploaded according to the owner. Its README describes an Electron Windows QA app with manual URL health checks, crawling, PageSpeed/Lighthouse audits and Excel reports. It requires Windows 10+ and Chrome. Do not expose its .env, audit reports or session data. A GitHub release destination in package metadata does not establish a public source repo or available downloads.

Biography (confirmed 2026-11-18, lives in src/lib/profile.ts): HUFLIT, Information Technology, graduated 2026 (degree title not given); BA/QC at WeebPal since 08/2025. Do not name WeebPal's clients or client contacts on the site (NDA); describe them by kind. The three Athena certificates (ACBN 07–08/2022, CCNA programme 01–03/2023, Linux Master 04–08/2023) are course completions from a training center, not Cisco/LPI vendor certifications; never publish the PDFs (date of birth, portrait, QR). Do not show course dates on the site (owner's request); link Athena to https://athena.edu.vn/. TOEIC score and image are pending from the owner. Contact email tnpt003@gmail.com is approved for the About page. Pet media are real app captures of the 1.5 development preview; the Auditor image is a real main-screen capture from its user guide.

## Scope

Static Astro site plus a Cloudflare Worker (`worker/`) for visitor features: Google or email-code sign-in, threaded comments with AI moderation, feedback and download counts, stored in Cloudflare D1 (docs/DATABASE.md). `/admin/manage` is the owner admin panel (the old `/manage` redirects there), opened only by signing in at `/user/login` with the owner account; Cloudflare Access was removed on 2026-11-25. Cloudflare Web Analytics and Turnstile are the only third-party scripts.
