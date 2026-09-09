---
title: "Store Contract"
description: "The Zarr v3 layout of one NEMAR recording's serving store: groups, attributes, chunk geometry, and the dequantization formula."
---

This page documents one Brain Imaging Data Structure (BIDS) recording's store:
the Zarr version 3 (v3) hierarchy at `<contract_base><zarr>/`,
where `<zarr>` is that recording's `zarr` field in the dataset's [index](/platform/zarr/index-contract/).
The store itself is written by [biosigIO](https://github.com/neuromechanist/biosigio) (`Recording.to_zarr` / `stream_to_zarr`);
NEMAR's converter (`scripts/zarr/generate_zarr.py` in `nemarOrg/nemar-cli`) adds a small set of its own attributes on top, named below.

:::note[Current deployment]
The fields below describe current v3 stores. Checked on 2026-09-09 against a live `nm000103`
store: its root reported `format: "biosigio-zarr"`, `format_version: 2`, and
`biosigio_version: "1.2.7"`; the NEMAR provenance object, pyramid and chunk-geometry attributes,
and `channels_tsv_units` were present. Older latest-only stores can omit optional attributes until
they are reconverted, so inspect the store's own `format_version` and `biosigio_version` before
assuming this full shape. The `sss` attribute remains conditional on the correction being applied.

Two separate biosigIO floors apply to the optional fields on this page, not one:
the declared pyramid and chunk-geometry attributes
(`n_view_levels`, `view_levels`, `chunk_seconds`, `shard_seconds`, `chunk_samples`, `shard_samples`, `source_rate_hz`, `view_chunk_columns`)
need biosigIO ≥1.2.6.
`channels_tsv_units` and `bids_unit` need the higher floor of biosigIO ≥1.2.7:
1.2.6 converts channel units on the in-memory export path only,
and 1.2.7 is what brings the streaming export path to parity with it —
a store converted under 1.2.6 alone can carry correct units for a small recording and importer-only units for a large one, silently.
See the [format stability policy](/platform/zarr/format-stability/) for how a client should read `biosigio_version`.

:::

## Layout

```
<store>.zarr/                   root group (biosigio-zarr, format_version 2)
  attrs: format, format_version, biosigio_version, source_format,
         modality_rates, dtype, view_downsample, view_chunk_columns,
         anti_alias_filter, channel_groups, recording_metadata,
         channels_tsv_units (only when a BIDS channels.tsv was applied),
         created_utc, note
         + NEMAR additions: nemar {...}, sss {...} (only when applied),
           power_line_frequency (only when the BIDS sidecar declares it),
           electrode_positions / electrode_coordinate_system /
           electrode_coordinate_units (only when the recording carries them)

  <modality>_<rate>hz/          one group per (modality, native rate) pair
    attrs: modality, rate, original_rate, n_channels, n_samples, channels[],
           n_view_levels, view_levels[], view_downsample, view_chunk_columns,
           chunk_seconds, shard_seconds
    0                            level-0 signal: (n_channels, n_samples), sharded
      attrs: level=0, rate, source_rate_hz, downsample_factor=1, kind="signal",
             chunk_samples, shard_samples, anti_aliased, usable_for_inference,
             scale[], offset[], physical_formula
    view/                        min/max render pyramid, not sharded
      1, 2, ...                  (2, n_channels, n_time_L); axis0 = [min, max]
        attrs: level, downsample_factor, rate_effective, chunk_columns,
               kind="minmax_envelope", usable_for_inference=false

  events/                        present when the recording has a BIDS events sidecar
    onset (f64), duration (f64), code (i32)
    attrs: label_map {code: description}, n_events
```

This per-store `events/` group is separate from the dataset-wide [`events.parquet`](/platform/zarr/index-contract/#eventsparquet) file:
the group is written directly into each store by biosigIO and holds this one recording's events with a small integer `code` per row (decoded via `label_map`);
`events.parquet` is a NEMAR-side, cross-store file with a computed level-0 `sample_index` per event and no join required to open a store first.
Reading events for one recording, open the store; reading events across many recordings without opening any of them, read `events.parquet`.

The group name encodes the recording's **served** rate, not its acquisition rate:
`eeg_250hz` even when the source was 1000 Hz.
Do not construct a group name from the rate-cap table below;
read it from `group.attrs['channels']`, or from the index entry's `groups[].name`.

## Root group attributes

Every store carries biosigIO's own root attributes (`format`, `format_version`, `dtype`, `modality_rates`, `channel_groups`, and the rest listed above), untouched.
NEMAR's converter adds a structured `nemar` object on top,
so a consumer that opens the store directly — the machine learning streaming path, in particular — does not have to fetch `index.json` separately to learn what it is looking at:

```json
{
  "dataset_id": "nm000103",
  "doi": "10.82901/nemar.nm000103",
  "license": "CC-BY-NC-SA 4.0",
  "citation": "...",
  "source_commit": "d14ae5eb3881e368ee328bc1312d3fa51f7e70a9",
  "source_tree": "raw",
  "derived": false,
  "hed_version": "8.3.0",
  "engine_version": "3",
  "contract_url": "https://zarr.nemar.org/nm000103/zarr/sub-01/eeg/sub-01_task-rest_eeg.zarr/",
  "provenance_fetch_failed": false
}
```

`doi`, `license`, `citation`, and `hed_version` come from the dataset's public catalog row (`GET /datasets/<id>`) at conversion time,
and are `null` when the catalog does not have a value — not when the fetch failed.
`provenance_fetch_failed` is `true` only when the catalog itself could not be read during this conversion run,
so a `null` Digital Object Identifier (DOI) caused by an outage is distinguishable from a dataset that genuinely has none.
`contract_url` is this exact store's own stable address,
so a copy of the store that has been moved or vendored elsewhere can still say where it came from.

### `derived`, `source_tree`, and `sss`

- **`source_tree`** is which Brain Imaging Data Structure (BIDS) tree the *source recording* lives in.
  It is always `"raw"`: discovery is raw-only (Architecture Decision Record (ADR) 0027),
  and a store that predates that rule and sits under `derivatives/`, `sourcedata/`, or `code/` is dropped from the index and store set on the next conversion, not republished with a different value here.
- **`derived`** is whether the *served signal* is processed rather than the source signal quantized and rate-capped.
  This is deliberately a different axis from `source_tree`:
  today the only `derived: true` case is a Signal-Space Separation (SSS) corrected magnetoencephalography (MEG) store.
- **`sss`**, present only when `derived` is `true`, discloses the correction (ADR 0028):

  ```json
  {
    "applied": true,
    "method": "maxwell_filter",
    "calibration": "sub-01_acq-calibration_meg.dat",
    "cross_talk": "sub-01_acq-crosstalk_meg.fif",
    "mne_version": "1.12.0"
  }
  ```

  Some MEG recordings are acquired with internal active shielding (MEGIN's MaxShield), which distorts the signal until it is corrected.
  NEMAR applies `mne.preprocessing.maxwell_filter`, an open-source Signal-Space Separation implementation,
  using the recording's own site-specific fine-calibration and cross-talk files, and serves the result.
  A recording that needs the correction but whose calibration files do not resolve is declined rather than served uncorrected
  (see the `maxshield_uncalibrated` failure code on the [index contract](/platform/zarr/index-contract/) page).
  **Check `sss` before training across datasets**, or corrected and uncorrected MEG mix with nothing to tell them apart.

## Channel groups and the rate caps

Level 0 is resampled to `target = min(native rate, modality cap)`;
the store never upsamples. The caps are:

| Modality | Cap |
| --- | --- |
| Electroencephalography (EEG) | 250 Hz |
| Magnetoencephalography (MEG) | 250 Hz |
| Intracranial EEG (iEEG) | 1000 Hz |
| Electromyography (EMG) | 1000 Hz |
| Other (behavioral, miscellaneous) | native (no cap) |

iEEG here covers stereoelectroencephalography (SEEG), electrocorticography (ECoG), and deep brain stimulation (DBS) recordings alike —
all three share the one 1000 Hz cap.

The caps are a ceiling, not a target — a recording already at or below its modality's cap keeps its native rate.
A 512 Hz iEEG recording, below the 1000 Hz iEEG cap, is served as `ieeg_512hz`, not resampled up to 1000 Hz.

Channels are grouped by (modality, native rate),
so a genuinely mixed-rate recording yields one group per rate rather than being silently resampled together.
The modality itself comes from the recording's BIDS filename suffix (`_eeg`, `_meg`, `_ieeg`, `_emg`), not guessed per channel,
so a handful of non-neural channels riding along (EOG, reference, trigger) still land in one coherent group.

A channel group's attributes describe the recording as a whole and every channel in it:

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
      "channel_type": "EEG",
      "modality": "EEG",
      "unit": "uV",
      "prefilter": "HP:0.1Hz LP:100Hz",
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

`row_index` is the channel's row in the level-0 `(n_channels, n_samples)` array.
`unit` is the physical unit each dequantized sample is in
(EEG recordings observed so far report `"uV"`; MEG is natively a Tesla-based unit, not a voltage) —
always read `unit` from the channel itself rather than hardcoding it per modality.
Two keys appear only when they apply:
`nonfinite_samples` (a count of not-a-number or infinite samples that were zero-filled)
and `bids_unit` (see [`channels_tsv_units` and `bids_unit`](#channels_tsv_units-and-bids_unit) below).

Discrete channels (trigger and clock types: `TRIG`, `SYSCLOCK`, `CTRL`) are resampled by nearest sample with no anti-alias filter,
so step edges survive, and are flagged `usable_for_inference: false`.

## The signal array and dequantization

Array `"0"` inside a channel group is the full-resolution, anti-aliased signal:
an `int16` array shaped `[n_channels, n_samples]`.
Its attributes carry the per-channel dequantization data, in the same channel order as `row_index`:

```json
{
  "level": 0,
  "rate": 250.0,
  "source_rate_hz": 1000.0,
  "downsample_factor": 1,
  "kind": "signal",
  "chunk_samples": 1000,
  "shard_samples": 75000,
  "usable_for_inference": true,
  "scale": [0.0638, 0.0403],
  "offset": [1195.83, 687.08],
  "physical_formula": "physical = digital * scale + offset"
}
```

**Samples are stored as scaled, offset `int16` integers, not physical values.**
Recover the physical value, in the channel's `unit`, with:

```
physical[channel, sample] = digital[channel, sample] * scale[channel] + offset[channel]
```

A group may also contain a `view/` subgroup of downsampled min/max render envelopes
(shape `[2, n_channels, n_time_L]`, `axis0: ["min", "max"]`, `kind: "minmax_envelope"`).
These exist for fast scrubbing of long recordings and are always `usable_for_inference: false`;
only array `"0"` is a valid source for analysis or machine learning.

## Chunk geometry and the declared pyramid

The two tiers are chunked by different rules, because they serve different jobs:

- **Level 0 is chunked on time.** The inner chunk spans `chunk_seconds` (4 s by default) and the shard spans `shard_seconds` (300 s), rounded to a whole number of chunks.
  The array attributes record the resolved lengths in samples as `chunk_samples` and `shard_samples`.
- **`view/*` levels are chunked on a constant column count**, `view_chunk_columns` (1024 by default), capped by that level's own length.
  A viewport needs roughly 1000–2500 columns at whatever level it picks,
  so columns — not seconds — is the right grain for a render request;
  see the [cost ladder](/platform/zarr/cost-ladder/) page for the request-count difference this makes in practice.

Each channel group **declares its pyramid**, since biosigIO 1.2.6,
so a reader learns which `view/*` paths exist without probing for a missing object:

- `n_view_levels` — how many `view/*` arrays actually exist for this group.
- `view_levels` — lists them, always contiguous from 1 (for example `[1, 2, 3]`).
- `view_downsample`, `view_chunk_columns`, `chunk_seconds`, `shard_seconds` — the geometry to expect, so a client knows the store's shape before fetching anything.

The same fields are hoisted into the dataset's `index.json` per group
(`n_view_levels`, `view_chunk_columns`, `chunk_samples`, `shard_samples`, `source_rate_hz`),
so an agent can compute a full read recipe from the index alone;
see [Index contract: `layout`](/platform/zarr/index-contract/#layout) and [ADR 0025](https://github.com/nemarOrg/nemar-cli/blob/main/.context/decisions/0025-inference-compute-runs-on-device-mcp-is-a-stateless-broker.md).

## `channels_tsv_units` and `bids_unit`

When the recording sits in a BIDS layout, the sibling `_channels.tsv` is authoritative for each channel's type and unit,
and adopting a declared unit **converts the samples** into it rather than merely relabeling them
(biosigIO ≥1.2.7 — see the current-deployment note near the top of this page).
Two attributes record what happened:

- **`channels[].bids_unit`**, on a channel whose declared unit was recorded rather than adopted
  (a discrete trigger channel, or a unit not convertible from the importer's own),
  so the BIDS claim survives without being asserted over values that contradict it.
- **`channels_tsv_units`**, on the root group, a per-file summary — absent entirely when no sidecar was applied:

  ```json
  {
    "converted": 129,
    "relabelled": 0,
    "kept_importer_unit": 0,
    "units_column_present": true
  }
  ```

The same summary, plus which sidecar file resolved and whether it was supplied explicitly,
is republished per store in the dataset's `index.json` as `units_report` —
see [Index contract: store entries](/platform/zarr/index-contract/#store-entries).

## Reading a store

A general Zarr v3 reader is expected rather than a hand-rolled chunk-key parser:
level 0 uses the `sharding_indexed` codec to bundle many small chunks into fewer, larger stored objects,
and a client that supports it uses HTTP range requests to read only the bytes it needs out of a shard.
See the [cost ladder page](/platform/zarr/cost-ladder/) for worked examples in Python and JavaScript,
and [Access and hosting](/platform/zarr/access/) for the URL, CORS, and caching rules that apply while reading.

## Format version

The store's `format`/`format_version` pair (currently `"biosigio-zarr"` / `2`) is a **separate counter** from the index document's own `format`/`format_version` —
the two travel independently.
See the [format stability policy](/platform/zarr/format-stability/) for what each promises.
