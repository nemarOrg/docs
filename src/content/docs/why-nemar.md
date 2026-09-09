---
title: Why use NEMAR?
description: What NEMAR adds to an open neurodata workflow, with a concrete DOI comparison for the HBN EEG dataset.
---

NEMAR is not a replacement for every neurodata archive. It is a neurophysiology-focused
access, metadata, and reuse layer that connects a human-readable dataset page, a programmatic
API, a BIDS-shaped data plane, a command-line workflow, and—where conversion is available—a
chunked Zarr access path.

If a dataset began somewhere else, NEMAR should make that provenance easier to follow, not hide
it. The HBN EEG example below shows the difference between the source repository's DOI and the
NEMAR release DOI for the same imported dataset.

## Nine reasons to use NEMAR

### 1. One foundation, several ways to work

NEMAR is built around shared API, data, and metadata contracts. The website is a human-friendly
shell around those contracts; the CLI and other tools use the same underlying services. You can
discover a dataset in the browser, inspect it in code, and continue on a compute node without
creating a second copy of the catalog or a second definition of the dataset.

See [the ecosystem map](/ecosystem/) and [CLI versus the web](/ecosystem/cli-vs-web/).

### 2. Search before moving large files

NEMAR exposes searchable catalog fields and dataset-level metadata before a download begins. A
researcher or agent can first ask whether the modality, task, participants, sessions, or quality
information look relevant, then fetch only the release that is worth analyzing.

Start with the [backend API](/platform/api/) and the [guide for agents and tools](/platform/for-agents/).

### 3. BIDS is the canonical source, with an explicit file contract

Published datasets are exposed as BIDS-shaped trees with versioned manifests, paths, and
checksums. This makes the actual release inspectable and gives scripts a stable way to resolve a
file. Derived representations may improve access, but they do not replace the citable BIDS
release.

Read the [Data API contract](/platform/data-api/) for the file, manifest, metadata, and archive
endpoints.

### 4. Neuroschema makes metadata portable downstream

