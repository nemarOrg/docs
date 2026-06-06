---
title: CLI vs the web
description: NEMAR has two surfaces, the CLI and the web app. They share one backend, accounts, and datasets. Here is when to use each.
---

NEMAR has two surfaces: the **web app** ([ww2.nemar.org](https://ww2.nemar.org)) and the
**[CLI](/cli/)**. They share the same backend, the same accounts, and the same datasets. The
difference is workflow style, not capability.

## What the web is best for

- **Signing up.** Web sign-in and sign-up are planned for **July 2026**; until then, create your
  account and authenticate with the CLI (`nemar auth signup` / `nemar auth login`).
- **Browsing and exploring.** [Discover](https://ww2.nemar.org/discover), dataset detail pages,
  READMEs, and the citation dashboard live there.
- **One-off uploads.** Drop a folder, walk through validation, request publication. No tooling
  to install.
- **Collaborator management.** Inviting and removing collaborators happens on the dataset's
  collaborators page.
- **Admin review.** The publication-request queue is web-only.

## What the CLI is best for

- **Scripted publishes.** CI pipelines that publish a dataset version when a tag is pushed.
- **Large / parallel uploads.** The CLI uses git-annex parallel transfers for very large
  datasets that would be tedious to drop in a browser.
- **Server-side workflows.** Running on a compute node or a shared lab server where the web UI
  isn't convenient.
- **Inspection and version checks.** Comparing local vs remote, viewing manifests, and so on.
- **Bulk operations.** Managing many datasets where shell scripting wins.

## You don't have to pick one

Most researchers use the web for sign-in, discovery, and publication review, and reach for the
CLI when they need to script something. Same account, same datasets, same permissions; switching
back and forth is fine.

## Accounts and permissions

The CLI and the web share state through the same backend. Signing in on the CLI issues a
long-lived API token tied to your account; signing in on the web issues a cookie-backed session.
Both honor the same admin role, dataset ownership, and collaborator permissions.

```bash
# Quick start with the CLI (see the full guide under CLI > Getting Started)
nemar auth login          # authenticate with your API key
nemar dataset list --mine # show your datasets
nemar dataset upload ./my-dataset
```

See [Installation](/cli/getting-started/installation/) for the full CLI setup.
