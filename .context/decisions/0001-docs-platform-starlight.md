# ADR 0001: Astro Starlight (not Mintlify) for NEMAR docs

**Status:** accepted
**Date:** 2026-06-05
**Owner:** Seyed Yahya Shirazi

## Context

NEMAR documentation lived inside `nemar-cli` as a MkDocs Material site, deployed by a CI workflow that ran `pip install mkdocs` (a Python dependency the CLI repo should not carry) to a Cloudflare Pages project on `docs.nemar.org`. The content was stale and CLI-centric, even though NEMAR is a multi-system platform. We wanted a dedicated docs repo, an ecosystem-wide information architecture, and the ability to put admin/operations runbooks behind a login.

## Decision

Build the docs as an Astro Starlight site in a dedicated repo (`nemarOrg/docs`), self-hosted as a Cloudflare Worker (Workers Static Assets) on the SCCN account. Gate admin content with Cloudflare Access on the `/admin/*` path, not with a docs-vendor auth feature.

## Consequences

- No Python toolchain in either the CLI repo or the docs repo (Bun/TypeScript only).
- Stack matches `ww2.nemar.org` (Astro), so conventions and deploy patterns are shared.
- Free Pagefind search and build-time link validation.
- The "passport" for admin docs is Cloudflare Access (email/IdP), free on the existing account, decoupled from any docs vendor.
- Command reference is generated from the live `nemar --help`, so it cannot drift, but the docs repo depends on `nemar-cli` being available as a sibling for regeneration.
- Downside: we maintain the theme/build ourselves rather than getting a hosted product's polish and AI assistant.

## Alternatives considered

- **Mintlify:** the requested "admin docs behind a password" maps to password/OAuth/JWT auth, which is Enterprise (contact-sales) only. The OSS program grants AI credits + custom domain + API playground but explicitly NOT authentication, and Mintlify is hosted SaaS (off the Cloudflare stack). Rejected: the exact feature wanted is its most expensive tier, and it does not self-host.
- **Split-out MkDocs (move as-is to a new repo):** lowest effort, but perpetuates the Python toolchain and diverges from the Astro stack. Rejected as anything but a time-boxed fallback.

## Receipts

- Mintlify pricing + auth: password/OAuth/JWT require Enterprise; dashboard auth on all plans (mintlify.com/docs authentication).
- OSS program: 10,250 AI credits/mo + custom domain + API playground, no auth (mintlify.com/oss-program).
- Migration commits in this repo: initial Starlight migration, then the ecosystem restructure.
