---
title: NEMAR CLI
description: The command-line interface for managing NEMAR datasets. Install it, authenticate, then upload, validate, version, and download BIDS datasets.
---

The NEMAR CLI is the terminal client for the NEMAR platform. It wraps dataset validation,
git-annex + S3 data handling, GitHub metadata versioning, and DOI workflows behind a single
`nemar` command. It is one part of the [NEMAR ecosystem](/ecosystem/).

## Start here

- [Installation](/cli/getting-started/installation/): install with Bun and check your environment.
- [Quick Start](/cli/getting-started/quickstart/): sign up, verify your email, and upload your first dataset.
- [Authentication](/cli/getting-started/authentication/): sign in with your browser, the headless case, and a named key per machine.

## Guides

- [Uploading datasets](/cli/guides/uploading/)
- [BIDS validation](/cli/guides/validation/)
- [Downloading data](/cli/guides/downloading/)
- [Versioning](/cli/guides/versioning/)
- [Publishing](/cli/guides/publishing/)

## Reference

- [Command reference](/cli/commands/): generated from `nemar … --help-all`.
- [Configuration](/cli/reference/configuration/) and [Environment variables](/cli/reference/environment/).
- [Account Access](/cli/reference/account-access/): `nemar auth profile`, requesting upload access, and your access tier.
- [Debugging and Bug Reports](/cli/reference/debugging/): the `--debug` flag and filing an issue.
