---
title: "Zarr and edge access: mental model"
description: How NEMAR keeps BIDS authoritative while making selected recordings streamable for interactive analysis.
slug: platform/zarr/mental-model
---

## Why a second representation exists

The BIDS file is the source of truth: it is the versioned file users cite and download through the
public data plane. But a large EEG, MEG, iEEG, or EMG file is awkward to explore in a browser. A
browser should not have to download an entire recording just to draw a short window of signal.

NEMAR can create a derived Zarr v3 store for a recording. Zarr breaks an array into named chunks,
so a reader can request the small pieces needed for a view or computation. The conversion is an
access optimization, not a replacement for BIDS and not a new source of truth.

## The public route

The browser-facing gateway is:

```text
https://zarr.nemar.org/<dataset-id>/zarr/<bids-relative-path>.zarr/
https://zarr.nemar.org/<dataset-id>/zarr/index.json
```

The store path mirrors the BIDS recording path. For example:

```text
sub-01/eeg/sub-01_task-rest_eeg.edf
→ sub-01/eeg/sub-01_task-rest_eeg.zarr/
```

The index accounts for converted stores and, in the current index contract, recordings that
failed or are still pending. This matters for scientific honesty: “no viewer yet” should not be
confused with “the recording does not exist.” Conversion coverage can change as the producer and
index contract improve.

## What the edge Worker does

`zarr.nemar.org` is a browser gateway in front of the public serving copy. It handles the parts a
browser needs at the boundary:

- serves Zarr metadata and chunks from the derived store;
- restricts browser CORS to NEMAR origins while keeping the public data contract separate;
- supports range requests used by chunked readers;
- caches immutable or slowly changing objects at the edge;
- keeps the viewer from needing S3 credentials or provider-specific URLs.

The result is a smaller first read and a more responsive interactive path. It does not change the
canonical file, its version DOI, or the license attached to the dataset.

## Choosing the right host

| Host | Think of it as | Use it for |
| --- | --- | --- |
| `nemar.org` | the human shell | discovery, dataset pages, previews, and account workflows |
| `api.nemar.org` | the control plane | catalog, accounts, permissions, and lifecycle APIs |
| `data.nemar.org` | the canonical data plane | metadata, manifests, BIDS paths, and downloads |
| `zarr.nemar.org` | a derived streaming plane | chunked browser reads where conversion is available |
| `docs.nemar.org` | the explanation layer | contracts, examples, policies, and operations |

When a normal download is needed, use the `data.nemar.org` path for the dataset version and BIDS
file. The manifest is an index of files and may contain provider-specific byte URLs; client-facing
NEMAR links should remain on the data host so the gateway can preserve filenames and access policy.

## Limits and roadmap

Not every recording converts successfully, and a derived store can lag the source version. The
index and dataset page should expose that state. If there is no Zarr store, the BIDS source remains
the correct route.

This layer is the foundation for broader in-browser analysis. The next step is to let browser tools
do more than view a trace: read selected chunks, compute a transparent operation, show the method
and inputs, and save a versioned derivative. Larger jobs belong on the planned [Tapis through
OneSciencePlace compute path](/ecosystem/compute/), with provenance and citation carried forward.
