---
title: "Index Contract"
description: "The per-dataset index.json document: format_version 3 field by field, the discovered_count invariant, failure and pending semantics, and the discovery catalog."
---

Every public dataset with a Zarr copy has a per-dataset index at:

```
https://zarr.nemar.org/<dataset_id>/zarr/index.json
```

This document — not a directory listing — is how a client discovers what is served for a dataset and why a recording is missing.
Anonymous `ListBucket` is denied on the serving bucket entirely, including at the bucket root, so there is no listing to fall back to;
see [Access and hosting](/platform/zarr/access/) for the bucket's access model.
A request without the `/zarr/` path segment, or for a dataset id alone with no file name, returns `404`.

The document's JSON Schema is published at:

```
GET https://api.nemar.org/schemas/zarr-index-v3.json
```

served directly from the repository's `shared/zarr-index.schema.json` (`nemarOrg/nemar-cli`),
so the schema a client validates against cannot drift from the one the converter itself validates a document against before publishing it.
The schema is **closed**: every object sets `additionalProperties: false`,
so a document carrying a field this page does not name would fail its own producer's validation before publishing.

## Rollout: check `format_version` before assuming this shape

Index format `format_version 3` — everything on this page — is reached by a dataset only when it *reconverts* under converter engine version 3 (Architecture Decision Record (ADR) 0033);
an unchanged dataset does not pick it up on its own.
At any given time some datasets have already reconverted and others still publish an older `format_version 1` document
(no `pending`, no `layout`, no `discovered_count`, a per-store `source_key` instead of the separate manifest below).
**Read `format_version` first**, and branch on it, rather than assuming every dataset's index looks like this page.

## Top-level fields

| Field | Meaning |
| --- | --- |
| `format` | Always the literal `"nemar-zarr-index"`. |
| `format_version` | Always `3` on this page's shape (see rollout note above). |
| `dataset_id` | The NEMAR dataset id (`nm`/`xx`/`on` band). |
| `contract_base` | **The only URL a client may hardcode**: the stable base for this dataset's serving copy, `https://zarr.nemar.org/<id>/zarr/`. |
| `data_base` | Where the bytes are served from *today*, for an HTTP Zarr reader. May change independently of `contract_base` — re-read it from this document rather than hardcoding it. |
| `data_base_kind` | What kind of thing `data_base` points at; currently always `"s3-public"`. |
| `s3_uri` | The same location as an `s3://` triple (`s3://nemar/<id>/zarr/`), for `boto3` / `s3fs` / `zarr`, which want bucket-plus-key rather than a URL to parse back apart. |
| `s3_region` | The bucket's AWS region (`us-east-2` today). |
| `s3_anonymous` | `true` when `s3_uri` is readable with unsigned requests. Always `true` for a public dataset's index — private datasets are never served at all (see [Access and hosting](/platform/zarr/access/)). |
| `source_commit` | The dataset repository commit this copy was built from — always a full 40-character hex Git SHA; the producer refuses to publish an index without one. |
| `engine_version` | The discovery/dispatch generation that produced this index (changes only when discovery widens; ADR 0033). |
| `biosigio_version` | The biosigIO release that wrote the stores, or `null` when it could not be determined. |
| `updated_utc` | When this run wrote the index (UTC). |
| `discovered_count` | Raw recordings found at `source_commit`, after the ADR 0027 exclusions. The denominator of coverage — see the invariant below. |
| `store_count` | Recordings with a served store. Authoritative; prefer it to `stores.length`. |
| `n_recordings` | Alias of `store_count`. Not the discovered total — that is `discovered_count`. |
| `errors` | Recordings that failed in *this run*, typed and untyped alike — a run statistic, not a coverage total. |
| `failure_count` | `failures.length` — recordings that will not convert without a change to the data or the converter. |
| `pending_count` | `pending.length` — recordings with no store yet that are still expected to convert on a later run. |
| `stores` / `failures` / `pending` | The three arrays; see below. |
| `doi`, `license`, `citation`, `hed_version` | Dataset-level facts hoisted from the same catalog row the store's own `nemar` attribute carries (see [Store contract](/platform/zarr/store-contract/)), each `null` when the catalog does not have a value. |
| `layout` | `const` path templates so a recipe is computable from this document plus one array-metadata fetch — see below. |

### The `discovered_count` invariant

```
discovered_count == store_count + failure_count + pending_count
```

Before this invariant existed, a recording that failed for an untyped, transient reason could land in neither `stores` nor `failures` and simply vanish —
indistinguishable from "still generating" forever.
Format version 3 accounts for every discovered recording in exactly one of the three arrays,
so a client (or a dashboard) can compute real coverage — `store_count / discovered_count` —
and trust that the remainder is either a named failure or a recording still in flight.

### `layout`

```json
"layout": {
  "level0": "<zarr>/<group>/0",
  "view": "<zarr>/<group>/view/<L>",
  "view_levels": "1..n_view_levels from the group attrs",
  "scale_offset": "level-0 array attrs scale[] and offset[]; physical = digital * scale + offset"
}
```

