---
title: "Publication review"
---

Publication review is how a private NEMAR dataset becomes a citable, public, archived resource. It's an admin-mediated step; this page explains what the admin checks and what to expect once you click **Request publication**.

## What "published" means

When a dataset is published, three things change:

- **Visibility.** The dataset moves from private to public; anyone can find it on [Discover](https://nemar.org/discover).
- **DOI.** NEMAR mints a concept DOI in its `10.82901/NEMAR` namespace through EZID and publishes
  the associated DataCite metadata. Each future version gets its own version DOI under the concept.
- **S3 lock.** Files are written under S3 Object Lock so they can't be tampered with after publication.

The DOI identifier is permanent by design. If a dataset must later be withdrawn, NEMAR can restrict
the dataset and leave the DOI resolving to a tombstone rather than silently changing the released
state. The confirmation dialog on the admin side requires typing `PUBLISH` for that reason.

## What the admin checks

- **BIDS validation.** Must pass against the current BIDS schema.
- **Metadata completeness.** `dataset_description.json` has `Authors`, `License`, and `HowToAcknowledge` populated.
- **HED tags (if present).** Events are validated against the current Hierarchical Event Descriptor schema.
- **Modality consistency.** The modality folders inside participants match what's declared.

## How long does review take?

Review timing varies with the queue and with the fixes a submission needs. Submissions that pass on
the first try move through more quickly; others wait for a metadata fix or a re-upload.

## If you're denied

A denial isn't the end of the road. The admin sends a reason (which appears on your dashboard card and goes to your email). Address the feedback, re-upload if needed, and click **Request publication** again. There's no penalty for multiple rounds.

## If BIDS validation is failing

The card shows **Validation failed** with a short error summary. The fix is almost always in your BIDS folder, not in NEMAR, the [BIDS validator](https://bids-standard.github.io/bids-validator/) can reproduce the error locally. Fix, re-upload, and the badge clears on the next validation pass.

## Getting cited

Once your dataset has a DOI, use the DOI landing page and the version DOI in your own citations. Do
not treat the DOI as a promise that every downstream citation index will update immediately.
