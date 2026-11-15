# Project-local skills

Installed in `.agents/skills` so the repository carries its design workflow:

| Skill           | Source                                                                    | Role                                                            |
| --------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------- |
| frontend-design | https://github.com/anthropics/skills/tree/main/skills/frontend-design     | Original visual direction, typography, layout and self-critique |
| impeccable      | https://github.com/pbakaus/impeccable/tree/main/.agents/skills/impeccable | Review, refine, audit and polish interfaces                     |

Upstream license files are preserved alongside the skills. Downloads were copied from shallow Git checkouts because the Python installer runtime was unavailable. The `.setup` directory is ignored and is not part of the application.

Pinned source commits:

- frontend-design: `ca45fc496a3436251f191354091d557da31c15b5`
- impeccable: `c8891a9ae865d6ee311836ae5199bfce0fe115b1`

Skills are available to discover in the next agent turn/session. Start a new session if the active session's skill catalog does not refresh. Installing the files does not install Impeccable's engine or activate hooks. Its launcher can download a platform binary on first use; read and follow its setup instructions when needed.

## Optional, not installed

- UI UX Pro Max: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill. Add if searchable style/font/UX catalogs are needed. Its Python runtime is not currently available here.
- Framework-specific official guidance: use Astro's docs and any official agent guidance applicable to the installed version. Avoid adding a generic React/Next.js skill to an Astro project without a React/Next.js feature.
- Accessibility/browser automation: add a toolchain when building real interactions or preparing production UI; do not treat a skill as a substitute for testing the rendered page.

Use one design direction at a time. Do not ask multiple skills to impose competing style systems. Review upstream changes before updating pinned local copies.
