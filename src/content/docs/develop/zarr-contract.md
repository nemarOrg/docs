---
title: "Zarr serving copy: developer reference"
description: "The URL shape, index schema, store layout, and dequantization contract for NEMAR's derived Zarr serving copy of BIDS recordings."
---

NEMAR maintains a derived Zarr v3 copy of every raw recording in a published Brain Imaging Data
Structure (BIDS) dataset, so a browser can scrub a signal without downloading the whole file and
a machine learning (ML) pipeline can stream samples instead of pulling the original recording
first. This page documents that copy as a contract for anyone writing a client against it: the
URL shape, the index and store schemas, how to turn the stored integers back into physical units,
and the caching and cross-origin behavior a client needs to plan around.

This is a reference for *consuming* the Zarr copy. It does not cover how the copy is produced or
operated; that is a separate, access-gated document for NEMAR administrators.

## What this copy is, and is not

- **Derived and reproducible.** The store is generated from the dataset's BIDS recordings; BIDS
  remains the source of truth, and the store can always be rebuilt from it.
- **Latest-only, not versioned.** The copy tracks the dataset repository's `main` branch head.
  There is one Zarr store per recording, not one per released dataset version, and there is no
  history: a re-conversion overwrites the previous store in place. If you need a specific,
  citable version of a dataset, use its archived release and Digital Object Identifier (DOI), not
  this copy.
- **Not citable data.** The Zarr copy is a viewing and streaming convenience, not an archival
  format. It is not a substitute for the dataset's own archived, versioned, DOI-assigned data.
- **Raw recordings only.** Coverage is BIDS raw data (the recordings under each subject/session
  data type folder). Derivatives, source data, and code folders are out of scope and are not
  converted.
- **No stability promise beyond what is written here.** The index and every store carry explicit
  `format` and `format_version` fields for exactly this reason: treat this page as a description
  of the current contract, and check those fields in code that needs to detect a future change
  rather than assuming the shape below is permanent.

## Finding a dataset's stores: the index

Every public dataset with a Zarr copy has a per-dataset index at:

```
https://zarr.nemar.org/<dataset_id>/zarr/index.json
```

A request to `https://zarr.nemar.org/<dataset_id>/index.json`, without the `/zarr/` path
segment, returns 404. The `/zarr/` segment is not optional. A bare `https://zarr.nemar.org/`
returns a small JSON usage hint rather than an error, and `https://zarr.nemar.org/<dataset_id>/`
alone (no further path) also 404s: there is no directory listing, only the index and the
individual store paths below.

The index is a flat JSON document:

```json
{
  "dataset_id": "nm000103",
  "format": "nemar-zarr-index",
  "format_version": 1,
  "source_commit": "d14ae5eb3881e368ee328bc1312d3fa51f7e70a9",
  "updated_utc": "2026-07-28T02:09:28Z",
  "store_count": 3522,
  "stores": [ /* ... */ ],
  "failure_count": 0,
  "failures": [ /* ... */ ]
}
```

`source_commit` is the dataset repository commit the index reflects, and `updated_utc` is when
this index was last rebuilt. Both change on every re-conversion; neither is meaningful as a
version identifier for the dataset itself.

### Store entries

Each entry in `stores` describes one converted recording:

```json
{
  "path": "sub-01/eeg/sub-01_task-rest_eeg.set",
  "zarr": "sub-01/eeg/sub-01_task-rest_eeg.zarr",
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

- `path` is the recording's BIDS-relative source path; `zarr` is the store's path relative to
  the same dataset's `zarr/` prefix, so the fetchable store URL is
  `https://zarr.nemar.org/<dataset_id>/zarr/<zarr>/`. The rule mapping one to the other is
  mechanical: the source file extension is stripped and `.zarr` is appended, keeping the BIDS
  suffix (`_eeg`, `_meg`, `_ieeg`, `_emg`) intact.
