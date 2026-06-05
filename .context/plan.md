# NEMAR Documentation Plan

## Goal
Dedicated docs site for the whole NEMAR ecosystem (CLI is one section), on Astro Starlight,
deployed as a Cloudflare Worker on `docs.nemar.org`, with admin runbooks edge-gated by
Cloudflare Access. See `.context/decisions/0001-docs-platform-starlight.md`.

## Status markers
[ ] pending  [~] in progress  [x] complete

## Done
- [x] Scaffold Astro Starlight (Bun, no Python)
- [x] Migrate 28 pages from the old MkDocs tree (frontmatter, admonitions -> asides, links)
- [x] De-stale content against `nemar-cli` code (api endpoints, multi-account config,
      deny-list publishing, SCCN dev URL, disaster-recovery, GitHub App auth)
- [x] Generate command reference from live `nemar --help` (`scripts/generate-commands.ts`)
- [x] Ecosystem restructure: `/cli`, `/platform`, `/develop`, `/admin`; ecosystem + section landings
- [x] Cloudflare Worker deploy config (`wrangler.jsonc`, Workers Static Assets -> dist)
- [x] Build-time link validation (starlight-links-validator); all internal links valid

## Cutover checklist (docs.nemar.org)
USER = needs the maintainer (account/DNS/CF dashboard); AGENT = automatable.

- [ ] (AGENT) Create `nemarOrg/docs` repo, push this site
- [ ] (USER) Register the Cloudflare Worker (SCCN account) from this repo; confirm `bun run deploy` works with the SCCN wrangler token
- [ ] (USER) Verify on a temporary hostname (e.g. `docs-next.nemar.org`) before touching prod
- [ ] (USER) Configure Cloudflare Access on `/admin/*` (admin email/IdP policy); confirm public pages stay open
- [ ] (USER) Flip `docs.nemar.org` from the legacy `nemar-docs` Pages project to the new Worker
- [ ] (USER) Keep the old Pages project ~2 weeks for rollback, then delete
- [ ] (AGENT) After the flip verifies: remove `docs.yml`, `mkdocs.yml`, `docs/requirements.txt`, and `docs/` from `nemar-cli` (drops the Python CI dependency)

## Content backfill (additive, after cutover)
- [ ] Document `dataset search` + the `?license=` filter prominently (currently only in the generated ref)
- [ ] Passwordless web-dashboard auth (`/auth/code/*`) on the platform API page
- [ ] Archive zip, `records.json`, `bytes_url`, zarr proxy on the data-api page
- [ ] Publishing orchestrator is 16 steps now (adds `enrichment_check` + `version_doi`); doc still says 14
- [ ] Audit in-page anchor links (validator currently has `errorOnInvalidHashes: false`)

## Notes
- Command pages are generated; never hand-edit them. Re-run `bun run gen:commands` (needs `../nemar-cli`).
