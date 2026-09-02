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

### The version currently on the wire is not uniform

Format version 3 is reached by a dataset only when it **reconverts** under the converter's current discovery generation
(`engine_version`; Architecture Decision Record (ADR) [0033](https://github.com/nemarOrg/nemar-cli/blob/main/.context/decisions/0033-the-zarr-queue-stamps-the-engine-that-converted-each-dataset.md)) —
an unchanged dataset does not pick up a producer-side format change on its own.
Checked directly against production on 2026-09-02, `nm000103`'s index was still `format_version: 1`;
format version 3 is not yet the version most datasets are serving.
Do not assume every dataset's index looks like the v3 shape this section documents — check the field, every time.

## The store: additive so far

biosigIO's own store `format_version` has stayed at `2` through several rounds of new attributes —
the declared pyramid (`n_view_levels`, `view_levels`, `chunk_seconds`, `shard_seconds`), `channels_tsv_units` and `bids_unit`,
and NEMAR's own `nemar` and `sss` root attributes are all additive on top of it,
by the same rule the index uses: a reader that ignores attributes it does not recognize keeps working.
biosigIO's stated policy is that a reader should reject a store whose `format_version` is *newer* than the one it supports, rather than guess at an unfamiliar layout —
the same "read the version, don't assume the shape" discipline the index asks for.

Because the store's own version has not moved, **there is no store-side deprecation window to describe yet** —
every store on the platform, old and newly converted alike, is format version 2.
The [store contract page's rollout note](/platform/zarr/store-contract/) is about which *optional* attributes a given store happens to carry (tied to which biosigIO release wrote it),
not about a version bump.

## Where to watch for change

- **The schema itself.** `GET /schemas/zarr-index-v3.json` is the canonical, machine-readable description of the index;
  a schema validator failing against a live document is the most direct signal something changed.
- **[ADR 0033](https://github.com/nemarOrg/nemar-cli/blob/main/.context/decisions/0033-the-zarr-queue-stamps-the-engine-that-converted-each-dataset.md)** governs *when* a producer-side change reaches an already-converted dataset
  (only on `engine_version` bump — never assume a change is live everywhere just because it merged).
- **This page's own history**, in `nemarOrg/docs` — a format bump here is a documentation change reviewed the same way any other pull request is.
- **`nemarOrg/nemar-cli` releases** — the index and store schemas live in that repository (`shared/*.schema.json`),
  and a format bump ships as part of a normal release, following the [release pipeline](https://github.com/nemarOrg/nemar-cli/blob/main/AGENTS.md#release-pipeline) documented there.
