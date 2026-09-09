---
title: "For Agents and Tools"
description: "Machine-facing routes and conventions for scripts, research agents, and LLM-assisted workflows."
---

This page is written for a machine client: an autonomous agent, a script, or any other automated
integration deciding how to find, describe, or fetch NEMAR data programmatically. It links to the
pages that carry the real contracts rather than restating them — where this page and a page it
links to ever disagree, the linked page is right.

NEMAR is committed to agentic research: not only the code repositories, but also the webpages,
dataset records, and data access paths should be understandable to software. An agent should be
able to discover a dataset, inspect its context, identify the exact release, and explain what it
used without scraping a visual page as its only source.

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
| `zarr.nemar.org` | A derived, streaming copy where a recording has been converted, for reading a slice without downloading the whole file. |
| `docs.nemar.org` | This site. |

## Use the surface that matches the question

| Question | Preferred surface |
| --- | --- |
| Which datasets match a search? | `https://api.nemar.org/datasets` and its search parameters |
| What is this dataset about? | `https://data.nemar.org/<id>/metadata.json` |
| Which files are in one release? | `https://data.nemar.org/<id>/<version>/manifest.json` |
| Can I read one BIDS path? | `https://data.nemar.org/<id>/<version>/<bids-path>` |
| Can I stream converted chunks? | `https://zarr.nemar.org/<id>/zarr/...` where indexed |
| What does a person see? | `https://nemar.org/dataset/<id>` |
| What is the page in simple text? | `https://nemar.org/dataset/<id>.md` |
| Where are the conventions? | `https://docs.nemar.org/` and `/llms.txt` |

The website emits schema.org Dataset JSON-LD on dataset pages. Prefer explicit JSON metadata and
manifests for data work, and use the Markdown mirror or JSON-LD for page-level context.

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
cover query and metadata. The example outputs were captured from production on 2026-09-09;
ranking and catalog contents change as datasets are added or updated.

Search by free text:

```bash
$ curl -s "https://api.nemar.org/datasets/search?q=EEG&limit=3" | jq '.results[] | {id, name, doi}'
{
  "id": "nm000232",
  "name": "THINGS-EEG2: A large and rich EEG dataset for modeling human visual object recognition",
  "doi": "10.82901/nemar.nm000232"
}
{
  "id": "on004752",
  "name": "Dataset of intracranial EEG, scalp EEG and beamforming sources from epilepsy patients performing a verbal working memory task",
  "doi": "10.82901/nemar.on004752"
}
{
  "id": "on007602",
  "name": "EEG-Speech Brain Decoding Dataset",
  "doi": "10.82901/nemar.on007602"
}
```

A filtered list (`modality`, `author`, `task`, and `license` are among the accepted filters):

```bash
$ curl -s "https://api.nemar.org/datasets?modality=eeg&limit=3" | jq '.datasets[] | {dataset_id, name, license}'
{
  "dataset_id": "on008768",
  "name": "Resting-State EEG in Parkinson's Disease and Healthy Controls",
  "license": "CC0"
}
{
  "dataset_id": "on008711",
  "name": "RSVP with flankers - sentences with semantic and syntactic violations",
  "license": "CC0"
}
{
  "dataset_id": "on008701",
  "name": "MET - Music-Induced Emotion EEG Dataset",
  "license": "CC0"
}
```

Per-dataset detail:

```bash
$ curl -s "https://api.nemar.org/datasets/nm000103" | jq '.dataset | {dataset_id, name, latest_version_doi}'
{
  "dataset_id": "nm000103",
  "name": "Healthy Brain Network EEG - Not for Commercial Use",
  "latest_version_doi": "10.82901/nemar.nm000103.v2.0.0"
}
```

