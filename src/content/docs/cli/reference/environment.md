---
title: "Environment Variables"
description: "NEMAR_API_KEY, NEMAR_NO_BROWSER, NEMAR_CONFIG_DIR, NEMAR_DEBUG, and NEMAR_NO_UPDATE_CHECK, plus how to authenticate a CI runner."
---

Environment variables for NEMAR CLI configuration.

## Authentication

| Variable | Description |
|----------|-------------|
| `NEMAR_API_KEY` | An API key to use with `nemar auth login`, as an alternative to `--key`. Read only by `nemar auth login`; no other command consults it, so a script or CI job must run `login` once before anything else. |
| `NEMAR_NO_BROWSER` | Set to `1` to never try opening a local browser during `nemar auth login`/`nemar auth signup`. Same effect as `--no-open`; useful on a headless host where attempting to open a browser is pointless rather than merely unnecessary. |

## General

| Variable | Description |
|----------|-------------|
| `NEMAR_CONFIG_DIR` | Overrides the config directory (default `~/.config/nemar`). See [Configuration](/cli/reference/configuration/). |
| `NEMAR_DEBUG` | Set to `1` to write a diagnostic log for the run, same as `--debug`. Redacts credentials before anything is written; attach the log to a bug report. |
| `NEMAR_NO_UPDATE_CHECK` | Set to `1` to disable the npm-registry check for a newer CLI version. |

## Usage Examples

### Signing in with a pasted key

```bash
export NEMAR_API_KEY=nemar_your_key_here
nemar auth login
```

`nemar auth login` validates the key with the backend and stores it; every other command then reads it from the config file, not from the environment.

### In Scripts

```bash
#!/bin/bash
export NEMAR_API_KEY=nemar_your_key_here
nemar auth login
nemar dataset upload ./data
```

### With dotenv

Create a `.env` file (don't commit this!):

```
NEMAR_API_KEY=nemar_your_key_here
```

Then:

```bash
source .env
nemar auth login
nemar auth status
```

## CI/CD Usage

Mint a key for the runner first, from a machine that can sign in:

```bash
nemar auth keys create ci-runner
```

Store the printed key as a secret, then sign in with it before any other command in the job:

### GitHub Actions

```yaml
jobs:
  upload:
    steps:
      - name: Sign in
        env:
          NEMAR_API_KEY: ${{ secrets.NEMAR_API_KEY }}
        run: nemar auth login --key "$NEMAR_API_KEY"
      - name: Upload dataset
        run: nemar dataset upload ./data
```

Leave the runner's key alone rather than logging out at the end of the job:
`nemar auth logout` on a runner clears the credential locally, and a pasted key is not revoked by default (it may be shared with other machines);
revoke it deliberately with `nemar auth keys revoke` when the runner is retired.

## Security

:::caution[Never Commit Secrets]
- Add `.env` to `.gitignore`
- Use secret management in CI/CD
- Rotate keys if exposed: mint a new one with `nemar auth keys create <name>` and revoke the old one with `nemar auth keys revoke <id>`
:::
