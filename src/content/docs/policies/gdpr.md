---
title: GDPR Position Statement
description: How the European Union's General Data Protection Regulation applies to NEMAR datasets, user accounts, and international transfers, with references.
---

Effective date: 2026-08-17.

This page explains how NEMAR (Neuroelectromagnetic Data Archive and Tools Resource)
relates to the European Union's General Data Protection Regulation (GDPR).
It is an operational position statement, not legal advice.
Questions: **privacy@nemar.org**.

## The datasets

The GDPR governs personal data.
Data that is anonymous, meaning the data subject is no longer identifiable
by any means reasonably likely to be used,
is outside the scope of the GDPR entirely
([Recital 26](https://gdpr-info.eu/recitals/no-26/)).

Every NEMAR dataset is de-identified before deposit
under the [Data Contributor Terms](/policies/contributor-terms/),
and the depositor declares the status of the re-identification key:

- **Key destroyed:** the dataset is anonymous under Recital 26, and the GDPR does not apply to it, for NEMAR or for anyone else.
- **Key retained by the depositor:** the dataset is pseudonymized under [Article 4(5)](https://gdpr-info.eu/art-4-gdpr/), which remains personal data in the hands of the key holder. The depositing institution is the controller for that data. NEMAR never receives the key, holds no means of re-identification, and hosts data that is effectively anonymous in its hands.

For datasets originating in the European Union or European Economic Area,
the depositor warrants a legal basis for public deposit,
typically the explicit informed consent of participants,
which also satisfies the transfer derogation of
[Article 49(1)(a)](https://gdpr-info.eu/art-49-gdpr/)
where transfer rules apply at all.
The [Open Brain Consent GDPR edition](https://open-brain-consent.readthedocs.io/en/stable/gdpr/ultimate_gdpr.html)
provides participant consent language reviewed for this scenario.

## Data residency

The GDPR does not require personal data to remain in the European Union,
and it places no location constraints on anonymous data.
What it regulates is the transfer of personal data to third countries
([Chapter V](https://gdpr-info.eu/chapter-5/)).
Lawful transfer mechanisms relevant to NEMAR:

- the [EU-US Data Privacy Framework](https://www.dataprivacyframework.gov/) adequacy decision, under which Amazon Web Services and other NEMAR service providers are certified;
- [Standard Contractual Clauses](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en), which are built into the [AWS Data Processing Addendum](https://aws.amazon.com/compliance/gdpr-center/) available to all AWS customers;
- explicit consent under [Article 49](https://gdpr-info.eu/art-49-gdpr/) for research deposits, as above.

NEMAR data is therefore hosted in the United States lawfully,
and a European mirror is a performance question, not a compliance one.

## User accounts

The personal data NEMAR itself controls is its user account records:
name, email address, and the profile fields described in the
[Privacy Policy](/policies/privacy/).
For users in the European Union, we honor the GDPR data subject rights
(access, rectification, erasure, objection) as described there.
Requests go to privacy@nemar.org.

## References

- [GDPR full text](https://gdpr-info.eu/) (unofficial consolidated version)
- [Recital 26: anonymous data](https://gdpr-info.eu/recitals/no-26/)
- [Article 4: definitions of personal data and pseudonymisation](https://gdpr-info.eu/art-4-gdpr/)
- [Chapter V: transfers to third countries](https://gdpr-info.eu/chapter-5/)
- [Article 49: derogations for specific situations](https://gdpr-info.eu/art-49-gdpr/)
- [European Data Protection Board guidelines](https://www.edpb.europa.eu/our-work-tools/general-guidance/guidelines-recommendations-best-practices_en)
- [EU-US Data Privacy Framework](https://www.dataprivacyframework.gov/)
- [AWS GDPR Center](https://aws.amazon.com/compliance/gdpr-center/)
- [Open Brain Consent, GDPR edition](https://open-brain-consent.readthedocs.io/en/stable/gdpr/ultimate_gdpr.html)
