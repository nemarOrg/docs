# NEMAR Documentation

> Tool-agnostic instructions for any coding agent (Codex, Cursor, Copilot, Claude Code, ...). Claude Code reads this via `@AGENTS.md` in `CLAUDE.md`.

## Project Context
**Purpose:** Source for [docs.nemar.org](https://docs.nemar.org), the documentation for the whole NEMAR (Neuroelectromagnetic Data Archive and Tools Resource) ecosystem. The command-line interface (CLI) is one section among others (platform APIs, data plane, admin); design new content so additional NEMAR systems can join as their own sections rather than being folded into the CLI docs.
**Tech Stack:** Astro Starlight, Bun, TypeScript. This repo is intentionally free of any Python toolchain (it was migrated off MkDocs precisely to drop the Python dependency that lived in `nemar-cli`).
**Deploy target:** Cloudflare Worker via Workers Static Assets (`wrangler.jsonc` serves `./dist`), SCCN Cloudflare account, custom domain `docs.nemar.org`.

## Architecture Map
```
src/content/docs/
├── index.mdx              # Ecosystem landing (splash)
├── ecosystem/             # How the NEMAR systems fit together
├── cli/                   # PUBLIC: the nemar CLI (one part of the ecosystem)
│   ├── getting-started/   #   install, quickstart, authentication
│   ├── guides/            #   uploading, validation, downloading, versioning, publishing
│   ├── commands/          #   command reference (GENERATED from `nemar --help`)
│   └── reference/         #   configuration, environment
├── platform/              # PUBLIC: backend API + data plane
├── develop/               # PUBLIC: contributor setup, zenodo testing
└── admin/                 # GATED: served under /admin/*, edge-gated by Cloudflare Access
    ├── commands.mdx        #   admin command reference (GENERATED)
    ├── github-app-setup.md
    ├── operations/         #   access-policies, manifest-summary-backfill, zarr-serving
    └── disaster-recovery/  #   restoration runbooks
scripts/
├── generate-commands.ts   # Regenerate command reference from live `nemar --help`
├── migrate-from-mkdocs.ts # One-time MkDocs import (kept for reference)
└── restructure-ecosystem.ts # One-time reshape into the ecosystem layout (kept for reference)
astro.config.mjs           # Sidebar nav + starlight-links-validator
wrangler.jsonc             # Cloudflare Worker (Workers Static Assets -> dist)
```

## Public vs Admin (access model)
Everything under `src/content/docs/admin/` builds to `/admin/*`. The whole site is static; access control is applied at the **edge by Cloudflare Access** on `docs.nemar.org/admin/*` (email/IdP policy), NOT by repo privacy. The repo is public. Keep genuinely internal material (webhook contracts, observability internals, SSR contracts) in the `nemar-cli` repo, not on this site even behind the gate.

## Environment Setup
```bash
bun install        # never npm/npx/pnpm
bun run dev        # local dev server at localhost:4321
bun run build      # build to ./dist (Pagefind search + sitemap + link validation)
bun run gen:commands   # regenerate the CLI command reference (needs ../nemar-cli)
```

## Generators (keep docs in sync with the CLI)
- **`scripts/generate-commands.ts`** recursively parses `nemar … --help` to emit the command-reference pages (`cli/commands/*.mdx`, `admin/commands.mdx`). It expects `nemar-cli` checked out as a sibling at `../nemar-cli`. Re-run after CLI changes; do not hand-edit the generated command pages.
- **`scripts/migrate-from-mkdocs.ts`** and **`scripts/restructure-ecosystem.ts`** are one-time scripts retained for provenance; they are not part of the normal build.

## Content Conventions
- Every page needs Starlight frontmatter with a `title`.
- Use Starlight asides (`:::note`, `:::tip`, `:::caution`, `:::danger`), not MkDocs `!!!` admonitions.
- Prefer root-absolute internal links (`/cli/guides/uploading/`); relative links are allowed if they resolve. `bun run build` fails on broken internal links (starlight-links-validator).
- "The website" / "the browser" means `ww2.nemar.org`; `nemar.org` is the legacy PHP dataexplorer. The API is `api.nemar.org`, data plane `data.nemar.org`, viewer `zarr.nemar.org`. Never reference the retired `api.osc.earth` or the retired `neuromechanist` Cloudflare account (SCCN only).

## Development Workflow
1. Check `.context/plan.md` for current tasks (the cutover checklist lives there).
2. Branch: `gh issue develop <issue-number>` (or `git checkout -b feature/short-description`).
3. Edit content / scripts; run `bun run build` (must pass link validation).
4. Commit: atomic, <50 chars, no emojis, no AI attribution.
5. PR; run `/review-pr` for non-trivial changes.

## Deployment
Deployed as a Cloudflare Worker (Workers Static Assets) on the SCCN account. `bun run build` produces `./dist`; `bun run deploy` runs `astro build && wrangler deploy`. Custom-domain binding to `docs.nemar.org` and the Cloudflare Access app on `/admin/*` are configured in the Cloudflare dashboard.

## [NEVER DO THIS]
- Never use `npm`, `npx`, or `pnpm`; use Bun.
- Never add a Python toolchain to this repo (the whole point of leaving MkDocs).
- Never hand-edit generated command pages; re-run `scripts/generate-commands.ts`.
- Never commit secrets, `.env` files, or credentials.
- Never use emojis or AI attribution in commits, PRs, or content.
- Never reference retired infra (`api.osc.earth`, `neuromechanist` account).

## Rules Reference
- `.rules/documentation.md` - documentation standards
- `.rules/git.md` - commit and branching standards
- `.rules/code_review.md` - PR review process
- `.rules/ci_cd.md` - GitHub Actions setup
- `.rules/self_improve.md` - capturing learnings
- `.rules/serena_mcp.md` - Serena MCP code intelligence (when available)

## Context Files
- `.context/plan.md` - current tasks + the docs.nemar.org cutover checklist
- `.context/ideas.md` - design decisions and alternatives
- `.context/research.md` - investigations (e.g. the Mintlify evaluation)
- `.context/scratch_history.md` - failed attempts and lessons
- `.context/decisions/` - Architecture Decision Records (see ADR 0001 for the platform choice)
