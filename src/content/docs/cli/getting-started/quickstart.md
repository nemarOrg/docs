---
title: "Quick Start"
description: "Sign in with your browser, complete sandbox training, request upload access, then validate and upload your first dataset."
---

Get up and running with the NEMAR CLI in a few minutes.

## 1. Sign In

```bash
nemar auth login
```

This opens your browser to NEMAR's sign-in page and prints a link and a code either way.
On a headless machine (a cluster, a container, an SSH session with no display), that link is the whole mechanism, not a fallback:
copy it into a browser anywhere, sign in with ORCID (Open Researcher and Contributor ID), confirm, and the terminal finishes on its own.
See [Authentication](/cli/getting-started/authentication/) for the full walk-through.

If this is a brand-new account, run `nemar auth signup` instead:
it signs in the same way, then asks only what's still missing (a username, your GitHub handle, city, and country),
and ends by requesting upload access for you, covering step 3 below.

```bash
nemar auth signup
```

:::note
Already have a password-era account? `nemar auth retrieve-key` and `nemar auth regenerate-key` still work but are deprecated in v0.10.0 and removed in the next release. `nemar auth login` replaces both.
:::

## 2. Complete Sandbox Training

Before uploading real datasets, complete sandbox training:

```bash
nemar sandbox
```

This verifies your git-annex and GitHub setup by uploading a small test dataset.
It needs only a signed-in, verified account, no admin action.

## 3. Request Upload Access

Uploading a real dataset needs one more thing: a one-time admin grant.
`nemar auth signup` already asked for this unless you passed `--no-upload-access`;
if you signed in with `nemar auth login` instead, or skipped it, ask once your username, name, GitHub handle, city, and country are set (see [Account settings](/web/account-settings/)):

```bash
nemar auth request-upload-access
```

You'll get an email once an admin grants it;
check any time with `nemar auth status --refresh`.
See [Upload access](/web/upload-access/) for what the review looks at.

## 4. Validate Your Dataset

Before uploading, validate your BIDS dataset:

```bash
nemar dataset validate ./my-dataset
```

Fix any errors before proceeding. Warnings are acceptable but should be reviewed.

## 5. Upload Your Dataset

Upload your validated dataset:

```bash
nemar dataset upload ./my-dataset
```

The dataset name defaults to the BIDS Name field in dataset_description.json (or the directory name as fallback).

## 6. Check Status

Monitor your dataset:

```bash
nemar dataset status nm000104
```

## Common Workflows

### Download a Dataset

```bash
# Download a dataset (includes data files)
nemar dataset download nm000104

# Or clone without data files
nemar dataset clone nm000104

# Get specific data files later
nemar dataset get sub-01/
```

### List Your Datasets

```bash
nemar dataset list --mine
```

### Create a New Version

After making changes, create a version bump PR:

```bash
nemar dataset release nm000104 --type minor
```

## Need Help?

```bash
# General help
nemar --help

# Command-specific help
nemar dataset --help
nemar dataset upload --help
```
