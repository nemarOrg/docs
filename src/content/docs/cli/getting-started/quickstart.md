---
title: "Quick Start"
---

Get up and running with NEMAR CLI in 5 minutes.

## 1. Sign Up

Create a NEMAR account:

```bash
nemar auth signup
```

You'll be prompted to enter:
- Username
- Email address
- Password (min 12 characters)
- GitHub username
- ORCID iD (required: it's how NEMAR gets your name for DOI citation; backs at most one NEMAR account)
- City (required for export-control screening)
- Country (required for export-control screening)
- Description of why you need access

:::note[Verify your email]
After signing up, click the link in the verification email. That's it, no admin review, no waiting: verifying your email unlocks your API key, the dashboard, and sandbox training right away.
:::
## 2. Retrieve Your API Key

Once your email is verified, retrieve your API key using your email and password:

```bash
nemar auth retrieve-key
```

:::caution[Save Your Key]
The API key is only shown once. Store it securely.
:::
## 3. Log In

```bash
nemar auth login
# Enter your API key when prompted

# Or provide it directly
nemar auth login -k nemar_your_api_key_here
```

## 4. Complete Sandbox Training

Before uploading real datasets, complete sandbox training:

```bash
nemar sandbox
```

This verifies your git-annex and GitHub setup by uploading a small test dataset. It needs only a verified email, no admin action.

## 5. Request Upload Access

Uploading a real dataset needs one more thing: a one-time admin grant. Ask for it once your username, name, GitHub handle, city, and country are set (see [Account settings](/web/account-settings/)):

```bash
nemar auth request-upload-access
```

You'll get an email once an admin grants it; check any time with `nemar auth status --refresh`. See [Upload access](/web/upload-access/) for what the review looks at.

## 6. Validate Your Dataset

Before uploading, validate your BIDS dataset:

```bash
nemar dataset validate ./my-dataset
```

Fix any errors before proceeding. Warnings are acceptable but should be reviewed.

## 7. Upload Your Dataset

Upload your validated dataset:

```bash
nemar dataset upload ./my-dataset
```

The dataset name defaults to the BIDS Name field in dataset_description.json (or the directory name as fallback).

## 8. Check Status

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
