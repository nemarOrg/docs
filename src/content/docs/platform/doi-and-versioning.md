---
title: DOI and versioning
description: Why NEMAR uses a concept DOI, version DOIs, richer DataCite metadata, and reviewable releases.
---

## Why NEMAR has its own DOI namespace

NEMAR mints dataset identifiers in its own `10.82901/NEMAR` namespace through EZID and publishes
the associated DataCite metadata. The namespace gives the NEMAR resource a stable way to connect
three things that otherwise tend to drift apart: the dataset as a continuing scholarly object, a
specific released version, and the landing page that explains how to use it.

This is not just a shorter download link. A minimal citation record might provide a title, an
author, and a URL. A populated NEMAR record can carry much more context when the source metadata
supports it:

- authors, ORCID identifiers, and affiliations;
- an abstract, methods or technical description, and MeSH-validated keywords;
- funding information and related publications or identifiers;
- creation, publication, and update dates;
- language, geographic information, file formats, sizes, and license;
- the dataset version and the relationship between the concept and its versions.

The result is a richer citation and a better machine-readable description of what the dataset is.
“Can carry” matters: the record is only as complete as the metadata supplied and successfully
validated during curation.

## Concept DOI and version DOI

The concept DOI identifies the dataset across its useful lifetime. A version DOI identifies one
released state. For example, a dataset might have a concept DOI like:

```text
10.82901/NEMAR.nm000103
```

and a version DOI associated with a release such as:

```text
10.82901/NEMAR.nm000103.v1.0.0
```

The exact identifier shown on a dataset landing page is authoritative. The important relationship
is conceptual: cite the concept when discussing the dataset broadly; cite the version when an
analysis depends on the exact files, metadata, or manifest used.

## Why versioning is part of FAIR practice

FAIR data must be findable and reusable, but reuse also requires knowing which state was used. A
DOI should not turn a dataset into an unchangeable museum object, and an update should not silently
rewrite the bytes behind an old citation.

NEMAR therefore treats a release as a fixed citable state. A later correction or addition goes
through a reviewable pull request, receives a new dataset version, and can receive a new version
DOI. The concept-level identity connects the history; the version-level identity protects the
meaning of an earlier analysis.

The DOI itself is permanent, while its registrar metadata can be corrected or enriched when a
curation error is found. That distinction lets NEMAR improve descriptions and relationships in
public without pretending that a previous release never existed.

## A practical citation rule

When you publish an analysis, record:

1. the NEMAR dataset ID;
2. the version DOI or explicit version tag;
3. the analysis code and relevant parameters;
4. any derivative outputs and their own provenance.

The [dataset versioning guide](/cli/guides/versioning/) explains the contributor workflow. The
[Data API](/platform/data-api/) exposes version lists, metadata, and manifests for tools that need
to resolve the same record programmatically.
