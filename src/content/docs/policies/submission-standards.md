---
title: Dataset Submission Standards
description: What a dataset must include to be published on NEMAR, and what we strongly recommend beyond that minimum.
---

This page describes the quality bar a dataset must meet to be published on
NEMAR (Neuroelectromagnetic Data Archive and Tools Resource),
and the metadata we strongly recommend beyond that minimum.
The legal side of depositing, including ownership, de-identification,
and licensing warranties, is covered by the
[Data Contributor Terms](/policies/contributor-terms/); this page is about
completeness and quality.

We keep this bar deliberately small.
It was calibrated against a scan of 577 published datasets in NEMAR's modality
scope, so each requirement targets a failure mode that actually occurs,
rather than aspiration.

## Account requirements

- **An ORCID iD is required for every NEMAR account.**
  Your name on NEMAR is taken from your ORCID record and is not freely editable;
  this keeps authorship attribution canonical across datasets and
  Digital Object Identifiers (DOIs).
- **Sandbox training is required before your first real upload.**
  The `nemar sandbox` walkthrough exercises the full upload cycle on a
  throwaway dataset so mistakes happen there, not on a real deposit.
- **Upload access is granted by an administrator** after account review.
  Signing in alone does not enable uploads.
- **Every upload carries a deposit attestation** covering de-identification,
  the re-identification key status, and (for deposits of licensed data you do
  not own) an affirmation that the dataset is not already archived on NEMAR or
  an upstream archive. See the
  [Data Contributor Terms](/policies/contributor-terms/) for what each
  statement means.

## Required for publication

A dataset must meet all of the following before a publication request is
approved:

- **BIDS validation passes with zero errors.**
  The dataset must be a valid Brain Imaging Data Structure (BIDS) dataset;
  validation runs automatically on upload and again at publication.
- **A `dataset_description.json`** with at least `Name` and `BIDSVersion`
  (BIDS validation already requires this).
- **A substantive README** that describes this specific dataset:
  what was recorded, from whom, and how the files are organized.
  A placeholder, a stub of a few sentences, or boilerplate copied across a
  family of datasets does not qualify.
- **A declared license.**
  You choose the license, including non-commercial ones, subject to the floor
  in the [Data Contributor Terms](/policies/contributor-terms/#licensing):
  the data must remain freely usable for nonprofit research.
  The upload tooling helps you pick one and writes the `LICENSE` file.
- **The data files are actually present.**
  A dataset whose metadata references recordings that were never uploaded is
  not published.

## Strongly recommended

The following are checked and flagged when missing, but do not block
publication on their own:

- **A descriptive dataset name.**
  As a guideline, a good title is at least 25 characters and tells a reader
  what was studied; the dataset identifier, a bare author-year string, or a
  placeholder such as `DataSet1` is not a name.
  Name adequacy is judged, not mechanically counted, so legitimate short
  acronym titles are not penalized.
- **Authors listed in full, each with an ORCID iD.**
  The upload tooling collects co-author ORCID iDs so every author is
  unambiguously credited in the dataset's DOI record.
  Placeholder author entries are treated as missing.
- **Funding sources**, in the `Funding` field of `dataset_description.json`.
  These become funding references in the DOI metadata, which is how funders
  discover the datasets they supported.
- **Acknowledgments**, in the `Acknowledgements` field of
  `dataset_description.json`, for contributions that fall short of authorship.
- **Ethics approval information**, either in the `EthicsApprovals` field or as
  a statement in the README.
  Datasets without it carry a visible flag; the underlying warranty that the
  data was collected under appropriate ethical approval is part of the
  [Data Contributor Terms](/policies/contributor-terms/).

## How the standards are checked

Checks run at three points, and the earlier ones exist so you learn about a
problem before it costs you time:

1. **At upload**, the CLI and the web uploader validate BIDS structure and
   warn about missing recommended metadata.
2. **At publication request**, an automated prescreen reviews the dataset,
   including the quality judgments above.
   Its verdicts on name and README adequacy are advisory by design; they
   inform the reviewer rather than desk-rejecting automatically.
3. **A NEMAR administrator reviews every publication request.**
   Datasets that do not meet the required bar are returned with the specific
   reasons, and can be resubmitted after revision.

Before a DOI is minted, the dataset's metadata record must additionally pass
validation, including checks on the enriched subject terms.
A DOI is permanent, so no dataset acquires one carrying metadata nobody
checked.

## Mirrored datasets

Datasets imported from OpenNeuro already passed that archive's own review, so
they are exempt from the required bar above; re-litigating an accepted review
would block importing datasets that are already public and citable.
Imported datasets still receive the advisory flags, so a missing ethics
statement or a thin README is visible on the dataset page either way.

## Questions

If you are unsure whether your dataset meets these standards, open an issue on
the [nemar-cli repository](https://github.com/nemarOrg/nemar-cli/issues) or
write to [support@nemar.org](mailto:support@nemar.org) before uploading;
we would rather help you fix a README than return a publication request.
