---
title: "Publication review"
---

Publication review is how a private NEMAR dataset becomes a citable, public, archived resource. It's an admin-mediated step; this page explains what the admin checks and what to expect once you click **Request publication**.

## What "published" means

When a dataset is published, three things change:

- **Visibility.** The dataset moves from private to public; anyone can find it on [Discover](https://ww2.nemar.org/discover).
- **DOI.** A concept DOI is minted (via DataCite/Zenodo) so the dataset becomes citable. Each future version gets its own version DOI under the concept.
- **S3 lock.** Files are written under S3 Object Lock so they can't be tampered with after publication.

Publishing is irreversible by design, a published DOI cannot be retracted, only superseded. The confirmation dialog on the admin side requires typing `PUBLISH` for that reason.

## What the admin checks

- **BIDS validation.** Must pass against the current BIDS schema.
- **Metadata completeness.** `dataset_description.json` has `Authors`, `License`, and `HowToAcknowledge` populated.
- **HED tags (if present).** Events are validated against the current Hierarchical Event Descriptor schema.
- **Modality consistency.** The modality folders inside participants match what's declared.

## How long does review take?

Most reviews land within 1-2 business days. Submissions that pass on the first try move through quickly; the slower ones are usually waiting on a metadata fix or a re-upload after an HED tagging issue.

## If you're denied

A denial isn't the end of the road. The admin sends a reason (which appears on your dashboard card and goes to your email). Address the feedback, re-upload if needed, and click **Request publication** again. There's no penalty for multiple rounds.

## If BIDS validation is failing

The card shows **Validation failed** with a short error summary. The fix is almost always in your BIDS folder, not in NEMAR, the [BIDS validator](https://bids-standard.github.io/bids-validator/) can reproduce the error locally. Fix, re-upload, and the badge clears on the next validation pass.

## Getting cited

Once your dataset has a DOI, citations show up automatically in the [citation dashboard](https://dashboard.nemar.org/citations) as publications referencing it appear. NEMAR pulls citations from OpenAlex and DataCite Event Data.
