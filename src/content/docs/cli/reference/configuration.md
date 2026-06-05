---
title: "Configuration"
---

NEMAR CLI configuration and settings.

## Config File Location

| OS | Path |
|----|------|
| macOS | `~/.config/nemar/config.json` |
| Linux | `~/.config/nemar/config.json` |
| Windows | `~/.config/nemar/config.json` |

The CLI standardizes on `~/.config/nemar/config.json` for every platform. On first run it performs a one-time migration: if a legacy `nemar-nodejs/config.json` exists at the old OS-native location (`~/Library/Preferences/nemar-nodejs/` on macOS, `%APPDATA%\nemar-nodejs\` on Windows, or `~/.config/nemar-nodejs/` on Linux), it is copied to the standardized path. Set `NEMAR_CONFIG_DIR` to override the directory.

## Config Structure

The config is multi-account: a top-level `activeAccount` names the account in use, and the `accounts` map holds the per-account settings keyed by NEMAR username.

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
      "dismissedNoticeIds": []
    }
  }
}
```

Use `nemar auth switch [username]` to change the active account. The `apiUrl` field defaults to `https://api.nemar.org`; the CLI rewrites any stored URL pointing at a retired backend to this default on startup.

## Environment Variables

Environment variables override config file settings:

| Variable | Description |
|----------|-------------|
| `NEMAR_API_KEY` | API key for authentication |
| `NEMAR_API_URL` | API base URL (default: production) |

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
