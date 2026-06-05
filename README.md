# NEMAR Documentation

Source for [docs.nemar.org](https://docs.nemar.org), built with [Astro Starlight](https://starlight.astro.build).

Migrated out of `nemarOrg/nemar-cli` (was MkDocs Material) so the CLI repo carries
no Python toolchain and the docs can be deployed and gated independently.

## Structure

```
src/content/docs/
├── index.mdx                 Landing page (splash)
├── getting-started/          PUBLIC  — install, quickstart, authentication
├── commands/                 PUBLIC  — auth/dataset/sandbox reference (generated)
├── guides/                   PUBLIC  — uploading, validation, downloading, versioning, publishing
├── reference/                PUBLIC  — configuration, environment, api, data-api
├── development/              PUBLIC  — contributor setup, zenodo testing
└── admin/                    GATED   — served under /admin/*, fronted by Cloudflare Access
    ├── commands.md           Admin command reference (generated)
    ├── github-app-setup.md
    ├── operations/           access-policies, manifest-summary-backfill, zarr-serving
    └── disaster-recovery/    restoration runbooks, fail-safes, user roles
```

Everything under `admin/` is public static HTML at build time; access control is
applied at the edge by **Cloudflare Access** on the `docs.nemar.org/admin/*` path,
not in this repo. Keep genuinely internal material (webhook internals, observability
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
  (`commands/{auth,dataset,sandbox}.mdx`, `admin/commands.mdx`) by recursively
  parsing the live `nemar … --help` tree. Run it after CLI changes. It expects
  `nemar-cli` checked out as a sibling at `../nemar-cli`.
- **`scripts/migrate-from-mkdocs.ts`** — one-time MkDocs → Starlight port
  (frontmatter, admonitions → asides, link fixups). Kept for reference; not part
  of the normal build.

## Deployment

Deployed to Cloudflare Pages (SCCN account) on the `docs.nemar.org` custom domain.
Build command `bun run build`, output `dist/`. Admin gating via a Cloudflare Access
application on `docs.nemar.org/admin/*`.
