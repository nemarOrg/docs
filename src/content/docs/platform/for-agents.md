---
title: "For Agents"
description: "One page to point an autonomous agent, script, or tool integration at: what NEMAR is, which host answers which question, verified request examples, and when to stream instead of download."
---

This page is written for a machine client: an autonomous agent, a script, or any other automated
integration deciding how to find, describe, or fetch NEMAR data programmatically. It links to the
pages that carry the real contracts rather than restating them — where this page and a page it
links to ever disagree, the linked page is right.

## What NEMAR is

NEMAR (Neuroelectromagnetic Data Archive and Tools Resource) is an archive of neurophysiology
datasets in Brain Imaging Data Structure (BIDS) format — electroencephalography (EEG),
magnetoencephalography (MEG), intracranial EEG (iEEG), electromyography (EMG), and behavioral
recordings — each with a citable Digital Object Identifier (DOI). See
[The NEMAR ecosystem](/ecosystem/) for the full map of how the pieces below fit together.

**The data is not on `nemar.org`.** `nemar.org` is the human-readable browser; the bytes, the
metadata, and the streaming copy each live on a different host:

| Host | Answers |
| --- | --- |
| `nemar.org` | The dataset browser — human-readable dataset pages, search, citation info. |
| `api.nemar.org` | Catalog search and per-dataset metadata (the backend API). |
| `data.nemar.org` | The BIDS file tree and the bytes — manifests, individual files, archive zips. |
| `zarr.nemar.org` | A derived, streaming copy of every recording, for reading a slice without downloading the whole file. |
| `docs.nemar.org` | This site. |

## The three questions

Any client of an archive has to answer three questions: how to **query** for a dataset, how to
get its **metadata**, and how to **download** the data itself. Each is answered by a different
part of the platform:

| Question | Answered by |
| --- | --- |
| Query — which datasets match? | `api.nemar.org` search and list endpoints |
| Metadata — what is in this dataset? | `api.nemar.org` detail endpoint, and the dataset page on `nemar.org` |
| Download — give me the data | `data.nemar.org` for files, `zarr.nemar.org` for a slice, or the CLI |

## Query and metadata: `api.nemar.org`

The backend API is documented in full at [Backend API](/platform/api/). The three requests below
cover query and metadata, and were run against production while writing this page.

Search by free text:

```bash
$ curl -s "https://api.nemar.org/datasets/search?q=EEG&limit=3" | jq '.results[] | {id, name, doi}'
{
  "id": "nm000232",
  "name": "THINGS-EEG2: A large and rich EEG dataset for modeling human visual object recognition",
  "doi": "10.82901/nemar.nm000232"
}
```

A filtered list (`modality`, `author`, `task`, and `license` are among the accepted filters):

```bash
$ curl -s "https://api.nemar.org/datasets?modality=eeg&limit=3" | jq '.datasets[] | {dataset_id, name, license}'
{
  "dataset_id": "on007753",
  "name": "BCCWJ-EEG",
  "license": "CC0"
}
```

Per-dataset detail:

```bash
$ curl -s "https://api.nemar.org/datasets/nm000281" | jq '.dataset | {dataset_id, name, latest_version_doi}'
{
  "dataset_id": "nm000281",
  "name": "emg2pose: Surface EMG and Hand Pose",
  "latest_version_doi": "10.82901/nemar.nm000281.v1.0.4"
}
```

Each example above is piped through `jq` for readability, and each returned more than one result;
drop the `limit`/pipe to see the full, unfiltered response.

## Downloading: `data.nemar.org`

Every published dataset is a BIDS tree at:

```
https://data.nemar.org/<datasetId>/<version>/<bids-path>
```

`<version>` is `latest` or an explicit `vX.Y.Z` tag. A `GET` on a file path answers `302 Found`
with a `Location` header pointing at the actual bytes — a presigned S3 URL for git-annex-managed
content, or a version-pinned `raw.githubusercontent.com` URL for small files stored directly in
git. **A client must follow redirects**; the 302 itself carries no file content. A `GET` on a
directory path answers `200` with an HTML index, and `.../manifest.json` lists every file in the
version with its checksum and URL. Full grammar, headers, and the tombstone behavior for removed
files: [Data API](/platform/data-api/).

```bash
$ curl -sI https://data.nemar.org/nm000281/latest/dataset_description.json
HTTP/2 302
location: https://raw.githubusercontent.com/nemarDatasets/nm000281/v1.0.3/dataset_description.json
```

