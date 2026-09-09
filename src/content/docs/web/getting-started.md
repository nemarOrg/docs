---
title: "Getting started on the web"
---

NEMAR (Neuroelectromagnetic Data Archive and Resource) is where neuroscience teams archive, share, and process EEG, MEG, and iEEG datasets. This page walks you through the everyday flow: signing in, getting an account, and uploading your first dataset.

## Signing up

Creating a NEMAR account asks for your email, an ORCID, a GitHub handle, and a couple of consent confirmations. You can start in the browser or use the CLI:

```
bun install -g @nemar/cli
nemar auth signup
```

The CLI opens a browser tab for ORCID authorization, collects the rest, and submits your account for a short admin review. See [the sign-up page](https://nemar.org/signup) for the field-by-field breakdown. The browser and CLI share the same backend account.

## Signing in

At the [login page](https://nemar.org/login), enter your email and NEMAR sends a one-time code. After verification you land on your dashboard. No password is required. The CLI can use an API key for scripts and terminal workflows.

Uploads and publication requests unlock when your account is in the `active` state. The dashboard tells you which state you're in.

## The dashboard at a glance

Once signed in, the dashboard at `/dashboard` lists every dataset you own. Each card shows:

- The dataset name, modalities, and last-updated time
- A status badge: **Draft**, **Awaiting review**, **Published**, **Denied**, or **Validation failed**
- Quick actions: view detail, manage collaborators, request publication, or delete (drafts only)

## Uploading your first dataset

Click **Upload dataset** in the top navigation. Drop your BIDS-formatted folder onto the page or use the file picker. NEMAR runs a quick pre-check, walks you through any issues it finds, and creates the dataset entry while your files transfer to S3 in the background. See [Uploading a dataset](/web/uploading/) for the full walkthrough.

## Working with collaborators

Each dataset has a collaborators page at `/dataset/<id>/collaborators`. The owner (and any admin) can invite NEMAR users by username. Invited collaborators can push to the dataset's git repo and view it on the dashboard. See [Managing your datasets](/web/managing-datasets/) for details.

## When you're ready to publish

Datasets start private and stay that way until you click **Request publication**. An admin reviews the BIDS validation, checks the metadata, and either approves (which mints a DOI and makes the dataset public) or sends a denial with feedback you can address. See [Publication review](/web/publication-review/) for what to expect.

## Web or CLI?

Both work; most people use the web. The [CLI](/cli/getting-started/installation/) is a power-user tool for scripted publishes, git-annex parallel uploads, and server-side workflows. See [CLI vs the web](/ecosystem/cli-vs-web/) if you're weighing one against the other.
