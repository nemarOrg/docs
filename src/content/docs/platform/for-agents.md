---
title: "For Agents and Tools"
description: "Machine-facing routes and conventions for scripts, research agents, and LLM-assisted workflows."
---

This page is written for a machine client: an autonomous agent, a script, or any other automated
integration deciding how to find, describe, or fetch NEMAR data programmatically. It links to the
pages that carry the real contracts rather than restating them — where this page and a page it
links to ever disagree, the linked page is right.

If you are a person deciding *whether* you want any of this, rather than a client already using it,
read [Which surface should I use?](/ecosystem/which-surface/) first. It compares all five NEMAR
surfaces in plain terms, including why the MCP server exists when the CLI already does, and links
back here for the contracts.

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
| `mcp.nemar.org` | A Model Context Protocol server: the same archive as six callable tools, for clients that speak MCP. |
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
| My client speaks MCP — can I skip URL assembly? | `https://mcp.nemar.org/mcp` ([tool calling](#tool-calling-mcpnemarorg)) |

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

If your client speaks MCP, [`read_window`](#read_window-a-recipe-by-default-a-taste-on-request)
will compute one of these reads for you — the array URL, the sample range at the served rate, and
the dequantization rule — so you do not have to derive it from the contract by hand.

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

## Tool calling: `mcp.nemar.org`

`https://mcp.nemar.org/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) (MCP)
server for the archive. If your client speaks MCP, this is the shortest path to NEMAR: six tools
that answer the questions above without you assembling URLs, and every answer carries the
provenance you need to cite what you read.

It is anonymous, like the rest of the data plane. There is no key, no signup, and no session.

**What it is not:** a data pipe. The server never hands you a whole recording. By default
`read_window` returns a **recipe** — the exact array URL, chunk geometry, sample range, and the
dequantization rule — and you fetch the bytes yourself, straight from S3 or through
`zarr.nemar.org`. It will decode a small window inline if you ask (`taste: true`), and it refuses
rather than truncates when you ask for too much. So the server is a broker that tells you where to
read and what the numbers mean; the bytes stay on the fast path.

For the human-facing version of that argument, including why this server is not a wrapper around
the CLI, see
[Why this exists when the CLI already does](/ecosystem/which-surface/#why-this-exists-when-the-cli-already-does).

### Transport

Streamable HTTP, protocol revision `2026-07-28`. The older 2025 revision is served from the same
endpoint, so a client pinned to it still works.

| | |
| --- | --- |
| Endpoint | `POST https://mcp.nemar.org/mcp` |
| Descriptor | `GET https://mcp.nemar.org/` — service name, endpoint, supported revisions |
| Not supported | `GET` and `DELETE` on `/mcp` answer `405`; there is no session to resume |
| `tools/list` | carries a cache hint, `ttlMs: 86400000`, `scope: "public"` — cache the tool list for a day |

Most clients need nothing but the URL. From the official Python SDK:

```python
from mcp import Client

async with Client("https://mcp.nemar.org/mcp") as client:
    tools = await client.list_tools()
    result = await client.call_tool("search_datasets", {"query": "motor imagery", "limit": 2})
    print(result.structured_content["count"])
```

### The six tools, cheapest first

| Tool | Answers | What it reads |
| --- | --- | --- |
| `search_datasets` | which datasets match | the catalog only |
| `describe_dataset` | what this dataset is, plus a citation | one catalog row |
| `list_recordings` | which recordings and channel groups exist | the dataset's Zarr `index.json`, cached |
| `get_events` | the event table, with exact sample indices | `events.parquet` |
| `render_overview` | a PNG overview of a recording | the min/max pyramid, never full resolution |
| `read_window` | how to read a time window (or a small decoded taste) | array metadata, and chunks only for a taste |

`describe_dataset` returns a `cost_hint` naming the next cheapest tool, so a client can walk the
ladder without guessing.

### A real session

Every response below is copied from `mcp.nemar.org`, trimmed for length. Search first:

```json
// search_datasets {"query": "motor imagery", "limit": 2}
{
  "results": [
    {
      "dataset_id": "nm000233",
      "name": "BCI Competition 2020 Track 4 — Upper-limb grasping motor imagery",
      "doi": "10.82901/nemar.nm000233",
      "license": "CC-BY-4.0",
      "modalities": ["eeg"],
      "tasks": ["imagery"],
      "subject_count": 14,
      "has_hed": true,
      "has_zarr": true
    }
  ],
  "count": 153,
  "limit": 2,
  "truncated": false
}
```

Then a recording's events. `sample_index` is computed by the converter against the served rate, so
it is exact rather than derived from `onset_s` by the client:

```json
// get_events {"dataset_id": "nm000329", "recording": "sub-1/ses-0/eeg/...run-0_eeg.zarr", "limit": 2}
{
  "source": "events_parquet",
  "estimated": false,
  "total_count": 72,
  "truncated": true,
  "events": [
    {
      "store_path": "sub-1/ses-0/eeg/sub-1_ses-0_task-imagery_acq-calibration_run-0_eeg.zarr",
      "group_name": "eeg_250hz",
      "onset_s": 4.057,
      "duration_s": 4.5,
      "sample_index": 1014,
      "trial_type": "right_hand",
      "value": "2",
      "subject": "1", "session": "0", "task": "imagery", "run": "0"
    }
  ]
}
```

`source` and `estimated` are the honesty pair. `events_parquet` with `estimated: false` means the
sample indices came from the converter. The fallback, `events_tsv_fallback`, sets
`estimated: true`: it reads the BIDS `events.tsv` and computes the index itself, which is off by a
sub-sample amount wherever the source and served rates are not integer multiples.

### `read_window`: a recipe by default, a taste on request

The default mode reads no signal chunks at all. It tells you where the window is and how to
interpret it:

```json
// read_window {"dataset_id": "nm000329", "recording": "...run-0_eeg.zarr", "start_s": 10, "duration_s": 2}
{
  "mode": "recipe",
  "recipe": {
    "array_path": "https://zarr.nemar.org/nm000329/zarr/.../eeg_250hz/0",
    "s3_uri": "s3://nemar/nm000329/zarr/",
    "s3_region": "us-east-2",
    "s3_anonymous": true,
    "group": "eeg_250hz",
    "chunk_samples": 1000,
    "shard_samples": 75000,
    "n_channels": 63,
    "sample_slice": { "start": 2500, "end": 3000 },
    "scale_offset": "level-0 array attrs scale[] and offset[]; physical = digital * scale + offset",
    "how_to": { "python_zarr": "...", "zarrita": "..." }
  }
}
```

`how_to` carries runnable Python and JavaScript for that exact array. Note `sample_slice`: the
server converted your seconds to samples at the **served** rate, which is the one arithmetic step
most easily got wrong by hand.

Add `taste: true` with an explicit channel list to have the server decode a window for you. Values
come back in the recording's physical units:

```json
// read_window {..., "start_s": 10, "duration_s": 0.2, "channels": [0, 1], "taste": true}
{
  "mode": "taste",
  "sample_rate_hz": 250,
  "channels": [0, 1],
  "values": [[8.00116e-06, 3.0919e-05, 3.29635e-05, "..."], ["..."]],
  "chunks_read": 1,
  "bytes_read": 122207,
  "filled_ranges": [],
  "note": "values are rounded to six significant digits; see recipe for the exact byte-level read"
}
```

Two fields to read carefully:

- **`filled_ranges`** lists every sample span that had no stored chunk and was substituted with the
  channel's baseline. It is always present, even when empty, so you never have to wonder whether a
  build reports gaps. A fill value is indistinguishable from real near-flat signal, which is why
  this is reported rather than left silent.
- **`bytes_read`** is what the server fetched upstream, not what it returned. 122 KB to hand back
  100 numbers is the point: a taste is for looking, and a recipe is for reading.

**A taste over its caps is refused, never quietly truncated.** The caps are 60 s, 64 channels,
3840 channel-seconds, and 65 536 channel-samples, and the refusal names the one you crossed:

```
taste duration_s (61) exceeds the 60 s cap; omit taste for a recipe instead
```

There is a second limit expressed in the store's own channel count rather than yours, because a
stored chunk holds every channel: asking for one channel of a 256-channel recording still decodes
all 256. When that trips, the message says so and suggests a duration that fits.

### The provenance envelope

Every recording-level response carries an `envelope`. This is the point of the server:

```json
{
  "dataset_id": "nm000329",
  "doi": "10.82901/nemar.nm000329",
  "license": "CC-BY-NC-ND-4.0",
  "citation": "Stephanie Brandl, Benjamin Blankertz, Tobias Dahne (2026) Brandl et al. 2020 — Motor Imagery Under Distraction: An Open Access BCI Dataset (v1.0.7). NEMAR. https://doi.org/10.82901/nemar.nm000329",
  "source_commit": "7172d2d492dad63650f80cdb83352a0e9d4420f7",
  "index_etag": "\"e4bd66659a2c937c9ca00ae68a5297ef\"",
  "engine_version": "3",
  "source_tree": "raw",
  "derived": false,
  "lossy": true,
  "dtype": "int16",
  "effective_rate_hz": 250,
  "source_rate_hz": 1000,
  "units_report": { "converted": 63, "units_column_present": true, "sidecar_supplied": true },
  "zarr_verify_status": null
}
```

- **`lossy: true`, always.** Every served array is int16-quantized and rate-capped relative to the
  source recording. `effective_rate_hz` versus `source_rate_hz` above is that cap in the open: this
  recording was recorded at 1000 Hz and is served at 250. There is no lossless streaming path
  today. If your analysis needs the original samples, download the BIDS file.
- **`source_commit`** is the dataset repository commit the conversion was built from, so a result is
  reproducible against an exact state of the data rather than "whatever was there that day".
- **`source_tree: "raw"`** — only raw BIDS recordings are converted. Nothing under `derivatives/`,
  `sourcedata/`, or `code/` is served here.
- **`derived`** is true only for a processed store, and then an `sss` record travels with it saying
  what was applied. This is how Signal-Space Separation MEG appears.
- **`zarr_verify_status`** is `verified`, `failed`, `unverifiable`, or **`null`**, and null is
  normal: a fresh conversion has not been reached by the standing fidelity sweep yet. Verification
  is reported, never a precondition for serving, so treat null as "not yet checked" rather than
  "suspect".
- **`dtype`** is the stored array's type, and it is only filled in when the answering call actually
  read that array's metadata — so it is present on a taste and null on a recipe, where reading the
  metadata is left to you.

### Limits

Anonymous per-IP rate limiting, shared with the rest of the read plane. `tools/list` is cacheable
for a day; the dataset-level answers are cached at the edge. Two documents this server declines to
read inline, handing you the public URL instead: an `events.parquet` over 16 MiB or 100 000 rows,
and an `index.json` over 24 MiB. Both are readable directly, and a handful of the largest datasets
in the archive are in that range.

### Client configuration

Claude Desktop or Claude Code, in `claude_desktop_config.json` or via `claude mcp add`:

```json
{
  "mcpServers": {
    "nemar": {
      "type": "http",
      "url": "https://mcp.nemar.org/mcp"
    }
  }
}
```

Cursor, in `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "nemar": { "url": "https://mcp.nemar.org/mcp" }
  }
}
```

Python, with the official SDK (`pip install "mcp>=2.2"` — earlier majors cannot negotiate the
2026-07-28 revision):

```python
from mcp import Client

async with Client("https://mcp.nemar.org/mcp") as client:
    result = await client.call_tool(
        "list_recordings", {"dataset_id": "nm000329", "limit": 10}
    )
```

The URL must include the `/mcp` path. `GET /` is a descriptor, and a `POST` there answers
`Not Found`.

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
- [`mcp.nemar.org/mcp`](#tool-calling-mcpnemarorg) — the MCP endpoint, with a `tools/list` that
  is cacheable for a day and a `GET /` descriptor naming the supported protocol revisions.
- Dataset Markdown mirrors — a text-first representation of a dataset detail page.
- Dataset JSON-LD — schema.org context embedded in the human-facing page.
- `metadata.json` — neuroschema dataset document with catalog enrichment and version information.
- `manifest.json` — the file list for a selected release, including paths, sizes, and checksums
  where available.

These interfaces are designed to be explicit and inspectable. They are not permission to expose
private datasets or to send participant-level recordings to a language model.

Every NEMAR hostname, the paths each one serves, and where a retired URL now points are listed in
[Hosts and routes](/platform/hosts-and-routes/). Derive a URL from that page rather than probing
for one.