NEMAR publishes dataset-level metadata as a [Neuroschema](https://github.com/nemarOrg/neuroschema)
v0.4.0 document. The live [`on005506` metadata document](https://data.nemar.org/on005506/metadata.json)
reports `doc_type: dataset`, `source: nemar`, and `schema_version: 0.4.0`. It gives software a
structured description of the dataset, its files, BIDS entities, authors, identifiers, terms,
and NEMAR-specific extensions. A downstream tool can use that contract instead of scraping a
page or inventing a private interpretation of every dataset.

This contract is already useful across the surrounding ecosystem. [EEGDash](https://eegdash.org/)
uses NEMAR-backed records and defines typed dataset and recording schemas; its datasets can feed
[Braindecode](https://braindecode.org/stable/index.html) workflows, while its
[MOABB interoperability example](https://eegdash.org/generated/auto_examples/tutorials/50_evaluation/plot_55_moabb_interop.html)
shows the catalog-to-benchmark handoff. [MOABB](https://github.com/NeuroTechX/moabb) also supports
NEMAR as a download provider for datasets that declare a NEMAR identifier.

The libraries do not all store the raw Neuroschema document unchanged: EEGDash is an indexing and
loading layer, Braindecode is a learning layer, and MOABB is a benchmarking layer. Compatibility
means that the dataset identity and important metadata can travel between those layers without
losing the connection to the BIDS source.

See the [NEMAR metadata contract](/platform/data-api/) and the [Neuroschema repository](https://github.com/nemarOrg/neuroschema).

### 5. The DOI describes both identity and history

NEMAR uses a concept DOI for the continuing dataset and a version DOI for each released state.
The DOI record can carry the NEMAR identifier, creator identifiers, roles, description, domain
terms, rights, funding, related publications, source relationships, and links to the operational
record. The [HBN comparison below](#a-concrete-comparison-hbn-eeg-release-2) shows exactly what is
present in one live NEMAR/OpenNeuro pair.

### 6. Zarr and edge access make partial reads practical

Where conversion is available, NEMAR provides a derived Zarr serving copy so a viewer or analysis
client can request a time window, a few channels, or selected recordings instead of downloading
an entire source file. The BIDS archive remains authoritative, and the conversion status is
explicit rather than hidden behind an apparently empty viewer.

See [the Zarr mental model](/platform/zarr/mental-model/) and [access recipes](/platform/zarr/cost-ladder/).

### 7. The CLI supports repeatable work at research scale

The [nemar CLI](/cli/) is useful when a browser is not the right tool: scripted publication,
large or parallel transfers, validation in a pipeline, bulk operations, and work on a shared
server or compute node. The web app remains useful for discovery and review; the two surfaces
share accounts, permissions, and datasets.

### 8. Improvement is visible instead of silently rewriting history

NEMAR treats a release as a fixed, citable state. A correction, new cohort, metadata enrichment,
or conversion improvement can go through review, become a new version, and receive a new version
DOI. The concept DOI connects the history while the version DOI protects the meaning of an older
analysis.

The [DOI and versioning guide](/platform/doi-and-versioning/) explains the release workflow.

### 9. The interfaces are open to people, agents, and future compute

NEMAR's public pages, Markdown, JSON, schema.org records, manifests, API routes, and
documentation are intended to be understandable to software as well as people. That supports
agentic research: a tool can find a dataset, inspect its terms, identify the exact release, and
explain what it used.

The compute direction builds on the [SDSC and NSG partnership](/ecosystem/compute/). Connecting
NEMAR workflows to national HPC through Tapis and OneSciencePlace is a planned integration, not a
claim that every dataset can already launch an HPC job. The goal is to carry the same dataset,
version, provenance, and data-use constraints into a reproducible compute workflow.

## A concrete comparison: HBN EEG Release 2

To make the claim that a NEMAR DOI can be more informative testable, compare the live DataCite
records for one dataset rather than comparing DOI prefixes in the abstract:

- **NEMAR record:** [`on005506`](https://nemar.org/dataset/on005506), version DOI
  [`10.82901/nemar.on005506.v1.0.0`](https://doi.org/10.82901/nemar.on005506.v1.0.0), concept DOI
  [`10.82901/nemar.on005506`](https://doi.org/10.82901/nemar.on005506).
- **OpenNeuro source record:** [`ds005506`](https://openneuro.org/datasets/ds005506/versions/1.0.1),
  version DOI [`10.18112/openneuro.ds005506.v1.0.1`](https://doi.org/10.18112/openneuro.ds005506.v1.0.1).

The NEMAR catalog identifies `on005506` as imported from OpenNeuro `ds005506`. The two version
strings are therefore local to their repositories: NEMAR `v1.0.0` and OpenNeuro `v1.0.1` are not
two spellings of one universal version number. They identify releases in two different systems.

### What is in each DOI record?

The table describes the DataCite records checked on 2026-09-09. It compares DOI metadata, not
every feature of either archive's website.

| DataCite field | OpenNeuro source DOI | NEMAR version DOI | Why it matters |
| --- | --- | --- | --- |
| Persistent identity and landing page | `10.18112/openneuro.ds005506.v1.0.1`; OpenNeuro version page | `10.82901/nemar.on005506.v1.0.0`; NEMAR version page | A DOI resolves to the release-specific place where a person or tool can inspect the record. |
| Repository identifier | No separate `identifiers` or `alternateIdentifiers` in this DOI record | `NEMAR: on005506` in both identifier fields | A stable local ID lets APIs, scripts, pages, manifests, and citations refer to the same NEMAR object. |
| Creators | All eight names; no ORCID or affiliation values in this DOI record | All eight names; seven ORCID iDs; no affiliation values in this particular record | Persistent person identifiers make attribution less dependent on spelling. This example is richer, but not complete. |
| Hosting and curation roles | No contributor roles in this DOI record | NEMAR as `HostingInstitution` and `nemarAdmin` as `DataCurator` | The record distinguishes the people who created the data from the service that hosts and curates this release. |
| Description | No description in this DOI record | Abstract plus separate citation guidance | A machine can learn what the dataset contains without first scraping a web page. |
| Subjects and keywords | No subjects in this DOI record | Domain terms including HBN, EEG, HED, CBCL, BIDS, and neuroscience | Structured terms improve discovery and give tools useful context. |
| Rights | No rights entry in this DOI record | CC BY-SA 4.0 with an SPDX identifier and license URL | A citation record can expose the reuse condition; users must still read the license. |
| Version relationship | The DOI suffix contains `v1.0.1`, but the DataCite `version` field is empty and no version relation is recorded | `version: 1.0.0`, with `IsVersionOf` pointing to the NEMAR concept DOI | The version is explicit in metadata, not only encoded in a string. |
| Related scholarly and operational records | No related identifiers in this DOI record | `IsIdenticalTo` the OpenNeuro source DOI, plus the dataset paper, original HBN publications, NEMAR GitHub description, and NEMAR landing page | Related identifiers connect the imported release to its source, papers, code, and documentation. |
| Funding | No funding references in this DOI record | NIH, grant `R01MH125934`, and Child Mind Institute entries | Funding context is available to people and machines that build research-impact graphs. |
| File context | No sizes or formats in this DOI record | No sizes or formats in this DOI record | DOI metadata provides orientation; the NEMAR manifest remains authoritative for the exact files and checksums. |

In this specific comparison, the NEMAR record is fuller as a DataCite metadata record. That is a
statement about observable field coverage, not a claim that NEMAR is intrinsically a better DOI,
that OpenNeuro's website lacks the information, or that every NEMAR record is equally complete.
Both DOIs are valid scholarly identifiers. The difference is what each repository chose to put
into its registrar record.

For example, OpenNeuro's own documentation describes its BIDS requirement and public-domain
licensing policy even though those details are not present in this particular OpenNeuro DataCite
record. The NEMAR record states CC BY-SA 4.0 for the NEMAR release. Those are separate repository
statements: read the license attached to the release you actually use rather than assuming that
an imported dataset has the same terms everywhere.

:::caution
Metadata is a living part of a research resource. A DOI record can be updated, and a landing
page can expose information that has not been copied into the registrar metadata. For exact
release contents, use the NEMAR [version manifest](/platform/data-api/) and record the version
DOI alongside the manifest and analysis code.
:::

## Why NEMAR mints its own DOI

The DOI prefix is not a quality score. NEMAR uses its own DOI namespace so that the NEMAR release
has a persistent scholarly identity in the NEMAR system:

1. `10.82901/nemar.on005506` identifies the continuing NEMAR dataset concept.
2. `10.82901/nemar.on005506.v1.0.0` identifies one released NEMAR state.
3. `on005506` connects that identity to the NEMAR API, data plane, GitHub metadata repository,
   dataset page, and derived access services.

This lets NEMAR improve the resource without silently changing what an old citation means. A
correction, added cohort, metadata enrichment, or conversion improvement can become a new
reviewable release. The concept DOI connects the history; the version DOI tells another
researcher which state an analysis used.

DataCite's own guidance describes this pattern as a canonical DOI connected to version-specific
DOIs with `HasVersion` and `IsVersionOf` relations. NEMAR uses that relationship for its concept
and version records. See [DOI and versioning](/platform/doi-and-versioning/) for the contributor
workflow and citation rules.

## When to cite which DOI

Use the DOI for the resource you actually used:

| Your workflow | Citation choice |
| --- | --- |
| You downloaded the original OpenNeuro snapshot directly | Cite the OpenNeuro version DOI. |
| You used the NEMAR BIDS release from `data.nemar.org` or the NEMAR CLI | Cite the NEMAR version DOI. |
| You used NEMAR's release and want to preserve the source provenance | Cite the NEMAR version DOI and the OpenNeuro source DOI. |
| You are discussing the NEMAR dataset across releases | Use the NEMAR concept DOI, and name the analyzed version when it matters. |

For any reproducible analysis, save the dataset ID, version DOI, manifest or snapshot information,
analysis code, and relevant parameters. A DOI tells readers which scholarly object to find; the
version and manifest tell them which files and metadata state the analysis consumed.

## The honest boundary

NEMAR and OpenNeuro can serve complementary purposes. OpenNeuro remains the source archive for
datasets deposited there, with its own BIDS requirements, access mechanisms, and version DOIs.
NEMAR is the better fit when you want the NEMAR catalog, neurophysiology-oriented enrichment,
NEMAR's API/CLI/data-plane contracts, citable NEMAR releases, or derived partial-read access.

The right question is not “which DOI looks more official?” It is “which release, metadata record,
and access path did my work actually use?” NEMAR's goal is to make that answer explicit and easy
to reproduce.

## Records and standards used here

- [NEMAR `on005506` catalog record](https://api.nemar.org/datasets/on005506)
- [NEMAR concept DOI as DataCite JSON-LD](https://api.datacite.org/application/vnd.schemaorg.ld+json/10.82901/nemar.on005506)
- [NEMAR version DOI as DataCite JSON-LD](https://api.datacite.org/application/vnd.schemaorg.ld+json/10.82901/nemar.on005506.v1.0.0)
- [OpenNeuro source DOI as DataCite JSON-LD](https://api.datacite.org/application/vnd.schemaorg.ld+json/10.18112/openneuro.ds005506.v1.0.1)
- [OpenNeuro FAQ: DOI and version citation](https://docs.openneuro.org/faq)
- [OpenNeuro data-management guidance](https://docs.openneuro.org/policy/data_management_plans.html)
- [DataCite metadata schema](https://support.datacite.org/docs/datacite-metadata-schema)
- [DataCite guidance for connecting versions](https://support.datacite.org/docs/connecting-versions-with-related-identifiers)