The list examples are piped through `jq` for readability and return multiple datasets;
the detail example returns one dataset wrapper. Drop the `limit`/pipe to see the full,
unfiltered list response.

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
$ curl -s -D - -o /dev/null https://data.nemar.org/nm000281/latest/dataset_description.json
HTTP/2 302
location: https://raw.githubusercontent.com/nemarDatasets/nm000281/v1.0.3/dataset_description.json
```

`HEAD` on the same path does not follow that redirect — it answers `200` directly, with the
file's size and cache metadata and no `Location`, so it never transfers the body. Use it for a
cheap existence-and-size check:

```bash
$ curl -sI https://data.nemar.org/nm000281/latest/dataset_description.json
HTTP/2 200
content-length: 2235
cache-control: public, max-age=300
etag: "git:a3d2bdb99399482ef3a6cb7c4ade533229bdc1d0"
last-modified: Mon, 31 Aug 2026 00:21:32 GMT
```

## Downloading: the CLI

For a full local copy, `nemar dataset download <id>` fetches metadata and every file's content,
git-annex-managed — except content under `stimuli/` and `derivatives/`, which are skipped by
default because they can be very large; pass `--stimuli` and/or `--derivatives` to include them.
For a subset, `nemar dataset clone <id>` followed by
`nemar dataset get <files>` — **`clone` alone fetches no file content**, only the git-annex
metadata tree (structure and pointers, no bytes). See
[Downloading Data](/cli/guides/downloading/) for BIDS entity filters (`--subjects`, `--tasks`,
`--datatypes`, …), resuming an interrupted download, and pulling only the diff when a dataset
updates.

## Stream or download? The Zarr serving copy

Where conversion is available, NEMAR exposes a recording through two access layers: the archived
BIDS file (download it whole, from `data.nemar.org` or the CLI) and a derived Zarr copy on
`zarr.nemar.org` (stream just the part you need). Which one to reach for is a question about the
*shape* of the read, not its size:

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
the store agrees. Both filters are live on `api.nemar.org` today. A pipeline that needs
converted results should filter on `has_zarr`; use `has_zarr_verified` when the stricter
fidelity verdict is required, understanding that its result set can be smaller or temporarily empty
until the standing sweep has run.
:::

## Per-dataset entry points

A client that already has a dataset id has entry points beyond the API endpoints above:

- **The dataset page**, `nemar.org/dataset/<id>` — server-rendered, and carries
  [schema.org](https://schema.org/Dataset) `Dataset` JSON-LD and a "Use this data" section
  with machine-facing links.
- **A markdown mirror** of the same page, at `nemar.org/dataset/<id>.md` — a text-first
  representation of the dataset page's use and access information.
- **The DOI**, which resolves through DataCite content negotiation.

The DOI is live today and works the same way any DataCite DOI does: ask for schema.org JSON-LD by
`Accept` header and follow the redirect, for any dataset with a DOI —

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

`license` in the metadata above is not decorative. Depositors choose their own dataset's license
— NEMAR recommends `CC0` or `CC BY 4.0` for maximum reuse but does not require either — and
licenses vary accordingly: the example just above is `CC BY-NC-SA` (non-commercial), not the
permissive `CC0` this dataset could equally have chosen. **Check a dataset's license before using
its data for anything beyond nonprofit research.** That floor is a warranty depositors make,
described in the [Data Contributor Terms](/policies/contributor-terms/#licensing) and the
[Dataset Submission Standards](/policies/submission-standards/). See [Policies](/policies/) for
the rest — privacy, takedown, and the GDPR position.

## Agent behavior we want

Good research tooling should:

- preserve dataset ID, version, DOI, license, and source URLs in its output;
- read the README and structured metadata before proposing an interpretation;
- distinguish declared facts from computed summaries and model-generated suggestions;
- respect the dataset license and access conditions;
- cite the exact version used;
- expose enough provenance that a person can reproduce or challenge the result;
- report a dataset-specific correction to its dataset repository, and a systematic pipeline issue to
  [`nemar-cli`](https://github.com/nemarOrg/nemar-cli/issues).

LLMs may help summarize or propose metadata, but they do not get final publication authority. The
[AI-assisted curation policy](/policies/ai-use/) describes the current boundaries: these pipelines
work from documentation and structural metadata, controlled vocabularies are validated, and human
review remains authoritative.

## Stable machine-readable entry points

- [`/llms.txt`](https://nemar.org/llms.txt) — a compact map of public machine-facing resources.
- Dataset Markdown mirrors — a text-first representation of a dataset detail page.
- Dataset JSON-LD — schema.org context embedded in the human-facing page.
- `metadata.json` — neuroschema dataset document with catalog enrichment and version information.
- `manifest.json` — the file list for a selected release, including paths, sizes, and checksums
  where available.

These interfaces are designed to be explicit and inspectable. They are not permission to expose
private datasets or to send participant-level recordings to a language model.
