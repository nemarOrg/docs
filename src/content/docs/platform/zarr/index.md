---
title: "Zarr Serving Copy"
description: "The derived Zarr v3 serving copy and recording index: what it is, what it is not, and where its contract is documented."
---

NEMAR tracks every recording in an index and, where conversion succeeds, maintains a derived Zarr
version 3 (v3) copy in a published Brain Imaging Data Structure (BIDS) dataset. This lets a browser
scrub a signal without downloading the whole file and lets a machine learning (ML) pipeline stream
samples instead of pulling the original recording first.

This section is the contract for anyone building against that copy:
a viewer, an inference service, a training loader, or an agent.
It does not cover how the copy is produced or operated;
that is a separate, access-gated runbook for NEMAR administrators (`/admin/operations/zarr-serving/`).

## Pages

- **[Store contract](/platform/zarr/store-contract/)** — the Zarr v3 layout inside one recording's store:
  groups, the level-0 signal array, the `view/*` render pyramid, the `events` group,
  and how to turn stored integers back into physical units.
- **[Index contract](/platform/zarr/index-contract/)** — the per-dataset `index.json` document that lists every store, failure, and pending recording, field by field,
  plus the sidecar `manifest.json`, the dataset-wide `events.parquet` file, and the top-level discovery catalog.
- **[Access and hosting](/platform/zarr/access/)** — which URL is stable,
  how anonymous reads work,
  the browser-versus-machine split at the edge,
  caching, and rate limits.
- **[Cost ladder and recipes for agents](/platform/zarr/cost-ladder/)** — roughly how many bytes and requests each layer of the contract costs,
  and worked read recipes in Python and JavaScript.
- **[Format stability policy](/platform/zarr/format-stability/)** — what `format_version` promises,
  what counts as additive versus breaking,
  and where a client should watch for change.

## What this copy is, and is not

- **Derived and reproducible.** Every store is generated from the dataset's BIDS recordings;
  BIDS remains the source of truth,
  and a store can always be rebuilt from it.
- **Latest-only, not versioned.** The copy tracks the dataset repository's `main` branch head.
  There is one store per recording, not one per released dataset version,
  and there is no history: a re-conversion overwrites the previous store in place.
  For a specific, citable version of a dataset, use its archived release and Digital Object Identifier (DOI), not this copy.
- **Not citable data.** The copy is a viewing and streaming convenience, not an archival format,
  and is not a substitute for the dataset's own archived, versioned, DOI-assigned data.
- **Raw recordings only.** Coverage is BIDS raw data, the recordings under each subject or session data-type folder.
  Derivatives, source data, and code folders are out of scope and are never converted (Architecture Decision Record (ADR) 0027).
- **Almost always the source signal, with one disclosed exception.** A store normally carries the recording as acquired, quantized and rate-capped, and nothing else.
  Some magnetoencephalography (MEG) recordings are acquired with internal active shielding, which distorts the signal until corrected;
  those recordings are corrected before serving and the resulting store is a **processed derivative** rather than the raw signal (ADR 0028).
  See [Store contract: `derived` and `sss`](/platform/zarr/store-contract/#derived-source_tree-and-sss) before training across datasets.
- **No stability promise beyond what is written here.** Every index and every store carries explicit `format` and `format_version` fields.
  Treat this section as a description of the current contract,
  and check those fields in code that needs to detect a future change;
  see [Format stability policy](/platform/zarr/format-stability/).

## Current rollout status

The producer and serving contract described here is deployed in production. Checked on
2026-09-09: `nm000103` served an index with `format_version: 3`, a `manifest.json`, and
`events.parquet`; `https://zarr.nemar.org/catalog.json` returned a catalog with 625 datasets;
and `api.nemar.org` returned working `has_zarr` and `has_zarr_verified` filters.

The staging schema endpoints are live, but `zarr-test.nemar.org/catalog.json` currently reports
zero datasets. Do not infer staging dataset availability from the contract alone. Older datasets
can retain an earlier producer shape until they are reconverted, so clients should read each
index's `format_version`, `engine_version`, `biosigio_version`, and timestamps rather than
assuming the platform has one conversion state.

| Capability | Current production status (checked 2026-09-09) |
| --- | --- |
| Index format | v3 on sampled `nm000103`; older datasets may coexist |
| `nemar` root attribute and geometry | present on a sampled current store written by biosigIO 1.2.7 |
| Schemas | live at `api.nemar.org/schemas/zarr-index-v3.json` and `zarr-manifest-v1.json` |
| Catalog | live at `zarr.nemar.org/catalog.json` (625 entries at the check) |
| Manifest and events | live for `nm000103`; optional fields or files can be absent for other datasets |
| Non-browser store/document GET | 302 to public S3; browser-origin GETs are proxied; HEAD remains proxied |
| API filters | live; sample totals were 625 for `has_zarr` and 51 for `has_zarr_verified` |
| Anonymous object reads and `s3:ListBucket` denial | object reads are public; bucket listing remains denied |

`events.parquet` was introduced in the nemar-cli 0.9.12 line through
[nemarOrg/nemar-cli#1205](https://github.com/nemarOrg/nemar-cli/pull/1205) and is now live for
datasets whose current conversion produced it. The release and issue references describe the
history of the rollout; they are not a promise that every dataset has already been reconverted.
