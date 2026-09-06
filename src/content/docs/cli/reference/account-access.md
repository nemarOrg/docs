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

Today, every identifier is still self-service in Settings on nemar.org only; see [Account settings](/web/account-settings/). CLI subcommands for changing them directly are shipping in the same release; see [Changing identifiers from the CLI](#changing-identifiers-from-the-cli) below.

## Changing identifiers from the CLI

:::note[Shipping in the same release — nemar-cli#1266]
This is not yet merged as of this writing. Command names below are final; flags may still shift during review. Until it ships, change these identifiers in Settings on nemar.org instead (see [Account settings](/web/account-settings/)).
:::

`nemar auth profile` gains subcommands that make every identifier it displays editable from the CLI, with the same rules and refusals Settings already enforces:

| Command | What it does |
|---------|--------------|
| `nemar auth profile set-email <address>` | Start an email change: sends a verification code to the new address. |
| `nemar auth profile verify-email <code>` | Confirm the code and complete the change. Your old address gets a notification that your account email changed, so you'd notice a change you didn't make. |
| `nemar auth profile set-github <handle>` | Change your GitHub handle. Validated against GitHub the same way Settings validates it; a GitHub outage answers "try again," not "handle not found." |
| `nemar auth profile set-username <name>` | Set or change your username. A first assignment (you have none yet) works at any tier; changing an existing username is refused once you hold upload access. |
| `nemar auth profile set-name --given <given> --family <family>` | Set your given and family name. Refused while a verified ORCID iD is linked, since your name is read from ORCID on every sign-in. |
| `nemar auth profile set-location --city <city> --country <country>` | Set your city and country. |
| `nemar auth profile orcid link` / `relink` / `unlink` | Link, re-link, or unlink your ORCID iD. `link` and `relink` open a browser for the ORCID authorization step and hand back control once it completes; `unlink` is immediate and clears the iD from your account. |

Each command prints the same typed refusal message the backend returns — the same wording you'd see from Settings — plus where else the change can be made, so a CLI refusal never reads differently from a web one.

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

Running the command again while a request is still open reports that you already have one open, rather than mailing a second one — unless the first email never reached an admin, in which case the repeat call retries that notification instead of doing nothing. Once granted, you cannot request again — there is nothing left to ask for.

If your upload access is later revoked, the open request (or the grant) is cleared along with it; requesting again after that starts a fresh request, not a re-opened old one.

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
