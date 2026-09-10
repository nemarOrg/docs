---
title: CLI vs the web
description: The CLI and the web app are the two surfaces a person uses to do dataset work. They share one backend, accounts, and datasets. Here is when to use each.
---

The **web app** ([nemar.org](https://nemar.org)) and the **[CLI](/cli/)** are the two surfaces a
person uses to do dataset work. They share the same backend, the same accounts, and the same
datasets, but each is optimized for a different workflow.

This page compares those two in depth.
NEMAR has three more surfaces that are not aimed at a person clicking or typing: the backend API,
the Zarr serving copy, and the Model Context Protocol (MCP) server.
For the whole set, and which one a given task calls for, see
[Which surface should I use?](/ecosystem/which-surface/).

## What the web is best for

- **Signing up.** Sign in with ORCID (Open Researcher and Contributor ID) or a one-time email code at [nemar.org/login](https://nemar.org/login);
  a first ORCID sign-in creates your account as part of that flow, no separate form and no admin review.
  ORCID is the one identity root for both surfaces: the CLI's `nemar auth login` / `nemar auth signup` open a browser to the same
  ORCID sign-in, at `app.nemar.org/cli/authorize`, and land on the same account either way.
  See [Getting started on the web](/web/getting-started/).
- **Browsing and exploring.** [Discover](https://nemar.org/discover), dataset detail pages,
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

Many researchers use the web for sign-in, discovery, and publication review, then reach for the
CLI when they need to script something. Same account, same datasets, same permissions; switching
back and forth is fine.

## Accounts and permissions

The CLI and the web share state through the same backend. Signing in on the web issues a
cookie-backed session; signing in on the CLI opens a browser to that same sign-in and, once you
confirm, issues an API key instead, named for the machine it was minted on. A laptop and a
compute cluster can each hold their own live key for the same account at once; manage the whole
set with `nemar auth keys` (see [Authentication](/cli/getting-started/authentication/)). Both
surfaces honor the same admin role, dataset ownership, and collaborator permissions.

```bash
# Quick start with the CLI (see the full guide under CLI > Getting Started)
nemar auth login          # sign in with your browser
nemar dataset list --mine # show your datasets
nemar dataset upload ./my-dataset
```

See [Installation](/cli/getting-started/installation/) for the full CLI setup.
