---
title: "Account Access"
description: "nemar auth profile, nemar auth request-upload-access, and the Upload access line in nemar auth status."
---

Three account states apply to every NEMAR account: pending (email not verified), verified (the base tier — browse, dashboard, CLI API key, sandbox training), and approved (an admin granted upload access, once). See [Upload access](/web/upload-access/) for the full explanation; this page covers the CLI commands that show and request it.

## `nemar auth profile`

Prints every identifier on your account — username, name, email, GitHub username, ORCID iD (Open Researcher and Contributor ID) — with the verification state of your email and your ORCID link, your access tier, and whether upload access has been granted. Each line also says where to change it.

```bash
nemar auth profile
```

This always fetches from the server; it never reads the local config cache. Run it right before you change an identifier, since a cached answer is exactly the wrong thing to act on there.

Username and name are not yet editable from the CLI: the command tells you they are self-service in Settings on nemar.org instead. Everything else — email, GitHub handle, ORCID link — is also changed in Settings; see [Account settings](/web/account-settings/).

## `nemar auth request-upload-access`

Submits the one-time request an admin reviews to grant upload access.

```bash
nemar auth request-upload-access
nemar auth request-upload-access --why "Sharing our lab's 64-channel EEG study of motor imagery"
```

| Option | Description |
|--------|-------------|
| `--why <text>` | What you intend to upload, 20-500 characters. Prompted interactively if omitted. |

Your account needs a username, a given and family name, a GitHub username that exists, and a city and country before this can be submitted; see [Account settings](/web/account-settings/) to fill them in. If any are missing, the command lists exactly which ones and where to fix each:

```text
  Still needed:
    username — set it in Settings on nemar.org
    city — set it in Settings on nemar.org
```

Running the command again while a request is still open reports that you already have one open, rather than sending a second request. Once granted, you cannot request again — there is nothing left to ask for.

## `nemar auth status`'s Upload access line

`nemar auth status` (and its alias `nemar auth whoami`) prints an `Upload access` line alongside the rest of your cached account info:

```text
Upload access: granted
Upload access: not granted (one-time admin approval; see https://nemar.org/support)
```

This is read from the local cache by default, refreshed from the server whenever you run `--refresh`:

```bash
nemar auth status --refresh
```

An account that has never been refreshed since this field was introduced reports `unknown` rather than guessing — a stale "not granted" answer would send someone who already holds the grant off to ask for it again, which is worse than saying nothing.
