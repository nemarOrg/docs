---
title: "Admin"
description: "The gated section: operations runbooks, disaster recovery playbooks, the generated admin command reference, and the GitHub App setup."
pagefind: false
---

This is the operator's half of the NEMAR documentation.
The pages below are the procedures an administrator follows on a live system:
minting and scoping credentials, processing the upload-access queue,
restoring a dataset that should never have been deleted,
and looking up the exact spelling of a `nemar admin` subcommand.

Everything under `/admin/` is gated.
Reaching this page means you presented a NEMAR session whose account carries the `admin` role;
`users.role` in the platform database is the only source of truth for that,
so there is no second allowlist to keep in step.
Because the platform session cookie is scoped to the web app and never travels to this host,
signing in is a handoff: this site sends you to `app.nemar.org` to prove the session,
and takes back a short-lived code it trades for a cookie of its own.
An account without the role gets a 404 here rather than a 403, matching the website's behavior.

:::caution
Gated is not secret.
This repository is public, so every page below is readable on GitHub by anyone who looks.
The gate keeps operational procedures out of the reader's way and out of search results;
it is not a place to put anything whose disclosure would matter.
Credential values, webhook payload contracts, and observability internals belong in the
`nemar-cli` repository, not on this site, even here.
:::

## Operations

Day-to-day administration of accounts, credentials, and the serving copies.

- [Access Policies](/admin/operations/access-policies/): who can do what, from where, with which key.
  The six credential principles and the catalog of scoped AWS IAM users, with their inline policies
  and where each key is deployed. Read this before minting, rotating, or re-scoping any key.
- [Account Tiers and Upload Access](/admin/operations/account-tiers/): the pending, verified, and
  approved states, and the commands around them: `nemar admin approve` and `revoke`, the
  `users` filters that show the approval queue, duplicate-account cleanup, and the one-time
  name and username backfills.
- [Account Kinds](/admin/operations/account-kinds/): `person`, `service`, and `test` as an axis
  separate from role. Who may set a kind, the typed refusals, why a service account cannot sign in
  interactively, and how its keys are minted instead.
- [Zarr serving copy](/admin/operations/zarr-serving/): the serving side of the derived Zarr stores.
  How a merged dataset pull request ends as an updated store, the S3 layout, the CORS and
  visibility rules at `zarr.nemar.org`, and the checks to run when a store is stale or the viewer
  fails. The consumer-facing contract is public, at [Zarr and edge access](/platform/zarr/).
- [Manifest summary.json backfill](/admin/operations/manifest-summary-backfill/): a single
  catch-up task for the handful of datasets published before the central manifest workflow emitted
  `summary.json`. Safe to re-run; dry run first.

## Disaster recovery

What to open when data is already gone. Start with the section index, which has the two-minute
version at the top.

- [Overview](/admin/disaster-recovery/): the emergency quick start, the scripts, and the account of
  the incident these documents were written after.
- [Disaster Recovery Guide](/admin/disaster-recovery/disaster-recovery/): the numbered emergency
  playbook, from staging the restore tooling through assessing what survived in S3, GitHub, and the
  database, to verifying a restored dataset clones for an end user. Follow it in order rather than
  reading it through first.
- [Restoration Guide](/admin/disaster-recovery/restoration-guide/): the long technical companion.
  What a preservation archive does and does not carry back, then each restoration step by hand,
  for when the script fails or you need to understand what it did.
- [Backend Fail-Safes Against Dataset Deletion](/admin/disaster-recovery/future-fail-safes/): the
  shipped guards on the deletion path, and the scheduled-cleanup rules. The short answer to "what
  stops a dataset from being deleted?" without reading the full guide.
- [User Roles and Responsibilities](/admin/disaster-recovery/user-roles/): the operational
  identities (owner, admin, restore operator), what each is allowed to do, and which one performs a
  given step during recovery or onboarding.

## Command reference

- [admin](/admin/commands/): every `nemar admin` command, generated from `nemar admin --help-all`.
  A flag reference, not a procedure: the runbooks above say when to run these. Regenerate it with
  `bun run gen:commands` after a CLI change rather than editing it.

## Platform setup

- [GitHub App setup](/admin/github-app-setup/): creating and verifying the publish bot App that the
  Worker authenticates as, its exact permission set and webhook, the two distinct webhook secrets,
  and the acceptance checks. Open it when standing up App authentication, rotating those secrets, or
  diagnosing version DOIs that never mint.