- `source_key` identifies the exact git-annex content the store was built from, useful for
  correlating a store with a specific uploaded file.
- `modalities` is a lowercased summary of every channel group's modality in this store; most
  recordings carry exactly one.
- `groups` mirrors the channel groups inside the store itself (see below), so a client can decide
  which recording to open, and at what rate, without fetching the store's own metadata first.
- `power_line_frequency` and `event_description_count` are present only when the source BIDS
  metadata declares them; absence means the store does not carry that information, not that it
  was suppressed.
- A recording that BIDS splits across multiple source files (a multi-gigabyte MEG acquisition
  written as a chain of files) collapses to a single store keyed at the first file in the chain;
  its index entry additionally carries a `split_members` list naming every source file that maps
  to it.

### Failure entries

A recording that could not be converted has no store; instead it is listed in `failures`:

```json
{
  "path": "sub-04/eeg/sub-04_task-rest_epo_eeg.set",
  "zarr": "sub-04/eeg/sub-04_task-rest_epo_eeg.zarr",
  "code": "not_continuous",
  "reason": "This file is a trial-averaged or epoched derivative, not a continuous recording, so the time-series viewer is not available."
}
```

`reason` is written to be shown to an end user directly. The codes currently in use:

| Code | Meaning |
| --- | --- |
| `not_continuous` | The file is an epoched or trial-averaged derivative, not a continuous recording. |
| `corrupt_or_truncated` | The recording's data file appears truncated or corrupt. |
| `unsupported_format` | The source file format is not yet supported by the converter. |
| `empty_recording` | The recording has no signal channels to display. |
| `file_read_error` | A generic failure preparing the recording; no more specific code applies. |
| `recording_too_large` | The recording exceeds the conversion node's memory budget. |
| `channel_count_mismatch` | The converted store would carry fewer channels than the recording's BIDS channel metadata declares, so it was withheld rather than served as a silently unfaithful copy. |

Only a deterministic, recording-specific problem is ever surfaced here. A transient conversion
error is retried on the next run instead of being recorded as a failure, so a recording can
briefly appear in neither `stores` nor `failures` while it is queued; `store_count` and
`failure_count` are not guaranteed to add up to the dataset's total recording count at every
instant.

## Store layout

A store is a Zarr v3 hierarchy at `https://zarr.nemar.org/<dataset_id>/zarr/<zarr>/`, where
`<zarr>` is the entry's `zarr` field from the index. Its root group attributes identify the
format and carry dataset-derived context:

```json
{
  "format": "biosigio-zarr",
  "format_version": 2,
  "dtype": "int16",
  "modality_rates": { "EEG": 250, "MEG": 250, "IEEG": 1000, "EMG": 1000 },
  "channel_groups": ["eeg_250hz"],
  "power_line_frequency": 60.0,
  "note": "Derived serving copy. level 0 of each group is the anti-aliased inference signal; view/* are min/max render envelopes (not for inference). BIDS source remains authoritative."
}
```

This `format`/`format_version` pair is a separate counter from the index's own `format`/
`format_version`; the two travel independently. `channel_groups` names every channel group
present as a child of the store root. When the source BIDS metadata includes electrode
positions, the root also carries `electrode_positions` (a label-to-XYZ-coordinate map),
`electrode_coordinate_system`, and `electrode_coordinate_units`.

### Channel groups and the rate caps

Each name in `channel_groups` is a child group, one per modality present in the recording.
Groups are named `<modality>_<rate>hz`, and the rate is capped per modality rather than left at
whatever the source recording used:

| Modality | Cap |
| --- | --- |
| Electroencephalography (EEG) | 250 Hz |
| Magnetoencephalography (MEG) | 250 Hz |
| Intracranial EEG (iEEG) | 1000 Hz |
| Electromyography (EMG) | 1000 Hz |

