# NEMAR Documentation

> Tool-agnostic instructions for any coding agent (Codex, Cursor, Copilot, Claude Code, ...). Claude Code reads this via `@AGENTS.md` in `CLAUDE.md`.

## Project Context
**Purpose:** Source for [docs.nemar.org](https://docs.nemar.org), the documentation for the whole NEMAR (Neuroelectromagnetic Data Archive and Tools Resource) ecosystem. The command-line interface (CLI) is one section among others (platform APIs, data plane, admin); design new content so additional NEMAR systems can join as their own sections rather than being folded into the CLI docs.
**Tech Stack:** Astro Starlight, Bun, TypeScript. This repo is intentionally free of any Python toolchain (it was migrated off MkDocs precisely to drop the Python dependency that lived in `nemar-cli`).
**Deploy target:** the `nemar-docs` Cloudflare **Pages** project on the SCCN account, git-connected to `main` and bound to `docs.nemar.org`. A push to `main` builds and deploys itself; nothing here is deployed by hand. The `wrangler.jsonc` in this repo describes a planned move to a Workers Static Assets deployment and is NOT what serves the site today (its own comment says the name is provisional to avoid colliding with this Pages project). See the Deployment section below.

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
└── admin/                 # GATED: served under /admin/*, admin-only NEMAR session (see below)
    ├── index.md           #   section index: what each gated group is for
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
Everything under `src/content/docs/admin/` builds to `/admin/*` and is gated by **NEMAR's own ORCID-backed session**, not by repo privacy and not by Cloudflare Access. The repo is public. Keep genuinely internal material (webhook contracts, observability internals, SSR contracts) in the `nemar-cli` repo, not on this site even behind the gate.

**What this file used to say was false, and it matters.** It claimed Cloudflare Access enforced on `docs.nemar.org/admin/*`. It did not: the Access app on this Pages project covers **preview deployments only**, so every page under `/admin/` answered 200 to anyone on production and all 12 were listed in the public sitemap. Nothing confidential leaked (procedures and identifiers, never credential values, in a public repo), but anyone reading this file believed the section was protected and would have written accordingly. If you find yourself relying on a control described here, check it with a request before you trust it.

The gate has three parts, and removing any one of them reopens the hole:

1. **`functions/admin/_middleware.ts`** requires a `nemar_docs_session` cookie and asks `api.nemar.org/auth/docs/verify` whether it belongs to an admin. `users.role` in the platform database is the single source of truth, which is why this is not an Access email allowlist: a second copy of "who is an admin" is the thing that drifts. It **fails closed** -- an unreachable API refuses the page. A signed-in non-admin gets **404, not 403**, matching `adminGate` on the website, so the response does not confirm to a signed-in reader that their account was checked and found wanting.

   **Do not upgrade that into a claim that the section is hidden.** It is not, and aiming for it would be wasted work: the sidebar links all 13 admin pages by title from every public page, `robots.txt` names the prefix in order to ask crawlers off it, and this repository is public, so the pages themselves are on GitHub. The gate controls who is *served* the pages on this host. Non-disclosure is not one of its properties, and no comment or document here should imply otherwise.
2. **`public/_routes.json`** names `/admin/*` and `/__docs-auth/*` as the only paths that invoke a Function. This is load-bearing and easy to delete by accident: without it public pages would pay a Function invocation, and the auto-generated routes file is not something to rely on for an access control.
3. **Nothing about `/admin/` in the documents served outside the gate**, enforced by `scripts/check-admin-gating.ts`, which the `build` script runs twice: once on the source before `astro build` (a fast error naming the page that is missing a top-level `pagefind: false`) and once with `--built` on `dist/` afterwards. The second run is the deciding one, because the source check argues about text while the built one reads what was published: it fails on an `/admin/` URL in a Pagefind fragment, in the sitemap, or in `llms.txt`. `/pagefind/*`, `/sitemap-0.xml` and `/llms.txt` are all outside `/admin/`, so the middleware never sees them, and the search index otherwise carries the full text of every admin page. Two traps: Starlight honours `pagefind: false` only as a **top-level** frontmatter field, so a nested one is a false pass; and fragments are gzip behind a `pagefind_dcd` marker, so a plain `grep` over `dist/pagefind/` finds nothing **even when the content is there** -- decompress, or you will get a false pass. The sitemap exclusion is the `filter` on the `@astrojs/sitemap` integration declared in `astro.config.mjs`; declaring it there replaces the copy Starlight would otherwise inject.

Signing in goes through the website: the middleware redirects to `app.nemar.org/auth/docs/authorize`, which proves an admin session and returns to `/__docs-auth/callback` with a one-time code worth 60 seconds. The docs host trades it for its own cookie (`functions/__docs-auth/callback.ts`). The cookie is host-only by design; the platform's own session is scoped to `app.nemar.org` so it never travels to the data or zarr hosts, which is exactly why a handoff is needed rather than a shared cookie. Signing out of nemar.org revokes the docs session too.

**Verifying it.** `bun test` covers the middleware's decisions. It cannot cover the routing, and this is the trap: `wrangler pages dev` serves a static asset **without invoking the Function**, while deployed Pages invokes the Function first and falls back to the asset only when none matches. So a local run can show a gate working that does nothing in production, or the reverse. Against a deployed host use `bun run probe:gate` (add a URL argument for a preview), which needs no credentials because the thing worth checking is what an anonymous visitor gets. Run it after any deploy that touches the gate, the routes file, or the admin section.

## Environment Setup
```bash
bun install        # never npm/npx/pnpm
bun run dev        # local dev server at localhost:4321
bun run build      # build to ./dist (Pagefind search + sitemap + link validation)
bun run gen:commands   # regenerate the CLI command reference (needs ../nemar-cli)
```

## Generators (keep docs in sync with the CLI)
- **`scripts/generate-commands.ts`** recursively parses `nemar … --help-all` to emit the command-reference pages (`cli/commands/*.mdx`, `admin/commands.mdx`). It expects `nemar-cli` checked out as a sibling at `../nemar-cli` by default; set `NEMAR_CLI_ENTRY` to point at a different checkout (a worktree whose branch hasn't merged yet). Re-run after CLI changes; do not hand-edit the generated command pages.
- **`scripts/migrate-from-mkdocs.ts`** and **`scripts/restructure-ecosystem.ts`** are one-time scripts retained for provenance; they are not part of the normal build.

## Content Conventions
- Every page needs Starlight frontmatter with a `title`.
- Use Starlight asides (`:::note`, `:::tip`, `:::caution`, `:::danger`), not MkDocs `!!!` admonitions.
- Prefer root-absolute internal links (`/cli/guides/uploading/`); relative links are allowed if they resolve. `bun run build` fails on broken internal links (starlight-links-validator).
- "The website" / "the browser" means `nemar.org` (the apex cutover is done; the legacy PHP dataexplorer is gone). `ww2.nemar.org` and `www.nemar.org` still resolve but are non-canonical aliases; never reference them in content. The API is `api.nemar.org`, data plane `data.nemar.org`, viewer `zarr.nemar.org`. Never reference the retired `api.osc.earth` or the retired `neuromechanist` Cloudflare account (SCCN only).
- Every page shows a created date and a last-updated date, derived from git history at build time.
Override either with `created:` or `lastUpdated:` frontmatter, but only when history misleads, such as a moved or regenerated file.
`lastUpdated: false` hides the last-updated line.
A shallow clone hides both git-derived dates and logs a build warning instead of showing a wrong date.

## Development Workflow
1. Check `.context/plan.md` for current tasks (the cutover checklist lives there).
2. Branch: `gh issue develop <issue-number>` (or `git checkout -b feature/short-description`).
3. Edit content / scripts; run `bun run build` (must pass link validation).
4. Commit: atomic, <50 chars, no emojis, no AI attribution.
5. PR; run `/review-pr` for non-trivial changes.

## Deployment
Served by the `nemar-docs` Cloudflare Pages project on the SCCN account, git-connected with `main` as the production branch: merging to `main` triggers the build and the deploy, and a branch push gets a preview deployment. Confirm one with `bunx cfman wrangler --account sccn pages deployment list --project-name nemar-docs`.

Custom-domain binding to `docs.nemar.org` is configured in the Cloudflare dashboard. So is the Cloudflare Access application on this project, which covers **preview deployments only** and has never covered the production hostname: `/admin/*` on `docs.nemar.org` is gated by the session handoff described above, and nothing in the dashboard gates it.

`bun run deploy` (`astro build && wrangler deploy`) targets the Workers Static Assets deployment in `wrangler.jsonc`, which does not exist on the account yet (`wrangler deployments list` answers `This Worker does not exist`). Do not run it expecting to publish the live site.

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
