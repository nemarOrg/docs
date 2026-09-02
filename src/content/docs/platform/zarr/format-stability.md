---
title: "Format Stability Policy"
description: "What format_version promises for the index and the store, what counts as additive versus breaking, and where to watch for change."
---

Every document and every store in this contract carries an explicit `format` and `format_version` pair.
**Read `format_version` before anything else** —
this page is what those numbers promise, so a client can detect a future change in code instead of assuming today's shape is permanent.

## Two independent counters

The [index document](/platform/zarr/index-contract/)'s `format`/`format_version` (`"nemar-zarr-index"` / `3`) and the [store](/platform/zarr/store-contract/)'s own root `format`/`format_version` (`"biosigio-zarr"` / `2`) are **separate counters that travel independently**.
A future index format change does not imply a store format change, or the reverse —
check whichever one the field you are reading lives in.

## The index: closed at each version

`shared/zarr-index.schema.json` (`nemarOrg/nemar-cli`, served at [`GET /schemas/zarr-index-v3.json`](https://api.nemar.org/schemas/zarr-index-v3.json)) sets `additionalProperties: false` on every object in the document.
This makes format version 3 **closed**: the converter validates every index against this exact schema before publishing (`validate_document` in `scripts/zarr/generate_zarr.py`),
and refuses to publish a document that does not conform —
so an index this schema accepts is, by construction, an index containing nothing this page does not already describe.

- **Additive within a version.** A change that only adds new optional fields ships as the same `format_version` (3), with the new fields declared in the schema.
  A client pinned to v3 and ignoring fields it does not recognize keeps working unchanged.
- **Breaking is a new version, at a new path.** A removed or retyped field, or a narrowed enum, ships as `format_version` 4,
  served at a **new** schema path (`/schemas/zarr-index-v4.json`) rather than edited in place at v3's path.
  `/schemas/zarr-index-v3.json` keeps serving the v3 schema for as long as any dataset still publishes a v3 index —
  there is no fixed sunset date, because the index is the mandatory entry point (anonymous `ListBucket` is denied; see [Access and hosting](/platform/zarr/access/))
  and a client has nothing else to fall back to if it disappeared.

### Rollout: format version 3 does not exist anywhere yet

:::note[Rollout]
Format version 3 ships with **nemar-cli release 0.9.12** (epic #1181), and reaches a given dataset only when that dataset then **reconverts** under the converter's current discovery generation
(`engine_version`; Architecture Decision Record (ADR) [0033](https://github.com/nemarOrg/nemar-cli/blob/main/.context/decisions/0033-the-zarr-queue-stamps-the-engine-that-converted-each-dataset.md)) —
an unchanged dataset does not pick up a producer-side format change on its own.
Checked directly on 2026-09-02 against production (`nm000103`, `nm000281`) and against the `zarr-test.nemar.org` staging host:
every index checked on both is still `format_version: 1`.
Format version 3 is not the version any dataset is serving today, in production or in staging;
once the release ships, some datasets will still take time to reconvert, so do not assume every dataset's index looks like the v3 shape this section documents — check the field, every time.
:::

## The store: additive so far, on two different floors

biosigIO's own store `format_version` has stayed at `2` through several rounds of new attributes,
by the same rule the index uses: a reader that ignores attributes it does not recognize keeps working.
Three of those rounds are not on the same footing, though:

- The `sss` root attribute (Signal-Space Separation disclosure, ADR 0028) is **already live in production today** — it predates this epic and does not wait on nemar-cli release 0.9.12.
- The declared pyramid and chunk-geometry attributes (`n_view_levels`, `view_levels`, `chunk_seconds`, `shard_seconds`, `chunk_samples`, `shard_samples`, `source_rate_hz`, `view_chunk_columns`) need biosigIO ≥1.2.6, which has not shipped to production or staging yet.
- The `nemar` root attribute is written by the NEMAR converter itself, not by biosigIO, and ships with nemar-cli release 0.9.12 regardless of biosigIO version.

See the [store contract's rollout note](/platform/zarr/store-contract/) for the biosigIO version split behind `channels_tsv_units`/`bids_unit` specifically,
and for what a live production store looks like today
(checked 2026-09-02: `biosigio_version: "1.2.1"`, none of the above except `sss`).

biosigIO's stated policy is that a reader should reject a store whose `format_version` is *newer* than the one it supports, rather than guess at an unfamiliar layout —
the same "read the version, don't assume the shape" discipline the index asks for.

Because the store's own version has not moved, **there is no store-side deprecation window to describe yet** —
every store on the platform is format version 2, before and after this rollout.
The [store contract page's rollout note](/platform/zarr/store-contract/) is about which *optional* attributes a given store happens to carry (tied to which biosigIO release wrote it, and to whether nemar-cli release 0.9.12 has shipped),
not about a version bump.

## Where to watch for change

- **The schema itself.** `GET /schemas/zarr-index-v3.json` is the canonical, machine-readable description of the index;
  a schema validator failing against a live document is the most direct signal something changed.
- **[ADR 0033](https://github.com/nemarOrg/nemar-cli/blob/main/.context/decisions/0033-the-zarr-queue-stamps-the-engine-that-converted-each-dataset.md)** governs *when* a producer-side change reaches an already-converted dataset
  (only on `engine_version` bump — never assume a change is live everywhere just because it merged).
- **This page's own history**, in `nemarOrg/docs` — a format bump here is a documentation change reviewed the same way any other pull request is.
- **`nemarOrg/nemar-cli` releases** — the index and store schemas live in that repository (`shared/*.schema.json`),
  and a format bump ships as part of a normal release, following the [release pipeline](https://github.com/nemarOrg/nemar-cli/blob/main/AGENTS.md#release-pipeline) documented there.
