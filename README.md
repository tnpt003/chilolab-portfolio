# ChiloLab portfolio

Bilingual Astro + TypeScript foundation for `chilolab.com`.

## Run locally

Node.js 24 LTS at a current patch version and npm are recommended (Astro's declared minimum is 22.23.4). The development machine uses Node 26; CI uses Node 24.

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Astro. In PowerShell, use `npm.cmd` instead of `npm` if script execution policy blocks npm.ps1.

```sh
npm run verify
npm run format:check
npm run preview
```

`verify` checks Astro/TypeScript, builds static output, then validates generated bilingual routes, page links, metadata and sitemap. It does not replace visual browser/accessibility testing.

## Routes

| Vietnamese                | English                      |
| ------------------------- | ---------------------------- |
| `/`                       | `/en/`                       |
| `/pet-desktop`            | `/en/pet-desktop`            |
| `/pagespeed-auth-auditor` | `/en/pagespeed-auth-auditor` |

`public/_redirects` prepares a host-level redirect from `/PageSpeed-Auth-Auditor` to the lowercase route. Confirm support on the chosen host; this is not a second local page. Static output is in `dist/`. The site has no runtime secrets, database or server dependency.

## Edit content

- `src/content/projects/{vi,en}`: Markdown project content.
- `src/content.config.ts`: validated frontmatter schema.
- `src/lib/content.ts`: content loading, localized UI text and path helpers.
- `src/styles/tokens.css`: visual tokens.
- `src/components`: shared page components.

Project details are provisional and concept drawings are labeled. Add real information and assets before public launch.

## Project guidance

- [Product context](PRODUCT.md)
- [DevOps hands-on lab](docs/DEVOPS-LAB.md)
- [Visual foundation](DESIGN.md)
- [CMS and launch roadmap](docs/CMS-ROADMAP.md)
- [Edit content step by step](docs/EDITING.md)
- [Publish product version notes](docs/VERSIONS.md)
- [Cloudflare deployment](docs/DEPLOYMENT.md)
- [Prepare the public repository](docs/PUBLIC-REPO.md)
- [Installed and optional skills](docs/SKILLS.md)
- [Agent conventions](AGENTS.md)

GitHub Actions is prepared but requires pushing this folder to a GitHub repository. No remote repository, domain, hosting, CMS account or production deployment has been created.
