# NEMAR Documentation

Source for [docs.nemar.org](https://docs.nemar.org), built with [Astro Starlight](https://starlight.astro.build).

Migrated out of `nemarOrg/nemar-cli` (was MkDocs Material) so the CLI repo carries
no Python toolchain and the docs can be deployed and gated independently.

## Structure

```
src/content/docs/
├── index.mdx                 Landing page (splash)
├── ecosystem/                PUBLIC  — how the NEMAR systems fit together, CLI vs. web
├── cli/                      PUBLIC  — the nemar CLI
│   ├── getting-started/      —   install, quickstart, authentication
│   ├── guides/                —   uploading, validation, downloading, versioning, publishing
│   ├── commands/              —   auth/dataset/sandbox reference (generated)
│   └── reference/             —   configuration, environment, account access, debugging
├── platform/                 PUBLIC  — backend API, data plane, Zarr serving
├── web/                      PUBLIC  — the web app: getting started, account settings, uploading
├── policies/                 PUBLIC  — privacy, GDPR, contributor terms, takedown
├── develop/                  PUBLIC  — contributor setup, zenodo testing
└── admin/                    GATED   — served under /admin/*, admin-only NEMAR session
    ├── index.md               Section index for the gated pages
    ├── commands.mdx           Admin command reference (generated)
    ├── github-app-setup.md
    ├── operations/            access-policies, account-tiers, account-kinds, zarr-serving
    └── disaster-recovery/     restoration runbooks, fail-safes, user roles
```

Everything under `admin/` is static HTML at build time, and access control is applied
in front of it by **NEMAR's own ORCID-backed session**, checked for the `admin` role
against `users.role` in the platform database. It is **not** Cloudflare Access: see
[Deployment](#deployment) for what Access does cover here. Because the platform session
cookie is scoped to `app.nemar.org` and cannot be read on this hostname, signing in is a
handoff through the website rather than a shared cookie; `AGENTS.md` describes the parts.

Gated is not secret: this repository is public, so every admin page is readable on
GitHub. Keep genuinely internal material (webhook internals, observability
instrumentation, SSR contracts) in `nemar-cli` `AGENTS.md`, not here.

## Commands

| Command | Action |
| :-- | :-- |
| `bun install` | Install dependencies |
| `bun run dev` | Local dev server at `localhost:4321` |
| `bun run build` | Build to `./dist/` (includes Pagefind search + sitemap) |
| `bun run preview` | Preview the production build |

## Generators

Two scripts keep content in sync with the CLI; both are pure Bun/TypeScript (no Python):

- **`scripts/generate-commands.ts`** — regenerates the command reference
  (`cli/commands/{auth,dataset,sandbox}.mdx`, `admin/commands.mdx`) by
  recursively parsing the live `nemar … --help-all` tree. Run it after CLI
  changes. It expects `nemar-cli` checked out as a sibling at `../nemar-cli`
  by default; set `NEMAR_CLI_ENTRY` to point at a different checkout instead.
- **`scripts/migrate-from-mkdocs.ts`** — one-time MkDocs → Starlight port
  (frontmatter, admonitions → asides, link fixups). Kept for reference; not part
  of the normal build.

## Deployment

Served by the `nemar-docs` Cloudflare **Pages** project on the SCCN account, git-connected
with `main` as the production branch and bound to the `docs.nemar.org` custom domain. Build
command `bun run build`, output `dist/`. (`wrangler.jsonc` describes a planned move to a
Workers Static Assets deployment; it is not what serves the site today.)

`/admin/*` is gated by NEMAR's own admin-only session, enforced in this repo by a Pages
Function that checks the session against the platform API before the static asset is served.
The Cloudflare Access application on this project covers **preview deployments only**, never
`docs.nemar.org` itself. Saying otherwise is what left all twelve admin pages answering 200
to anyone while they were believed to be protected, so keep the distinction explicit.

## Community and policies

- [NEMAR policies](https://docs.nemar.org/policies/): privacy policy, data contributor terms, GDPR position statement, takedown procedure
- [Code of Conduct](https://github.com/nemarOrg/.github/blob/main/CODE_OF_CONDUCT.md), [Contributing](https://github.com/nemarOrg/.github/blob/main/CONTRIBUTING.md), and [Security policy](https://github.com/nemarOrg/.github/blob/main/SECURITY.md) apply org-wide from [nemarOrg/.github](https://github.com/nemarOrg/.github).
- Help using NEMAR: support@nemar.org. Bugs and feature requests: open an issue on this repository.
