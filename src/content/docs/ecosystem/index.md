---
title: The NEMAR ecosystem
description: How the parts of NEMAR fit together — the CLI, the backend API, the public data plane, the dataset browser, the signal viewer, and the tooling around them.
---

NEMAR is not a single application. It is a set of cooperating systems that make
neuroelectromagnetic data easier to publish, find, inspect, compute with, and cite.
The command-line interface and the website are two clients of shared contracts; neither is a
second source of truth.

## The one-minute map

![NEMAR system map showing people and research agents, the CLI and web shell, shared API/data/Zarr layers, storage, and DOI records.](/figures/nemar-system-map.png)

**Figure 1.** The same platform contracts serve repeatable terminal workflows, browser discovery,
and future machine-facing research tools. The diagram uses exact labels and distinguishes the
canonical data plane from derived Zarr access.

## Surfaces

| Part | URL | Role | Docs |
| --- | --- | --- | --- |
| **CLI** | `nemar` | Upload, validate, version, download, and manage datasets from the terminal | [CLI](/cli/) |
| **Backend API** | `api.nemar.org` | Auth, dataset lifecycle, admin, publication, DOIs (Cloudflare Workers + D1) | [Platform API](/platform/api/) |
| **Data plane** | `data.nemar.org` | Public dataset files, version manifests, `records.json`, archive zips | [Data API](/platform/data-api/) |
| **Dataset browser** | `nemar.org` | The dataset browser (Astro) | external |
| **Zarr serving plane** | `zarr.nemar.org` | Derived, chunked access used by the in-browser signal viewer where conversion is available | [Zarr and edge access](/platform/zarr/) |
| **Scholarly record** | DOI landing pages | A durable concept identity and precise version citations | [DOI and versioning](/platform/doi-and-versioning/) |

## How a dataset flows through NEMAR

![NEMAR dataset lifecycle showing preparation, validation, reviewed publication, reuse, and a pull-request-driven improvement loop.](/figures/nemar-dataset-lifecycle.png)

**Figure 2.** A release is a fixed, citable state. A later improvement becomes a new version rather
than silently changing the object that an earlier analysis used.

1. A researcher prepares a BIDS dataset and validates it with the **CLI**.
2. The CLI or website registers the dataset through the **backend API**, which creates a private
   GitHub repository for metadata and git-annex pointers and provisions S3 storage for data blobs.
3. Data files upload to S3; metadata is versioned in GitHub.
4. Review creates a concept DOI; the researcher cuts versioned releases, each with its own version
   DOI.
5. On publication the dataset becomes public on the **data plane** (`data.nemar.org`) and is
   surfaced in the **browser** (`nemar.org`).
6. Where conversion is available, recordings are represented in a derived Zarr serving copy for
   partial browser reads.

## Where to go next

- New to NEMAR? Start with the [CLI installation guide](/cli/getting-started/installation/).
- Read the [mission and vision](/ecosystem/mission-and-vision/) for the public purpose and open
  science commitments.
- Compare [the CLI and web workflows](/ecosystem/cli-vs-web/).
- Building against the API or pulling data programmatically? See [Platform & APIs](/platform/).
- Learn how [Zarr and edge access](/platform/zarr/) support responsive reads.
- Use the [guide for agents and tools](/platform/for-agents/) when writing a client or research
  assistant.
- A NEMAR administrator? See the [admin documentation](/admin/commands/) (access-gated).

:::note
This documentation site covers the whole ecosystem. Current services and planned services are
named separately so a roadmap is not mistaken for a production guarantee.
:::