A recording sampled above its modality's cap is resampled down to it (`eeg_250hz` for an EEG
recording originally sampled at 1000 Hz, for example). The modality is read from the recording's
BIDS filename suffix (`_eeg`, `_meg`, `_ieeg`, `_emg`), not guessed per channel, so a recording
with a handful of non-neural channels riding along (EOG, reference, trigger) still lands in one
coherent group at its datatype's cap.

A channel group's own attributes describe the recording as a whole and every channel in it:

```json
{
  "modality": "EEG",
  "rate": 250.0,
  "original_rate": 1000.0,
  "n_channels": 66,
  "n_samples": 354500,
  "channels": [
    {
      "label": "Fp1",
      "unit": "uV",
      "original_rate": 1000.0,
      "target_rate": 250.0,
      "anti_aliased": true,
      "usable_for_inference": true,
      "scale": 0.0638,
      "offset": 1195.83,
      "row_index": 0
    }
  ]
}
```

`row_index` is the channel's position along the first axis of the signal array below; `unit` is
the physical unit each dequantized sample is in, taken from the recording's own metadata. EEG
recordings observed so far report `"uV"`; do not assume the same unit holds for every modality
(MEG in particular is natively a Tesla-based unit, not a voltage), and always read `unit` from
the channel itself rather than hardcoding it.

### The signal array

Inside a channel group, array `"0"` is the full-resolution signal: an `int16` array shaped
`[n_channels, n_samples]`, chunked and compressed (Zarr v3's `sharding_indexed` codec bundles many
small chunks into fewer, larger stored objects, so a general Zarr v3 reader is expected rather
than a hand-rolled chunk-key parser). Its attributes carry the per-channel dequantization data:

```json
{
  "level": 0,
  "rate": 250.0,
  "kind": "signal",
  "usable_for_inference": true,
  "scale": [0.0638, 0.0403, "..."],
  "offset": [1195.83, 687.08, "..."],
  "physical_formula": "physical = digital * scale + offset"
}
```

