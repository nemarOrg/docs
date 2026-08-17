---
title: Data Contributor Terms
description: What depositors warrant when uploading a dataset to NEMAR, including de-identification, ethics approval, key handling, and licensing.
---

Effective date: 2026-08-17.

By uploading a dataset to NEMAR (Neuroelectromagnetic Data Archive and Tools Resource),
you make the following warranties.
They exist to protect research participants
and to keep NEMAR datasets shareable worldwide.
These terms are comparable to those of
[OpenNeuro](https://openneuro.org/), with differences noted below.

## Ownership and ethics approval

You warrant that you are the owner of the dataset or authorized by the owner to deposit it,
and that you hold all ethics permissions required to share the data publicly,
such as Institutional Review Board (IRB) or ethics committee approval
and participant consent covering public sharing.

## De-identification

You warrant that the dataset contains no identifiable personal information,
including the identifiers enumerated by the United States
[Health Insurance Portability and Accountability Act (HIPAA) Safe Harbor standard](https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html):
no names, addresses, dates of birth, acquisition dates finer than year, contact details,
record numbers, or facial imagery (anatomical images must be defaced),
and no rare-attribute combinations that make a participant recognizable.
Vendor file headers must be scrubbed of identifying fields.

## The re-identification key

Research datasets are coded: participants appear as subject labels such as `sub-01`.
Somewhere, a key may link those labels to identities.
When you deposit, you must declare which of the following applies,
and the declaration is recorded with the dataset:

- **Key destroyed.** The key linking subject codes to identities has been destroyed. The dataset is anonymous in the strict sense of the European Union's General Data Protection Regulation (GDPR).
- **Key retained by depositor.** The key exists but remains with your institution under its ethics protocol, and is never transmitted to NEMAR. The dataset is pseudonymous for you, and your institution remains responsible for it under applicable data protection law.

In either case, you warrant that no re-identification key, in any form,
is ever uploaded to or shared with NEMAR.

This differs from OpenNeuro, which requires key destruction in all cases.
NEMAR accepts retained keys to support longitudinal studies,
but the responsibility that comes with retention stays with you.
See the [GDPR Position Statement](/policies/gdpr/) for the legal consequences of each choice.

## Depositors in the European Union

If your data was collected in the European Union or European Economic Area,
you warrant that your legal basis
(typically the explicit informed consent of your participants)
permits deposit in a publicly accessible archive hosted in the United States.
The [Open Brain Consent GDPR edition](https://open-brain-consent.readthedocs.io/en/stable/gdpr/ultimate_gdpr.html)
provides vetted consent language designed for exactly this purpose,
and we recommend it for prospective studies.

## Licensing

You choose the license for your dataset, subject to one floor:
the data must be freely available for nonprofit research use,
without registration walls, per-use consent forms, or fees.
Licenses permitting only non-commercial use are acceptable.
We recommend [Creative Commons CC0](https://creativecommons.org/publicdomain/zero/1.0/)
or [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) for maximum reuse,
but they are not required.
The chosen license is recorded in the dataset metadata and its Digital Object Identifier (DOI) record.

This differs from OpenNeuro, which requires CC0 for all datasets
after a limited grace period.

## Removal

If a dataset is later found to contain identifiable information
or to have been deposited without adequate permissions,
it is handled under the [Takedown Procedure](/policies/takedown/).
You agree to cooperate with such a review for datasets you deposited.
