---
title: "Zarr Serving Copy"
description: "The derived Zarr v3 serving copy of every NEMAR recording: what it is, what it is not, and where its contract is documented."
---

NEMAR maintains a derived Zarr version 3 (v3) copy of every recording in a published Brain Imaging Data Structure (BIDS) dataset,
so a browser can scrub a signal without downloading the whole file
and a machine learning (ML) pipeline can stream samples instead of pulling the original recording first.

This section is the contract for anyone building against that copy:
a viewer, an inference service, a training loader, or an agent.
It does not cover how the copy is produced or operated;
that is a separate, access-gated runbook for NEMAR administrators (`/admin/operations/zarr-serving/`).

## Pages

- **[Store contract](/platform/zarr/store-contract/)** — the Zarr v3 layout inside one recording's store:
  groups, the level-0 signal array, the `view/*` render pyramid, the `events` group,
  and how to turn stored integers back into physical units.
- **[Index contract](/platform/zarr/index-contract/)** — the per-dataset `index.json` document that lists every store, failure, and pending recording, field by field,
  plus the sidecar `manifest.json` and the top-level discovery catalog.
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

## What is live today versus after the release

This page and the four it links to describe the contract as it ships, not as it stands today.
**Nothing in the "after" column below exists in production or in staging as of 2026-09-02** — checked live, and against the deployed source for the two rows that cannot be checked by URL alone.
It all ships together with **nemar-cli release 0.9.12** (epic #1181), except `events.parquet`, which is a separate, later release (see the note below the table).

| Capability | Today (production and staging) | After nemar-cli release 0.9.12 |
| --- | --- | --- |
| Index `format_version` | `1`, on every dataset checked | `3`, once a dataset reconverts under the new engine version |
| `nemar` root store attribute | absent from every store | present on every store converted after the release |
| Declared pyramid / chunk-geometry attributes | absent (needs biosigIO ≥1.2.6, not yet installed) | present |
| `channels_tsv_units` / `bids_unit` parity across both export paths | absent (needs biosigIO ≥1.2.7) | present |
| `sss` root attribute (MaxShield correction, ADR 0028) | **already live** — predates this epic | unchanged |
| `GET /schemas/*` | `404` | serves the index and manifest JSON Schemas |
| `GET /catalog.json` | `404` | serves `zarr-catalog.json`, the discovery front door |
| `manifest.json` | `404` | serves the producer manifest split out of `index.json` |
| A non-browser request for a store object | proxied, the same as every other request | redirected (`302`) straight to S3 |
| `index.json` / `zarr.json` cache lifetimes | flat `max-age=60, stale-while-revalidate=300` for both | `300s`/`3600s` and `60s`/`300s` respectively when untokened; `86400s` when tokened |
| `has_zarr` / `has_zarr_verified` API filters | accepted as query parameters, silently ignored | `has_zarr` filters correctly; `has_zarr_verified` narrows it further |
| Anonymous S3 reads; `s3:ListBucket` denial | **already live**, independent of this epic | unchanged |

See the "Rollout" note on whichever page documents each row for how it was checked.

:::note[In progress]
The `events.parquet` sidecar and its `sample_index` guarantee for training-time streaming are a separate, later release — not part of nemar-cli 0.9.12.
The [index contract](/platform/zarr/index-contract/#eventsparquet) page carries a placeholder for that section until it lands;
see [nemarOrg/nemar-cli#1060](https://github.com/nemarOrg/nemar-cli/issues/1060).
:::
