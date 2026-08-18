---
title: AI-Assisted Curation
description: Where NEMAR uses AI in dataset curation, why its output is never final, and how to request a correction.
---

NEMAR (Neuroelectromagnetic Data Archive and Tools Resource) uses
artificial intelligence (AI), specifically large language models (LLMs),
at defined points in dataset curation.
This page states where, under what constraints,
and what to do when an AI-derived result is wrong.

The purpose of these systems is transparency:
they exist to make datasets accurately and consistently described,
so that anyone can see what a dataset contains and how it may be used.
They are assistants to curation, not its authority.

## Where AI is used

- **Metadata enrichment for DOI records.**
  When a dataset is published, an LLM reads the dataset's README and
  `dataset_description.json` and proposes structured metadata for the
  Digital Object Identifier (DOI) record:
  a scholarly abstract, a methods summary, subject keywords,
  funding references, and related publication identifiers.
  Proposed keywords are restricted to Medical Subject Headings (MeSH)
  and each term is verified against the National Library of Medicine (NLM)
  vocabulary; the model cannot introduce invented terminology.
- **Submission prescreen.**
  At publication request, an LLM judges the quality criteria that a
  mechanical rule cannot, such as whether the dataset name is descriptive
  and whether the README describes this specific dataset.
  Its verdicts are advisory by design; they inform the human reviewer
  and never reject a dataset on their own
  (see the [Dataset Submission Standards](/policies/submission-standards/)).
- **Metadata validation before DOI minting.**
  Before a DOI is minted, the assembled metadata record must pass a
  validation step that includes an LLM judge.
  This gate can only withhold a permanent identifier until the record is
  fixed; it never publishes anything by itself.
- **Search.**
  Dataset search on the website and in the CLI uses AI-derived semantic
  embeddings of dataset metadata alongside conventional keyword matching.

## What AI never sees or decides

- **Only dataset documentation is processed.**
  The models read the README, `dataset_description.json`,
  and metadata derived from them.
  Recordings and participant-level data files are never sent to a model
  by these pipelines.
- **No AI output is final.**
  Every consequential decision has a non-AI authority above it:
  publication is approved by a NEMAR administrator,
  keywords are constrained to a validated controlled vocabulary,
  and quality verdicts are advisory.
  AI-derived text in a DOI record or on a dataset page is a proposal that
  survived those gates, and it remains correctable afterwards.

## Monitoring and improvement

We monitor these systems continuously and improve them deliberately;
prompts, models, and thresholds change over time.
Calibration is empirical:
the advisory-only status of quality judgments, for example,
was set after measuring false-positive rates on the published corpus.

## Corrections

AI-assisted metadata will sometimes be wrong,
and we strongly encourage you to tell us when it is.
Corrections require an issue, so that the fix and its reasoning are public:

- **For one dataset** (a wrong abstract, keyword, funding reference,
  or quality flag): open an issue on that dataset's repository under
  [github.com/nemarDatasets](https://github.com/nemarDatasets).
- **For a systematic problem** (the same kind of error across datasets,
  or a pipeline behaving badly): open an issue on
  [nemar-cli](https://github.com/nemarOrg/nemar-cli/issues),
  where these pipelines live.

If you are not sure which applies, or cannot use GitHub, write to
[support@nemar.org](mailto:support@nemar.org) and we will file the issue.
Confirmed corrections are applied by re-running enrichment for the dataset;
DOI metadata is amended at the registrar,
since a DOI itself is permanent but its record is not frozen.