## Downloading: the CLI

For a full local copy, `nemar dataset download <id>` fetches everything: metadata and every
file's content, git-annex-managed. For a subset, `nemar dataset clone <id>` followed by
`nemar dataset get <files>` — **`clone` alone fetches no file content**, only the git-annex
metadata tree (structure and pointers, no bytes). See
[Downloading Data](/cli/guides/downloading/) for BIDS entity filters (`--subjects`, `--tasks`,
`--datatypes`, …), resuming an interrupted download, and pulling only the diff when a dataset
updates.

## Stream or download? The Zarr serving copy

NEMAR serves every recording twice: once as the archived BIDS file (download it whole, from
`data.nemar.org` or the CLI) and once as a derived Zarr copy on `zarr.nemar.org` (stream just the
part you need). Which one to reach for is a question about the *shape* of the read, not its size:

- **Stream** when you need a slice — a handful of channels, a time window, or a subset of
  recordings out of a larger set.
- **Download** when you are going to touch most of the array anyway — training on a whole
  recording, or a pipeline that already expects a BIDS tree on disk.

This is the same framing [DANDI](https://dandiarchive.org) and the
[Pangeo](https://pangeo.io) community use for their own Zarr-backed archives, and it is
deliberately not a size cutoff in gigabytes: a huge recording you only need two channels from is
still a streaming read, and a small recording you're loading in full is still a plain download.

For the worked read recipes — fetch `index.json`, open the store, dequantize, in Python and
JavaScript — and roughly what each layer costs in bytes and requests, see
[Cost Ladder and Recipes for Agents](/platform/zarr/cost-ladder/). For the stable URL, anonymous
S3 access, and the browser-versus-everything-else split (including why `HEAD` is never
redirected), see [Access and Hosting](/platform/zarr/access/).

:::note
Filter on `has_zarr_verified` rather than `has_zarr` when a pipeline needs a fidelity guarantee,
not just a store's existence: `has_zarr` means a store was produced, `has_zarr_verified` means the
standing fidelity sweep re-derived ground truth from the dataset's own BIDS metadata and confirmed
the store agrees. Neither filter is live on `api.nemar.org` yet — see
[Index Contract: `has_zarr` and `has_zarr_verified`](/platform/zarr/index-contract/#has_zarr-and-has_zarr_verified-on-the-api)
for the rollout status.
:::

## Per-dataset entry points

A client that already has a dataset id has entry points beyond the API endpoints above:

- **The dataset page**, `nemar.org/dataset/<id>` — server-rendered, and carries
  [schema.org](https://schema.org/Dataset) `Dataset` JSON-LD plus a "Use this data" section aimed
  at exactly this audience.
- **A markdown mirror** of the same page, at `nemar.org/dataset/<id>.md`.
- **The DOI**, which resolves through DataCite content negotiation.

:::caution
The markdown mirror and the "Use this data" section are part of the same epic as this page but
ship in a later phase, and are **not live yet**. Treat them as planned, not available — do not
link-check against production for either.
:::

The DOI is live today and works the same way any DataCite DOI does: ask for schema.org JSON-LD by
`Accept` header and follow the redirect, for any dataset —

```
https://doi.org/10.82901/nemar.<id>
```

— verified here against a live, published dataset:

```bash
$ curl -sL -H "Accept: application/vnd.schemaorg.ld+json" https://doi.org/10.82901/nemar.nm000103
{
  "@context": "http://schema.org",
  "@type": "Dataset",
  "@id": "https://doi.org/10.82901/nemar.nm000103",
  "name": "Healthy Brain Network EEG - Not for Commercial Use",
  "url": "https://nemar.org/dataset/nm000103",
  "license": "https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode",
  "version": "2.0.0",
  ...
}
```

(Trimmed — the full response also carries `author`, `funder`, and `citation` entries from the
DataCite record.)

## Licenses and terms

`license` in the metadata above is not decorative. Depositors choose their own dataset's license,
and licenses vary — the example just above is `CC BY-NC-SA` (non-commercial), not the permissive
`CC0` default. **Check a dataset's license before using its data for anything beyond nonprofit
research.** That floor is a warranty depositors make, described in the
[Data Contributor Terms](/policies/contributor-terms/#licensing) and the
[Dataset Submission Standards](/policies/submission-standards/). See [Policies](/policies/) for
the rest — privacy, takedown, and the GDPR position.
