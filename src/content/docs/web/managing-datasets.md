---
title: "Managing your datasets"
---

The [dashboard](https://ww2.nemar.org/dashboard) is your home base. Every dataset you own appears there, sorted by most recently updated. This page is the dashboard tour in written form, handy if you dismissed the on-screen tour or want a reference.

## Reading a dataset card

Each card has four zones:

- **Header.** Dataset id, name, status badge, and modality tags.
- **Description.** The summary from `dataset_description.json`.
- **Facts.** Subjects, total size, version, DOI (when assigned), last update.
- **Actions.** View, collaborators, GitHub, and depending on state: request publication or delete.

## What the status badges mean

- **Draft.** Private, no review requested yet. You can edit, re-upload, or delete.
- **Awaiting review.** You've clicked **Request publication**; an admin will be in touch via email.
- **Published.** Public, has a DOI, listed on [Discover](https://ww2.nemar.org/discover) and indexed by the catalog.
- **Denied.** The admin sent feedback; address it and re-request.
- **Validation failed.** BIDS validation failed; fix and re-upload, then request again.

## Deleting a draft

Drafts are deletable from the card's footer. We require typing `DELETE` to confirm. Once a publication request is in flight (or the dataset is public), the delete button disappears, published datasets can only be retracted by an admin.

## Inviting collaborators

Click **Collaborators** on any dataset card. The page at `/dataset/<id>/collaborators` lists the current owner and collaborators. Owners and admins can invite new collaborators by NEMAR username. The invited user gets push access to the dataset's git repo immediately.

To remove a collaborator today, contact [admin@nemar.org](mailto:admin@nemar.org), per-dataset removal is being added in [nemar-cli#577](https://github.com/nemarOrg/nemar-cli/issues/577).

## When something looks off

- **A card vanished.** The dashboard sorts by recent activity; older datasets paginate. Use the search at [Discover](https://ww2.nemar.org/discover) if you can't find one quickly.
- **You can't click Request publication.** The button is hidden when the dataset is public, when a request is already in flight, or when BIDS validation is failing. The badge tells you which.
- **Your account is pending.** Most actions are locked until an admin approves your account; this usually takes <1 business day.
