---
title: For agents and tools
description: Machine-facing routes and conventions for scripts, research agents, and LLM-assisted workflows.
---

NEMAR is committed to agentic research: not only the code repositories, but also the webpages,
dataset records, and data access paths should be understandable to software. An agent should be
able to discover a dataset, inspect its context, identify the exact release, and explain what it
used without scraping a visual page as its only source.

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

The website also emits schema.org Dataset JSON-LD on dataset pages. Prefer the explicit JSON
metadata and manifests for data work, and use the Markdown mirror or JSON-LD for page-level
context.

## A small read-only example

```bash
# Catalog discovery
curl -s 'https://api.nemar.org/datasets?limit=20&search=resting%20state'

# Dataset-level metadata and version relationships
curl -s 'https://data.nemar.org/nm000103/metadata.json'

# One release's file index
curl -s 'https://data.nemar.org/nm000103/v1.0.0/manifest.json'

# A BIDS-relative path through the canonical data gateway
curl -I 'https://data.nemar.org/nm000103/v1.0.0/dataset_description.json'
```

Use the dataset ID and explicit version in stored notes and generated reports. `latest` is useful
for exploration but is not sufficient for an analysis that must be reproducible.

## Interpret the layers correctly

- **Catalog/API:** what NEMAR knows about datasets, accounts, permissions, and lifecycle state.
- **BIDS data plane:** the canonical public files, metadata, manifests, and versioned paths.
- **Zarr plane:** a derived, chunked access representation for responsive reads; it may be pending,
  incomplete, or unavailable for a recording.
- **DOI record:** scholarly identity and citation context, not a replacement for the file manifest.

Do not infer that a missing Zarr store means a missing BIDS recording. Check the source manifest and
the Zarr index separately. Do not treat a catalog description as a substitute for the versioned
file list.

## Agent behavior we want

Good research tooling should:

- preserve dataset ID, version, DOI, license, and source URLs in its output;
- read README and structured metadata before proposing an interpretation;
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
