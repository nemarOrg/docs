---
title: "Configuration"
description: "The config file location, the multi-account structure, the key fields a browser-minted key carries, and file permissions."
---

NEMAR CLI configuration and settings.

## Config File Location

| OS | Path |
|----|------|
| macOS | `~/.config/nemar/config.json` |
| Linux | `~/.config/nemar/config.json` |
| Windows | `~/.config/nemar/config.json` |

The CLI standardizes on `~/.config/nemar/config.json` for every platform.
On first run it performs a one-time migration: if a legacy `nemar-nodejs/config.json` exists at the old OS-native location
(`~/Library/Preferences/nemar-nodejs/` on macOS, `%APPDATA%\nemar-nodejs\` on Windows, or `~/.config/nemar-nodejs/` on Linux),
it is copied to the standardized path.
Set `NEMAR_CONFIG_DIR` to override the directory; see [Environment Variables](/cli/reference/environment/).

The file holds a live API key, so it is written owner-read-write only (`0600`), never group- or world-readable.
On non-Windows platforms, an older file a previous CLI version left at a looser default mode is migrated to `0600` the next time this CLI writes it.

## Config Structure

The config is multi-account: a top-level `activeAccount` names the account in use,
and the `accounts` map holds the per-account settings.

Each entry is keyed by NEMAR username, or, for a brand-new ORCID (Open Researcher and Contributor ID) account
that hasn't been assigned one yet, by email address; the CLI renames the entry to the username the moment the server reports one, on the next sign-in or `--refresh`.

```json
{
  "activeAccount": "johndoe",
  "accounts": {
    "johndoe": {
      "apiKey": "nemar_...",
      "apiUrl": "https://api.nemar.org",
      "username": "johndoe",
      "email": "john@example.com",
      "githubUsername": "johndoe",
      "sandboxCompleted": true,
      "sandboxDatasetId": "nm099999",
      "role": "member",
      "keySource": "device",
      "keyId": 42,
      "keyName": "johndoes-laptop",
      "keyCreatedAt": "2026-09-01T12:00:00.000Z"
    }
  }
}
```

A brand-new account signed in on the CLI but not yet assigned a username is keyed by email instead:

```json
{
  "accounts": {
    "ada@lab.example.org": {
      "apiKey": "nemar_...",
      "email": "ada@lab.example.org",
      "keySource": "device",
      "keyId": 7,
      "keyName": "ada-laptop",
      "keyCreatedAt": "2026-09-05T08:00:00.000Z"
    }
  }
}
```

### Key fields

Every account entry says how its current key was obtained:

| Field | Present when | Meaning |
|-------|---------------|---------|
| `keySource: "device"` | A browser-based `nemar auth login` minted this machine's key | Carries `keyId`, `keyName` (nullable), and `keyCreatedAt` too |
| `keySource: "paste"` | The key was supplied with `--key` or `NEMAR_API_KEY` | No `keyId`/`keyName`/`keyCreatedAt`; nothing was minted for this machine |
| (absent) | A password-era account, predating both paths | `nemar auth status` reports it as a password-era key |

`nemar auth status` reads these fields for its `Key:` line;
see [Authentication](/cli/getting-started/authentication/).

Use `nemar auth switch [username]` to change the active account.
The `apiUrl` field defaults to `https://api.nemar.org`;
the CLI rewrites any stored URL pointing at a retired backend to this default on startup.

## Precedence

1. Command-line flags
2. Environment variables
3. Config file
4. Defaults

## Managing Config

### View Config Location

```bash
nemar auth status
# Shows config path
```

### Clear Config

```bash
nemar auth logout
```

### Manual Edit

You can edit the config file directly, but using CLI commands is recommended.