Paths are relative to `contract_base`;
`<zarr>` is a store's `zarr` field, `<group>` a `groups[].name`, `<L>` a view level.
The templates are declared `const` in the schema — a client may hardcode them once it has checked `format_version`,
and changing the layout is therefore a schema change (a new `format_version`), never a silent one.
This is what makes a read recipe computable from `index.json` plus one array-metadata fetch, with no probing,
which is the shape [ADR 0025](https://github.com/nemarOrg/nemar-cli/blob/main/.context/decisions/0025-inference-compute-runs-on-device-mcp-is-a-stateless-broker.md) commits any future agent-facing tooling to;
see the [cost ladder page](/platform/zarr/cost-ladder/) for a worked recipe.

## Store entries

```json
{
  "path": "sub-01/eeg/sub-01_task-rest_eeg.set",
  "zarr": "sub-01/eeg/sub-01_task-rest_eeg.zarr",
  "source_tree": "raw",
  "derived": false,
  "updated_utc": "2026-08-30T04:12:09Z",
  "modalities": ["eeg"],
  "groups": [
    {
      "name": "eeg_250hz",
      "modality": "EEG",
      "rate": 250.0,
      "n_channels": 129,
      "n_samples": 43034,
      "duration_s": 172.136,
      "source_rate_hz": 1000.0,
      "n_view_levels": 4,
      "view_chunk_columns": 1024,
      "chunk_samples": 1000,
      "shard_samples": 75000
    }
  ],
  "power_line_frequency": 60.0,
  "event_description_count": 4,
  "n_events": 120,
  "trial_types": { "rest": 60, "video": 60 },
  "units_report": {
    "converted": 129,
    "relabelled": 0,
    "kept_importer_unit": 0,
    "units_column_present": true,
    "sidecar": "sub-01/eeg/sub-01_task-rest_channels.tsv",
    "sidecar_supplied": false
  }
}
```

- `path` is the recording's Brain Imaging Data Structure (BIDS)-relative source path;
  `zarr` is the store's path relative to `contract_base` — the fetchable store URL is `<contract_base><zarr>/`.
- `source_tree` is always `"raw"` (ADR 0027);
  `derived` is `true` only for a processed store (today, only Signal-Space Separation-corrected magnetoencephalography (MEG) —
  see [Store contract](/platform/zarr/store-contract/#derived-source_tree-and-sss)),
  which then also carries an `sss` object with the same shape as the store's own root attribute.
- `groups` mirrors the channel groups inside the store, including the geometry fields needed for the `layout` recipe,
  so a client can decide which recording to open and at what rate without fetching the store's own metadata first.
  A store split by BIDS across multiple source files (a chained magnetoencephalography acquisition) collapses to one entry keyed at the first file,
  with an additional `split_members` array.
- `power_line_frequency`, `event_description_count`, `n_events`, and `trial_types` are present only when the source BIDS metadata declares them;
  absence means the store does not carry that information, not that it was suppressed.
- `units_report` is present only when a `channels.tsv` applied to the recording;
  it never means "applied cleanly" by itself — read `channels_tsv_read_error` alongside it.

## Failure entries

A recording that could not be converted, for a reason that will not change without a change to the data or the converter, has no store;
it is listed in `failures` instead:

```json
{
  "path": "sub-04/eeg/sub-04_task-rest_epo_eeg.set",
  "zarr": "sub-04/eeg/sub-04_task-rest_epo_eeg.zarr",
  "code": "not_continuous",
  "reason": "This file is a trial-averaged or epoched derivative, not a continuous recording, so the time-series viewer is not available.",
  "detail": null,
  "attempts": 0
}
```

`reason` is written to be shown to an end user directly.
`detail`, when present, is an operator-facing cause (the exception class plus the first line of its message, with local filesystem paths stripped).
The stable codes in use:

| Code | Meaning |
| --- | --- |
| `not_continuous` | The file is an epoched or trial-averaged derivative, not a continuous recording. |
| `corrupt_or_truncated` | The recording's data file appears truncated or corrupt. |
| `unsupported_format` | The source file format is not yet supported by the converter. |
| `empty_recording` | The recording has no signal channels to display. |
| `file_read_error` | A generic failure preparing the recording; no more specific code applies. |
| `recording_too_large` | The recording needs more memory than the conversion node can provide at all — a permanent property of the recording. |
| `channel_count_mismatch` | The converted store would carry fewer channels than the recording's BIDS `channels.tsv` declares, so it was withheld rather than served as a silently unfaithful copy. |
| `maxshield_uncalibrated` | The recording was acquired with internal active shielding, and the site calibration files needed to correct it are not provided for it (ADR 0028). |
| `retry_exhausted` | The recording failed for a retryable reason on five separate runs and is no longer retried automatically; `detail` carries the last attempt's error. |

**`recording_memory_exceeded` is not a `failures[]` code.**
A recording that runs out of memory *while converting* — as opposed to `recording_too_large`, a static preflight verdict —
is a condition on a shared node at that moment, not a permanent property of the recording,
so it is recorded in `pending` (see below) with `reason: "memory_budget"` and retried automatically.
It only reaches `failures` — as `retry_exhausted` — after five such attempts.

## Pending entries

A discovered recording with no store yet, but still expected to convert, is recorded rather than omitted,
so every raw recording is accounted for (see the `discovered_count` invariant above):

```json
{
  "path": "sub-05/eeg/sub-05_task-rest_eeg.set",
  "zarr": "sub-05/eeg/sub-05_task-rest_eeg.zarr",
  "reason": "memory_budget",
  "attempts": 2,
  "last_error": "RLIMIT_DATA exceeded during conversion",
  "last_attempt_utc": "2026-08-30T04:12:09Z"
}
```

`reason` is one of:

| Reason | Meaning |
| --- | --- |
| `infra_failure` | An untyped error — a crashed worker, a transient S3 failure. |
| `memory_budget` | The recording did not fit the memory free on the node at the time — a condition, not a property of the recording. |
| `not_attempted` | This run did not reach the recording at all. |

`attempts` counts conversion attempts so far;
at 5 the producer promotes the entry to a `failures[]` entry with code `retry_exhausted`,
so a permanently failing recording stops consuming the queue.

## The manifest file

A second, producer-internal document sits alongside the index:

```
https://zarr.nemar.org/<dataset_id>/zarr/manifest.json
```

schema published at `GET https://api.nemar.org/schemas/zarr-manifest-v1.json`.
It carries each store's git-annex `source_key` and `size_bytes` — the join key back to the recording's exact uploaded content —
which used to live inline in `index.json` until format v3:
on one large dataset the per-store `source_key` field alone was 18 percent of a 12.8 MB index that no consumer actually read,
and `index.json` is fetched on every dataset-page visit.
**Nothing on `nemar.org` reads this file**, and it carries no serving contract of its own;
it may change shape more freely than the index.
See [Access and hosting](/platform/zarr/access/#caching-and-freshness) for why `manifest.json` is *not* cached or redirect-gated the same way `index.json` is —
it follows the general object rules, not the index's special case.

## `events.parquet`

:::note[In progress]
`events.parquet`, and the `sample_index` guarantee it makes for training-time streaming, are shipping in a following converter release.
This section will be filled in once that lands;
see [nemarOrg/nemar-cli#1060](https://github.com/nemarOrg/nemar-cli/issues/1060).
:::

## `zarr-catalog.json`: the discovery front door

A client with no dataset id to start from — human or agent, and without `s3:ListBucket` — has no way to enumerate datasets from the per-dataset index alone.
`zarr-catalog.json`, published at the bucket root and reachable through the same gateway as every other object:

```
GET https://zarr.nemar.org/catalog.json
```

lists every **public, active, converted** dataset (`zarr_status = 'ready'` and at least one store) with its identity and metadata facts,
and the absolute `index_url` a client needs to go straight to that dataset's index:

```json
{
  "format": "nemar-zarr-catalog",
  "format_version": 1,
  "generated_utc": "2026-09-01T06:00:00Z",
  "contract_base": "https://zarr.nemar.org/",
  "count": 342,
  "datasets": [
    {
      "dataset_id": "nm000103",
      "name": "Healthy Brain Network EEG",
      "doi": "10.82901/nemar.nm000103",
      "license": "CC0",
      "modalities": ["eeg"],
      "tasks": ["rest", "video"],
      "subject_count": 126,
      "has_hed": 1,
      "hed_version": "8.3.0",
      "store_count": 252,
      "recording_count": 252,
      "recordings_unavailable": 0,
      "total_recording_duration": 452340.5,
      "zarr_converted_at": "2026-08-30T04:12:09Z",
      "zarr_source_commit": "d14ae5eb3881e368ee328bc1312d3fa51f7e70a9",
      "zarr_errors": 0,
      "zarr_verify_status": "verified",
      "zarr_verified_at": "2026-08-31T02:00:11Z",
      "index_url": "https://zarr.nemar.org/nm000103/zarr/index.json"
    }
  ]
}
```

`zarr_verify_status` (`"verified"` / `"failed"` / `"unverifiable"`, or `null` if the standing fidelity sweep has not reached this dataset yet) is a **stricter** signal than presence in this catalog:
it means the sweep re-derived ground truth from the dataset's own `channels.tsv` and modality sidecar and confirmed the published store agrees, not merely that a store exists.
Published once daily plus on demand, not per-conversion, so treat `generated_utc` as approximate rather than live.

## `has_zarr` and `has_zarr_verified` on the API

`GET /datasets` on the backend API accepts two independent boolean filters,
both `1`/`true` to enable (any other value is ignored, same as the parameter being absent):

- `has_zarr=1` — the dataset has a ready Zarr copy with at least one store.
  This meaning is stable and does not narrow over time.
- `has_zarr_verified=1` — `has_zarr` **and** the standing fidelity sweep's stamped verdict is `"verified"`.
  A strict narrowing of `has_zarr`, not a replacement for it:
  a freshly converted dataset is `has_zarr=true` with `zarr_verify_status` still `null` until the daily sweep reaches it,
  and the viewer keeps reading `index.json` regardless of verification status.