`scale` and `offset` are per channel, in the same order as `row_index` in the group's `channels`
list. **Samples are stored as scaled, offset `int16` integers, not physical values.** Recover the
physical value (in the channel's `unit`) with:

```
physical[channel, sample] = digital[channel, sample] * scale[channel] + offset[channel]
```

A channel group may also contain a `view/` subgroup with one or more downsampled arrays (shape
`[2, n_channels, n_samples / factor]`, `axis0: ["min", "max"]`, `kind: "minmax_envelope"`). These
are min/max render envelopes for fast scrubbing of long recordings in a browser; they are
explicitly marked `usable_for_inference: false` and should never be used as a source for analysis
or ML, only array `"0"` should.

### Events

When the recording's BIDS `_events.tsv` sidecar exists, the store also has an `events` group:
`onset` and `duration` arrays (seconds, one entry per event), a `code` array (an integer per
event indexing into the group's `label_map` attribute), and, when the corresponding BIDS
`events.json` sidecar declares them, a `value_descriptions` attribute mapping each label to a
human-readable description.

## Reading a store: a worked example

The example below uses [zarrita](https://github.com/manzt/zarrita.js), the same Zarr v3 client
NEMAR's own browser viewer uses, run under Bun. It fetches the index, opens a recording's store,
reads a short slice of the signal, and dequantizes it to physical units. It was run against a
live NEMAR store to confirm the shapes and attribute names above are exactly as documented.

```ts
import * as zarr from "zarrita";

const base = "https://zarr.nemar.org/nm000338/zarr";

// 1. Fetch the per-dataset index and pick a store.
const index = await fetch(`${base}/index.json`).then((r) => r.json());
const storeEntry = index.stores.find((s: any) => s.modalities.includes("eeg"));

// 2. Open the store root, then the channel group named in the index entry.
const store = new zarr.FetchStore(`${base}/${storeEntry.zarr}`);
const root = await zarr.open(store, { kind: "group" });
const groupName = storeEntry.groups[0].name; // e.g. "eeg_250hz"
const group = await zarr.open(root.resolve(groupName), { kind: "group" });

// 3. Open the level-0 signal array (full-resolution, anti-aliased; never "view/*").
const signal = await zarr.open(group.resolve("0"), { kind: "array" });

// 4. Read a 2-second slice for the first 4 channels.
const rate = group.attrs.rate as number;
const nSamples = Math.floor(2 * rate);
const region = await zarr.get(signal, [zarr.slice(0, 4), zarr.slice(0, nSamples)]);

// 5. Dequantize to physical units: physical = digital * scale + offset, per channel.
const scale = signal.attrs.scale as number[];
const offset = signal.attrs.offset as number[];
const [nChan, nSamp] = region.shape;
const physical = new Float64Array(region.data.length);
for (let c = 0; c < nChan; c++) {
  for (let t = 0; t < nSamp; t++) {
    physical[c * nSamp + t] = region.data[c * nSamp + t] * scale[c] + offset[c];
  }
}
// physical[c, t] is now in the unit given by group.attrs.channels[c].unit (this
// EEG example reports "uV"; read the unit rather than assuming it).
```

A Python client (`zarr` or `xarray`) can open the same URLs and apply the same formula; the
schema does not depend on the client language.

## Caching and freshness

Two different lifetimes apply, and a client that streams chunks over time should plan for both:

- **Metadata** (`index.json`, and every store's `zarr.json` group-metadata files) is served with
  a short cache lifetime (currently a 60-second max-age, with a 300-second stale-while-revalidate
  window), so a re-conversion is visible to clients within about a minute.
- **Chunk data** (the actual signal bytes) is served with a long cache lifetime (currently a
  24-hour max-age and stale-while-revalidate window), because a given store's chunks do not
  change between conversions; only a re-conversion replaces them, and it replaces them in place.

Because chunk data is cached far longer than the index that describes it, a client that caches
store URLs across a re-conversion can end up pairing a fresh `index.json` with stale, previously
cached chunk bytes. The reliable way to avoid this is to key requests for a store's files off the
index: append the store entry's (or the whole index's) `updated_utc` as a query parameter, for
example `.../eeg_250hz/0/c/0/0?v=2026-07-28T02:09:28Z`. The query string does not change which
object is fetched, but it does change the cache key, so a new `updated_utc` reliably forces a
fresh fetch instead of reusing a cache entry keyed to the previous conversion.

## Cross-origin access and transport

`zarr.nemar.org` is the only host serving these stores to browsers, and it applies Cross-Origin
Resource Sharing (CORS) itself: a request whose `Origin` is `nemar.org`, a `*.nemar.org`
subdomain, or `localhost`/`127.0.0.1` gets its origin reflected back in
`Access-Control-Allow-Origin`; any other origin gets no such header at all, which is what stops a
third-party site from streaming these chunks into its own browser tab. This restriction is
CORS-only and browser-enforced: a non-browser client (a server-side script, a Python data
pipeline) is not subject to it and can fetch these URLs from any origin.

Only datasets that are public are served; a request for a private dataset's index or any of its
stores returns 404, indistinguishable from a path that does not exist.

HTTP range requests are supported end to end (`Range` in, `206 Partial Content` and
`Content-Range` out), which matters in practice because the sharded chunk layout above can bundle
many logical chunks into one stored object. A Zarr v3 reader that supports the sharding codec
uses range requests to read only the bytes it needs out of a shard rather than downloading the
whole thing; `HEAD` requests are also supported, and a CORS preflight (`OPTIONS`) is answered
directly without touching the underlying data.

## What is not covered here

This page describes the currently observed contract for the index, the store layout, and the
serving behavior above; it does not cover how or when conversions are triggered, retried, or
operated, none of which a consumer needs to know to read a store correctly. It also does not
promise that this shape is permanent: use the `format_version` fields to detect a future change
programmatically rather than assuming today's layout indefinitely.
