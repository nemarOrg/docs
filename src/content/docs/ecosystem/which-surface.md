---
title: Which surface should I use?
description: NEMAR answers on five surfaces - the website, the CLI, the backend API, the Zarr serving copy, and the MCP server. What each one is for, and why not one of the others.
---

NEMAR is one archive behind five surfaces.
They share a backend, the same accounts, and the same datasets,
so more than one of them can usually do the job you have in mind.
That overlap is deliberate, and it is also why this page exists:
the useful question is not "what can this surface do" but
"which one should I reach for, and why not one of the others".

| Surface | What it is | Who is holding it |
| --- | --- | --- |
| [The website](#the-website-nemarorg) | Browse, search, read a dataset page, upload in a browser, manage your account | A person, in a browser |
| [The CLI](#the-cli-nemar) | Validate, upload, version, publish, download, script | A person doing dataset work, or a CI job |
| [The backend API](#the-backend-api-apinemarorg) | The dataset lifecycle as HTTP endpoints | Your own program, in your own language |
| [The Zarr serving copy](#the-zarr-serving-copy-zarrnemarorg) | Read a slice of a recording without downloading it | An analysis, a notebook, a training loader |
| [The MCP server](#the-mcp-server-mcpnemarorg) | The archive as six callable tools | A language model, through an MCP client |

## Start from the task

| I want to | Use | Rather than |
| --- | --- | --- |
| Find datasets on a topic, read a README, get a citation | The website, [`/discover`](https://nemar.org/discover) | The API, unless you are writing code that has to repeat the search |
| Upload one dataset, without installing anything | The website | The CLI, which is an install plus system dependencies |
| Upload a very large dataset, or one already on a compute node | The CLI | The browser, which uploads from the machine the browser runs on |
| Cut a versioned release when a tag is pushed | The CLI, in CI | The website, which has no unattended mode |
| Download a whole dataset, or a filtered subset of it | The CLI | The Zarr copy, which is lossy and serves only converted recordings |
| Fetch one known file with `curl` | The [data plane](#a-note-on-the-data-plane-datanemarorg) | The CLI, which is a large dependency for one `GET` |
| Build your own client, dashboard, or integration | The backend API | Scraping the website |
| Read a few channels, or one time window, out of a big recording | The Zarr serving copy | Downloading the whole file to throw most of it away |
| Let an AI assistant answer questions about the archive | The MCP server | Asking the model to drive the CLI or guess URLs |
| Have a model fetch a whole recording for analysis | The CLI or the data plane | The MCP server, which is not a data pipe |

## The website: `nemar.org`

The website is the surface for a person who wants to *look* at the archive.
Search and facet filters live at [`/discover`](https://nemar.org/discover),
each dataset has a landing page at `nemar.org/dataset/<id>` that is also
the canonical target its Digital Object Identifier (DOI) resolves to,
and `?v=v1.0.0` selects a particular version.

It is also a complete account and upload surface, not just a catalog.
Sign-in, browser upload, collaborator management, and the publication-request queue live on the
signed-in half of the same site, at `app.nemar.org`
(the split between the two hostnames is about the session cookie, not about features;
see [Hosts and routes](/platform/hosts-and-routes/)).

**Reach for it when** you are exploring, reading, citing,
doing a one-off upload, or changing something about your account.

**Reach for something else when** the work has to repeat.
Nothing on the website runs unattended, and a browser upload transfers
from the machine the browser is running on,
which is the wrong machine when the data is already on a cluster.

Start at [Getting started on the web](/web/getting-started/).

## The CLI: `nemar`

The CLI is the tool for a human who is *doing dataset work* rather than looking at it.
It wraps validation, git-annex plus S3 data handling, GitHub metadata versioning, and DOI workflows
behind one `nemar` command, and it is the only surface that covers the whole lifecycle
in a form you can put in a script.

**Reach for it when** the work is bulk, scripted, reproducible, or remote:
a publish that runs in CI when a tag is pushed,
a very large upload that benefits from git-annex parallel transfers,
a download onto a compute node, or anything you will want to run the same way twice.

**Reach for something else when** you want one file
(the data plane answers that with a single `GET`),
or when you only want part of one recording
(that is what the Zarr copy is for),
or when you are a program rather than a person
(call the API directly instead of shelling out to a CLI).

It is a real install: Bun, plus DataLad, git-annex, and Deno for dataset operations.
See [Installation](/cli/getting-started/installation/), and
[CLI vs the web](/ecosystem/cli-vs-web/) for the two-surface comparison in more depth.

## The backend API: `api.nemar.org`

The backend API is the same lifecycle the CLI drives, exposed directly:
authentication, datasets, sandbox, publication, DOIs, and admin.
Requests authenticate with a bearer API key or the web session cookie,
and the API publishes an OpenAPI 3.1 document at `api.nemar.org/openapi.json`,
generated from the same schemas the server validates against,
so a generated client cannot drift from what the server accepts.

**Reach for it when** you are writing your own program in your own language,
or building something the CLI and the website do not do:
an internal dashboard, a lab submission tool, a catalog mirror.

**Reach for something else when** the CLI already does what you need.
The CLI is not a thin wrapper; it handles the git-annex and S3 mechanics of a real upload,
so reimplementing an upload against raw endpoints is more work than it looks.

See [Backend API](/platform/api/).

### A note on the data plane: `data.nemar.org`

Metadata and bytes are separate hosts.
The API answers "which datasets, and what is in this one";
the files themselves are served anonymously from `data.nemar.org`
as a BIDS tree at `data.nemar.org/<id>/<version>/<bids-path>`,
along with per-version manifests and archive zips.
No account and no install, so it is the cheapest way to fetch one known file.
A `GET` on a file path answers `302` and your client must follow the redirect.
See [Data API](/platform/data-api/).

## The Zarr serving copy: `zarr.nemar.org`

Where conversion is available, a recording exists twice:
as the archived BIDS file you download whole,
and as a derived, chunked Zarr copy you can read a piece of.
This is the analysis path.

Which one to reach for is a question about the *shape* of the read, not its size.
Stream when you need a slice: a handful of channels, a time window,
or a few recordings out of a larger set.
Download when you are going to touch most of the array anyway.
A huge recording you need two channels from is still a streaming read,
and a small recording you are loading in full is still a plain download.

**Reach for something else when** you need the original samples.
Every served array is lossy: it is int16-quantized and rate-capped relative to the source recording,
and there is no lossless streaming path today.
Conversion is also raw-only and not universal,
so a recording may simply have no store.
When fidelity matters, download the BIDS file.

See [Zarr and edge access](/platform/zarr/) for the contract,
and [Cost Ladder and Recipes](/platform/zarr/cost-ladder/) for worked reads.

## The MCP server: `mcp.nemar.org`

`https://mcp.nemar.org/mcp` serves the archive over the
[Model Context Protocol](https://modelcontextprotocol.io) (MCP)
as six tools: `search_datasets`, `describe_dataset`, `list_recordings`,
`get_events`, `render_overview`, and `read_window`.
It is a stateless broker, with no session to resume,
and a client should not construct any URL for it other than that endpoint.
An MCP client points at it and can then answer questions about NEMAR data directly.

**Reach for it when** the caller is a language model or an agent,
and the job is to find, describe, or plan a read.

**Reach for something else when** you want the bytes.
It is not a bulk download path, it is not a replacement for the CLI,
and no upload happens here: none of the six tools writes anything.
It also only ever sees published data, since private and sandbox datasets are invisible to it,
so it cannot answer a question about a deposit that is not public yet.

Configuration and a worked session are in
[For agents and tools](/platform/for-agents/#tool-calling-mcpnemarorg).

### Why this exists when the CLI already does

A fair question, since the CLI can already search, describe, and download.
Four reasons, and none of them is "the CLI was missing a feature".

**It is for a language model, not a person.**
The CLI's interface is prose: `--help` text, positional arguments, and exit codes meant for a human
who will read an error and try again.
A model driving that has to have a shell, guess at flags, and parse output written for eyes.
MCP is the same archive presented as tools with declared argument schemas,
so the client knows what a call takes before it makes it,
and a rejected call comes back naming the limit it crossed rather than as output to be parsed.
The server also does the arithmetic that is easiest to get wrong by hand:
`read_window` converts your seconds into a sample range at the rate the array is actually served at,
and `get_events` returns event sample indices computed by the converter where a converted event
table exists, marking them as estimated when it has to fall back to the BIDS `events.tsv`
and derive them itself.

**It returns recipes, not data.**
This is the part that makes it not a wrapper around the CLI, but its opposite.
A CLI's whole job is to move bytes onto your disk.
The MCP server refuses to be a data pipe: by default `read_window` reads no signal chunks at all
and instead returns a *recipe*, naming
the exact array URL, the chunk geometry, the sample range,
and where to find the scale and offset that turn stored integers back into physical units;
the caller then fetches the bytes itself, straight from S3 or through `zarr.nemar.org`.
It will decode a small window inline if you explicitly ask (`taste: true`),
and when a request is over its caps it **refuses and names the cap you crossed
rather than quietly truncating the answer**,
because a silently shortened window is a wrong result rather than a small one.
No bulk signal bytes pass through the server, so the data stays on the fast path.

**It needs no credentials and no install.**
The server is anonymous: no key, no signup, no session.
So an assistant can answer a question about a published dataset for someone who has
installed nothing at all, where reaching for the CLI means a package plus system dependencies
before it can answer anything.

**Answers carry their provenance.**
A recording-level response comes back with an envelope naming the dataset, its DOI, its license,
its citation, and the exact source commit the conversion was built from,
plus whether the served array is lossy;
the two catalog-level tools carry the DOI, license, and citation as fields of their own.
A model that reads data through this server has what it needs to cite the exact version it used,
and to know when it is looking at a rate-capped copy instead of the original.

The short version: the CLI is how a person moves data,
and the MCP server is how a model finds data and learns how to read it.
Neither one substitutes for the other.

## Where they overlap, honestly

Several tasks have more than one right answer, and the docs should say so.

- **Searching the catalog** is available on four of the five: the website, the CLI, the API, and
  the MCP server all answer it. Use the website if you are the one reading the results.
- **Uploading** happens on exactly two: the website and the CLI.
  Both need upload access first; see [Upload access](/web/upload-access/).
- **Downloading a whole dataset** is the CLI or the data plane.
  The CLI adds resume, BIDS entity filters, and git-annex handling;
  the data plane is one `GET` per file and no install.
- **Reading signal data** is the Zarr copy for a slice, and a download for everything else.
  The MCP server does not add a third option here; it tells a caller which of the two it wants.

## Where to go next

- [CLI vs the web](/ecosystem/cli-vs-web/): the two human surfaces, compared in detail.
- [The NEMAR ecosystem](/ecosystem/): how the parts fit together.
- [Hosts and routes](/platform/hosts-and-routes/): every hostname and the paths it serves.
- [For agents and tools](/platform/for-agents/): the machine-facing contracts, including MCP.
