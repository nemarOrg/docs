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

## Rollout: what is live today versus after the release

:::note[Rollout]
Nothing on this page is live yet, in production or in staging.
It all ships with **nemar-cli release 0.9.12** (epic #1181).
Until then:

- Every dataset's index is `format_version 1` — no `pending`, no `layout`, no `discovered_count`, and a per-store `source_key` inline instead of the separate [manifest file](#the-manifest-file) below.
  Checked directly on 2026-09-02 against production (`nm000103`, `nm000281`) and against the `zarr-test.nemar.org` staging host (the exemplar fleet): every index checked on both is `format_version 1`.
- `GET /schemas/zarr-index-v3.json` 404s, on both `api.nemar.org` and the staging equivalent `api-test.nemar.org` — checked live on 2026-09-02.
- [`GET /catalog.json`](#zarr-catalogjson-the-discovery-front-door) 404s the same way, on both `zarr.nemar.org` and `zarr-test.nemar.org` — checked live on 2026-09-02.
- The [manifest file](#the-manifest-file) does not exist either — `manifest.json` also 404s today, checked the same way.
- Neither [`has_zarr` nor `has_zarr_verified`](#has_zarr-and-has_zarr_verified-on-the-api) exists on the deployed API yet — both are accepted as query parameters today but have no effect, so the request succeeds and simply ignores them rather than erroring.
- [`events.parquet`](#eventsparquet) does not exist anywhere either, and is a step further out than the rest of this page:
  it ships from a still-open pull request (nemarOrg/nemar-cli#1205, head `60aa6f3`) on top of the same epic branch, not yet merged even there.
  Its design is final (three review rounds applied, tests green) and it ships together with everything else on this page,
  but read it as the least-settled fact here.

Once the release ships, format version 3 still reaches a dataset only when that dataset *reconverts* under converter engine version 3 (Architecture Decision Record (ADR) 0033) —
an unchanged dataset does not pick it up on its own, so the two formats will coexist for a while even after release.
**Read `format_version` first**, and branch on it, rather than assuming every dataset's index looks like this page.
:::

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
| `events_parquet` | URL of the dataset's [`events.parquet`](#eventsparquet) file. **Absent** when the dataset has no `events.tsv` anywhere, or this run could not publish one — never assume the file exists just because you expect events. |
| `events_row_count` | Rows in `events_parquet`. Present exactly when `events_parquet` is. **Not the event count** — see [`events.parquet`](#eventsparquet) below for why. |
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
  "scale_offset": "level-0 array attrs scale[] and offset[]; physical = digital * scale + offset",
  "events": "<data_base>events.parquet"
}
```

`level0`, `view`, `view_levels`, and `scale_offset` are relative to `contract_base`;
`<zarr>` is a store's `zarr` field, `<group>` a `groups[].name`, `<L>` a view level.

**`events` is the one exception, and is relative to `data_base` instead.**
It is not really a template to fill in the way the others are — there is one `events.parquet` per dataset, not one per store,
so the authoritative way to get its URL is to read the `events_parquet` field directly, not to construct it.
`layout.events` documents the shape for completeness and is only in `layout` at all, not `required` there, so an index for a dataset with no events still validates.
Because `events_parquet` is `data_base`-relative, it can change independently of `contract_base`, the same as `data_base` itself;
the object is also reachable at the stable `<contract_base>events.parquet` through the same gateway every other object goes through
(`events.parquet` is one of the documents the Worker's caching rules name explicitly — see [Access and hosting](/platform/zarr/access/#caching-and-freshness)),
so a client that wants one hardcodable URL can build it from `contract_base` instead of trusting a copy of `data_base`.

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

:::note[Rollout]
`manifest.json` does not exist yet — checked live on 2026-09-02, it 404s on production and on staging.
It ships with nemar-cli release 0.9.12 (epic #1181); see the [rollout note](#rollout-what-is-live-today-versus-after-the-release) above.
:::

A second, producer-internal document sits alongside the index:

```
https://zarr.nemar.org/<dataset_id>/zarr/manifest.json
```

schema published at `GET https://api.nemar.org/schemas/zarr-manifest-v1.json`.
It carries each store's git-annex `source_key` and `size_bytes` — the join key back to the recording's exact uploaded content —
which used to live inline in `index.json` until format v3.
Measured on 2026-09-02 against `nm000281`'s live index (12,846,915 bytes, 25,253 stores):
stripping the `source_key` field from every store entry saves 2,593,563 bytes — about 20 percent of the document —
for a field no consumer on `nemar.org` reads, while `index.json` is fetched on every dataset-page visit.
See the [cost ladder page](/platform/zarr/cost-ladder/#indexjson) for the exact measurement method.
**Nothing on `nemar.org` reads this file**, and it carries no serving contract of its own;
it may change shape more freely than the index.
Once the [events.parquet](#eventsparquet) feature ships, this same document also gets a `files[]` array —
one entry per dataset-level object the run published beside the index (today, only ever `events.parquet`), each with its `size_bytes` and `row_count` —
so a later run or an operator can confirm the object on S3 is the one this conversion wrote, without downloading it.
See [Access and hosting](/platform/zarr/access/#caching-and-freshness) for how `manifest.json` is cached and redirect-gated —
it shares `index.json`'s cache lifetime (both are rewritten by the same conversion), but redirects to S3 for non-browser clients like any store object, unlike `index.json`.

## `events.parquet`

:::note[Rollout]
Not live anywhere, and one step further out than the rest of this page — see the [rollout note](#rollout-what-is-live-today-versus-after-the-release) above.
Design is final (nemarOrg/nemar-cli#1205, closing [#1060](https://github.com/nemarOrg/nemar-cli/issues/1060)); it ships together with everything else on this page.
:::

A dataset with at least one recording's BIDS `events.tsv` gets one columnar file, dataset-wide, beside `index.json` and `manifest.json`:

```
https://zarr.nemar.org/<dataset_id>/zarr/events.parquet
```

reachable at that stable `<contract_base>events.parquet` URL, or at the `events_parquet` field's own `data_base`-relative URL (see [`layout`](#layout) above).
Its existence is never guessed: `events_parquet` and `events_row_count` are present on the index exactly when the file is, and absent otherwise — a dataset with no `events.tsv` anywhere, and every index published before this feature existed, both look the same: no field, no file.

### Why it exists: the bulk alternative to per-store calls

Every store's own signal array can be opened and its `events` group read individually (see [Store contract](/platform/zarr/store-contract/)),
but that costs one round trip per store to find out where every event lands.
`events.parquet` answers "every event in this dataset, with its exact sample index" in one file,
which is what a training loader planning epochs across thousands of stores — or the recipe-first agent tooling [ADR 0025](https://github.com/nemarOrg/nemar-cli/blob/main/.context/decisions/0025-inference-compute-runs-on-device-mcp-is-a-stateless-broker.md) commits to — actually wants:
a bulk table to filter and join, not thousands of small store-metadata fetches.
See the [cost ladder page](/platform/zarr/cost-ladder/#eventsparquet) for worked Python and duckdb examples.

### Row shape: one row per (event, channel group)

Not one row per event. A store's channel groups are concurrent streams of the same recording at different rates,
so one onset lands on a different sample in each group — a store with two groups contributes two rows per event, not one.
**`events_row_count` is therefore not the event count.** The per-store event count is `stores[].n_events`, from the same parse (see [Store entries](#store-entries)).

Columns, in this order:

| Column | Type | Meaning |
| --- | --- | --- |
| `store_path` | dictionary-encoded string | Joins to `stores[].zarr`. |
| `subject`, `session`, `task`, `run` | dictionary-encoded string | The recording's BIDS entities, so the file can be filtered without a join back to the index. `session` and `run` are null for a dataset that uses neither. |
| `onset_s` | float64 | The event's `onset` column, seconds, as declared. `null` when the cell was absent, blank, `n/a`, or did not parse as a number — the row still publishes, so a client sees an event was declared even when its position is unknown. |
| `duration_s` | float32 | The event's `duration` column, same null rule as `onset_s`. |
| `sample_index` | int64 | The level-0 sample the onset falls on — see the formula below. `null` under the same conditions as `onset_s`, or when the group has no `rate`. |
| `group_name` | dictionary-encoded string | Which channel group this row's `sample_index` is computed against — joins to `stores[].groups[].name`. |
| `trial_type`, `value`, `hed` | dictionary-encoded string | The matching `events.tsv` columns (case-insensitive match; BIDS's `HED` and a lowercase `hed` both land here), `null` for a blank or `n/a` cell. |
| *(remaining `events.tsv` columns)* | dictionary-encoded string | Every other column the file has, under its own name — `x_`-prefixed only on a collision with one of the names above or with another passthrough column. |

Every string column is dictionary-encoded, the file is zstd-compressed, and rows are written store by store (row groups flushed every 65,536 rows) rather than assembled into one in-memory table —
`nm000281`'s ~25,000 stores never become a single frame.

### The `sample_index` formula

```
sample_index = floor(onset_s * rate + 0.5)
```

where `rate` is the channel group's **serving** rate — the same `groups[].rate` (and level-0 array `rate` attr) the index and store already publish, not the recording's native acquisition rate.
Ties round up. The converter is the only party that knows the exact resampling relation
(biosigIO's `resample_poly` is zero-phase, so there is no filter delay to subtract, and the exact up/down ratio is derived from the native and target rates) —
verified against a real 1000 Hz → 250 Hz recording and a synthetic fractional-ratio case in the PR's own test suite.
A client that re-derives this from the acquisition rate, or that assumes an integer decimation ratio, is wrong by a fraction of a sample wherever the ratio is not an integer; reading the published column avoids that.

**Not clamped to the group's length.** An onset past the end of the recording is a property of the data, not a bug to hide,
and a clamped index would be indistinguishable from an event that genuinely lands on the last sample.
Bound-check against `groups[].n_samples` yourself if you need to know whether an index falls inside the array.

**Duplicate onsets keep both rows, in file order.** Two events sharing the same `onset_s` are not deduplicated or reordered against each other;
the tiebreak is the event's original position in `events.tsv`, so the published order is deterministic without being alphabetical or otherwise arbitrary.
Rows are ordered `store_path`, then `onset_s` (ties broken by file order), then `group_name`.

### Carry-forward

An incremental run converts only the recordings that changed. A store this run did **not** reconvert keeps the rows the prior `events.parquet` published for it,
exactly like the index carries an untouched store's entry forward.
**A store this run DID reconvert never inherits prior rows, however few rows it produced this time** — including zero.
An `events.tsv` that was deleted or emptied publishes zero rows for that store, not its old ones;
the distinction is "was this store touched this run", not "did this run's parse produce anything".
A `--clean` run reconverts every store, so nothing is ever carried on one.

### Best-effort, like `manifest.json`

Written only when [pyarrow](https://arrow.apache.org/docs/python/) is installed (`pyarrow>=15.0` in `scripts/zarr/requirements.txt`) — its absence is a warning, not a failure:
the run still succeeds, and the index simply advertises no events file, the same as a dataset with none.
A build or upload failure after that point leaves the **previous** `events.parquet` in place on S3, unreferenced by the new index until a later run republishes it, and never fails an otherwise-good conversion (Architecture Decision Record (ADR) 0005).
`events.parquet` is uploaded **before** `index.json`, so a published `events_parquet` field never names a file that is not there yet.

Two fields on the (otherwise undocumented, producer-facing) zarr-ready callback report what happened:

- `events_upload_failed` (boolean) — set when the build or upload raised, so an operator watching the callback stream sees a replaced-but-unreferenced file even though the index refused to point at it.
- `events_stores_without_rows` (integer) — how many reconverted stores contributed no usable rows:
  no channel group to attach an onset to, or every published `sample_index` in the store came back null (unparseable onsets, or a group with no rate).
  Reported by the converter on the callback, and logged by the backend API — appended to its `[zarr-ready]` summary line, plus its own `console.warn` naming the count whenever it is non-zero —
  but not persisted anywhere, the same call already made for `events_row_count` and `events_upload_failed` under the `datasets` table's enforced column budget (ADR 0034).

### In the manifest, too

`manifest.json`'s `files[]` array (see [The manifest file](#the-manifest-file)) gets one entry for `events.parquet` with its `size_bytes` and `row_count` (matching `events_row_count` exactly) —
producer bookkeeping so a later run, or an operator, can confirm the object on S3 is the one this conversion wrote without downloading it.

## `zarr-catalog.json`: the discovery front door

:::note[Rollout]
`GET /catalog.json` 404s today — checked live on 2026-09-02, on production and on staging.
It ships with nemar-cli release 0.9.12 (epic #1181); see the [rollout note](#rollout-what-is-live-today-versus-after-the-release) above.
:::

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

:::note[Rollout]
Neither filter exists on `api.nemar.org` today — not just `has_zarr_verified`.
Checked against the deployed API source on 2026-09-02: `has_zarr` query-parameter handling is absent too, so both are silently ignored, not rejected, until nemar-cli release 0.9.12 (epic #1181) ships.
See the [rollout note](#rollout-what-is-live-today-versus-after-the-release) above.
:::

`GET /datasets` on the backend API accepts two independent boolean filters,
both `1`/`true` to enable (any other value is ignored, same as the parameter being absent):

- `has_zarr=1` — the dataset has a ready Zarr copy with at least one store.
  This meaning is stable and does not narrow over time.
- `has_zarr_verified=1` — `has_zarr` **and** the standing fidelity sweep's stamped verdict is `"verified"`.
  A strict narrowing of `has_zarr`, not a replacement for it:
  a freshly converted dataset is `has_zarr=true` with `zarr_verify_status` still `null` until the daily sweep reaches it,
  and the viewer keeps reading `index.json` regardless of verification status.
