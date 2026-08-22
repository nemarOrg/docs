---
title: "Zarr Serving Copy"
description: "The derived, latest-only Zarr copy of BIDS raw recordings served from zarr.nemar.org, and the contract a client can rely on."
---

Every published NEMAR dataset gets a derived **serving copy** of its raw recordings in
[Zarr](https://zarr.dev/) v3, served from `zarr.nemar.org`. It exists so a browser can scrub through
a multi-gigabyte recording without downloading it, and so batch readers can stream signal without
unpacking the archive.

This page documents the contract as it stands today. It is written for people building against the
surface. It is not a product commitment.

## What this copy is, and is not

- **Derived.** It is generated from the archived dataset. The archive is the source of truth; this
  copy is regenerated from it and can be regenerated again at any time.
- **Latest only.** It tracks the `main` branch HEAD of the dataset repository. It is **not
  versioned**, and there is no way to request the serving copy for an older release. If you need a
  specific version, take it from the archive.
- **Raw recordings only.** Files under `derivatives/`, `sourcedata/`, and `code/` are deliberately
  excluded, as are BIDS calibration files. Only recordings BIDS treats as raw data are converted.
- **Lossy by default.** Signals are quantized to `int16` (see below). Sample rates are capped per
  modality. Envelope pyramids are rendering artifacts, not signal.
- **Not citable.** This copy carries no DOI and is not a substitute for the archived dataset or its
  DOI. Cite the dataset, not this.

If any of those properties matter to your work, use the archive.

## Finding a dataset's index

Each dataset publishes one index describing every store it has:

```
https://zarr.nemar.org/<dataset-id>/zarr/index.json
```

The `/zarr/` path segment is required. Omitting it returns `404`:

```
https://zarr.nemar.org/nm000103/zarr/index.json   200
https://zarr.nemar.org/nm000103/index.json        404
```

A dataset with no successfully converted recordings publishes no index at all, so a `404` on the
index means "nothing to serve here," not "no such dataset."

### Index schema

```json
{
  "format": "nemar-zarr-index",
  "format_version": 1,
  "dataset_id": "nm000103",
  "source_commit": "d14ae5eb3881e368ee328bc1312d3fa51f7e70a9",
  "updated_utc": "2026-07-28T02:09:28Z",
  "store_count": 3522,
  "failure_count": 0,
  "stores": [ ... ],
  "failures": [ ... ]
}
```

`source_commit` is the dataset repository commit the copy was built from. `updated_utc` is when the
index was last written; it doubles as a cache key (see [Caching](#caching)).

Each entry in `stores` describes one recording:

```json
{
  "path": "sub-NDARAA075AMK/eeg/sub-NDARAA075AMK_task-DespicableMe_eeg.set",
  "zarr": "sub-NDARAA075AMK/eeg/sub-NDARAA075AMK_task-DespicableMe_eeg.zarr",
  "source_key": "MD5E-s45223736--ef7268ad9495969bb57a7aae56f84368.set",
  "updated_utc": "2026-07-28T02:09:28Z",
  "modalities": ["eeg"],
  "groups": [
    {
      "name": "eeg_250hz",
      "modality": "EEG",
      "rate": 250.0,
      "n_channels": 129,
      "n_samples": 43034,
      "duration_s": 172.136
    }
  ],
  "power_line_frequency": 60.0,
  "event_description_count": 4
}
```

`path` is the recording in the BIDS tree; `zarr` is the store path relative to
`https://zarr.nemar.org/<dataset-id>/zarr/`. The rule mapping one to the other is: strip the data
extension, append `.zarr`, preserve the BIDS suffix. A directory-format recording follows the same
rule (`..._meg.ds` becomes `..._meg.zarr`).

A recording appears in `stores` or in `failures`, never both.

## Store layout

One Zarr root group per recording:

```
<recording>.zarr/
    zarr.json              root attributes: provenance, modality_rates, recording metadata
    <modality>_<rate>hz/   one group per (modality, native rate)
        0                  (n_channels, n_samples) base signal
        view/1, view/2 ... (2, n_channels, n_samples_L) min/max envelopes
    events/                onset, duration, code arrays, plus a label_map attribute
```

Level `0` is the canonical signal: anti-aliased and resampled to the modality's rate, never
upsampled. It carries `usable_for_inference: true`.

Everything under `view/` is a **min/max envelope pyramid** for rendering. Each level is a
`(2, n_channels, n_samples_L)` array holding per-bucket minima and maxima. These are nonlinear
summaries, not decimated signal, and they are flagged `usable_for_inference: false`. Do not train
on them, and do not treat them as a low-rate version of the recording.

Channels with mixed types, units, or native rates are split into separate groups keyed by
`(modality, native rate)`, so every array within a group stays length-consistent. Trigger and clock
channels are resampled without anti-aliasing, by nearest sample, to preserve step edges.

### Sampling-rate caps

The target rate is `min(native_rate, cap)`; a modality with no cap keeps its native rate.

| Modality | Cap |
|---|---|
| EEG | 250 Hz |
| MEG | 250 Hz |
| iEEG | 1000 Hz |
| EMG | 1000 Hz |

The group name encodes the result, so a 500 Hz EEG recording lands in `eeg_250hz`. The original rate
is preserved in the group's `original_rate` attribute and per channel in `original_rate` /
`target_rate`.

The group is chosen by the recording's **BIDS datatype suffix**, not by per-channel type guessing.
A `*_eeg.set` is EEG even when EOG or trigger channels ride along.

### Dequantizing

Signals are stored `int16` with a **per-channel** scale and offset, recorded in each channel's entry
in the group attributes alongside its `row_index`:

```
physical = digital * scale + offset
```

The store states this itself in the `physical_formula` attribute on the array. Units are per channel
in the `unit` attribute (for example `uV`).

```python
import zarr, numpy as np

g = zarr.open_group(
    "https://zarr.nemar.org/nm000103/zarr/"
    "sub-NDARAA075AMK/eeg/sub-NDARAA075AMK_task-DespicableMe_eeg.zarr/eeg_250hz",
    mode="r",
)
channels = g.attrs["channels"]
digital = g["0"][:]                       # (n_channels, n_samples) int16

physical = np.empty(digital.shape, dtype=np.float32)
for ch in channels:
    i = ch["row_index"]
    physical[i] = digital[i] * ch["scale"] + ch["offset"]
```

Scale and offset are computed per channel over its own range, so applying one channel's constants to
another is wrong by an arbitrary amount. Always key off `row_index`.

A constant or empty channel gets `scale = 1` with the constant in `offset`.

## When a recording has no store

Recordings that could not be converted appear in `failures` with a stable `code` and a
human-readable `reason`. Show the reason; branch on the code.

| Code | Meaning |
|---|---|
| `not_continuous` | A trial-averaged or epoched derivative, not a continuous recording. |
| `corrupt_or_truncated` | The data file appears truncated or corrupt. |
| `unsupported_format` | The format is not yet supported. |
| `empty_recording` | No signal channels to display. |
| `file_read_error` | Generic read failure. Also the fallback for an unrecognized code. |
| `recording_memory_exceeded` | Ran out of memory during conversion. Not a defect in the data; can succeed later. |
| `recording_too_large` | Too large to convert within the conversion node's memory limits. |

The last two describe the conversion, not the data. A recording carrying either may gain a store on a
later run without anything about the dataset changing, so do not cache those verdicts as permanent.

Treat an unrecognized code as `file_read_error`: the list grows.

## Transport

Verified against the live service:

- **Range requests** are supported. Chunk requests return `206` with `Content-Range`, and
  `Accept-Ranges: bytes` is advertised. This is what makes partial chunk reads viable from a browser.
- **Cross-origin** reads work from any origin. `Range` is an allowed request header; `ETag`,
  `Content-Length`, `Content-Range`, and `Accept-Ranges` are exposed. `GET`, `HEAD`, and `OPTIONS`
  are allowed.
- Arrays are **sharded** (`sharding_indexed`), so a client that understands Zarr v3 sharding will
  fetch far fewer, larger objects than the chunk grid alone suggests.

### Caching

Two different policies, which matter if you are building a viewer:

| Resource | `Cache-Control` |
|---|---|
| `index.json` | `public, max-age=60, stale-while-revalidate=300` |
| Chunks and array metadata | `public, max-age=86400, stale-while-revalidate=86400` |

Chunk content is effectively immutable for a given conversion, hence the day-long lifetime. When a
recording is reconverted its chunks are rewritten in place at the same URLs, so a client holding a
cached chunk can pair it with a newer index.

The index is the version signal. Append its `updated_utc` as a query parameter when fetching store
resources:

```
<store>/eeg_250hz/0/zarr.json?v=2026-07-28T02:09:28Z
```

The query string does not change what the server returns; it changes the browser's cache key, so a
reconversion moves every client to the new bytes at once. Read `updated_utc` from the index, use it
for every request belonging to that index, and refetch the index to learn about a new one.

## Reconversion

The serving copy rebuilds when the dataset's `main` branch changes. Editing an `_events.tsv`
rebuilds the recording it belongs to, so annotations stay in step with the signal. Because the copy
tracks HEAD rather than a release, a change to the dataset is reflected here without a new version
being cut.

`source_commit` in the index tells you which commit the current copy reflects.
