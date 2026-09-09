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

### Rollout: formats can coexist

:::note[Current deployment]
Index v3 and store format v2 are deployed in production. Checked on 2026-09-09, `nm000103`
served an index with `format_version: 3` and a store written by biosigIO 1.2.7. Because the
latest-only conversion runs per dataset, older v1 indexes can coexist with v3 until those datasets
are reconverted. The API schemas are live; the staging catalog currently reports zero datasets.
Always read `format_version` before interpreting a document.
:::

## The store: additive so far, on two different floors

biosigIO's own store `format_version` has stayed at `2` through several rounds of new attributes,
by the same rule the index uses: a reader that ignores attributes it does not recognize keeps working.
Three of those rounds are not on the same footing, though:

- The `sss` root attribute (Signal-Space Separation disclosure, ADR 0028) is **already live in production today** — it predates the v3 rollout.
- The declared pyramid and chunk-geometry attributes (`n_view_levels`, `view_levels`, `chunk_seconds`, `shard_seconds`, `chunk_samples`, `shard_samples`, `source_rate_hz`, `view_chunk_columns`) need biosigIO ≥1.2.6 and are present in current converted stores.
- The `nemar` root attribute is written by the NEMAR converter itself, not by biosigIO, and is present in current v3 conversions regardless of the biosigIO version that supplies the other fields.

See the [store contract's current-deployment note](/platform/zarr/store-contract/) for the biosigIO version split behind `channels_tsv_units`/`bids_unit` specifically,
and for what a live production store looks like today
(checked 2026-09-09: `biosigio_version: "1.2.7"`, with the current optional fields present on the sampled store).

biosigIO's stated policy is that a reader should reject a store whose `format_version` is *newer* than the one it supports, rather than guess at an unfamiliar layout —
the same "read the version, don't assume the shape" discipline the index asks for.

Because the store's own version has not moved, there is no store-side deprecation window to describe:
current stores remain biosigIO format version 2. The [store contract page's current-deployment note](/platform/zarr/store-contract/)
is about which *optional* attributes a given store happens to carry, tied to the biosigIO and
producer versions that wrote it, not about a store format bump.

## Where to watch for change

- **The schema itself.** `GET /schemas/zarr-index-v3.json` is the canonical, machine-readable description of the index;
  a schema validator failing against a live document is the most direct signal something changed.
- **[ADR 0033](https://github.com/nemarOrg/nemar-cli/blob/main/.context/decisions/0033-the-zarr-queue-stamps-the-engine-that-converted-each-dataset.md)** governs *when* a producer-side change reaches an already-converted dataset
  (only on `engine_version` bump — never assume a change is live everywhere just because it merged).
- **This page's own history**, in `nemarOrg/docs` — a format bump here is a documentation change reviewed the same way any other pull request is.
- **`nemarOrg/nemar-cli` releases** — the index and store schemas live in that repository (`shared/*.schema.json`),
  and a format bump ships as part of a normal release, following the [release pipeline](https://github.com/nemarOrg/nemar-cli/blob/main/AGENTS.md#release-pipeline) documented there.
