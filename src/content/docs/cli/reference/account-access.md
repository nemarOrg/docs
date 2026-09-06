---
title: "Account Access"
description: "nemar auth profile, nemar auth request-upload-access, and the Upload access line in nemar auth status."
---

Three account states apply to every NEMAR account:
pending (email not verified), verified (the base tier: browse, dashboard, CLI API key, sandbox training), and approved (an admin granted upload access, once).
See [Upload access](/web/upload-access/) for the full explanation;
this page covers the CLI commands that show and request it.

## `nemar auth profile`

Prints every identifier on your account:
username, name, email, GitHub username, ORCID iD (Open Researcher and Contributor ID), with the verification state of your email and your ORCID link, your access tier, and whether upload access has been granted.
Each line also says where to change it.

```bash
nemar auth profile
```

This always fetches from the server;
it never reads the local config cache.
Run it right before you change an identifier,
since a cached answer is exactly the wrong thing to act on there.

Every identifier is self-service, in Settings on nemar.org (see [Account settings](/web/account-settings/)) and, once the epic below ships, from the CLI directly;
see [Changing identifiers from the CLI](#changing-identifiers-from-the-cli) below.

Below the identifiers, `nemar auth profile` also prints a **Profile** block:
one line per field your account is still missing, in the same wording Settings and a refused upload-access request use.
See [What your profile still needs](#what-your-profile-still-needs).

## Changing identifiers from the CLI

:::caution[Ships with nemar-cli epic #1250]
Everything in this section describes behavior in the `nemar-cli` account-tiers epic (issue [#1250](https://github.com/nemarOrg/nemar-cli/issues/1250)),
not yet in a released CLI version.
Confirm your CLI's version before relying on it;
run `nemar auth profile --help-all` to see what your installed version actually supports.
Until it ships, change these identifiers in Settings on nemar.org instead (see [Account settings](/web/account-settings/)).
:::

`nemar auth profile` has subcommands that make every identifier it displays editable from the CLI,
through the same handler and the same rules Settings uses.
The only difference is the credential:
a bearer API key here, Settings' session cookie there.

| Command | What it does |
|---------|--------------|
| `nemar auth profile set-email <address>` | Start an email change: sends a verification code to the new address. |
| `nemar auth profile verify-email <code>` | Confirm the code and complete the change. Add `--email <address>` if you started more than one change and need to say which address the code went to; otherwise it defaults to the last one you requested. Your old address gets a notification naming the new one (masked, e.g. `a******@lab.org`), so you'd notice a change you didn't make. That notice is best-effort; it never blocks a change that already landed. |
| `nemar auth profile set-github <handle>` | Change your GitHub handle. Validated against GitHub the same way Settings validates it; a GitHub outage answers "try again," not "handle not found." |
| `nemar auth profile set-username <name>` | Set or change your username. A first assignment (you have none yet) works at any tier; changing an existing username you already hold is refused once an admin has approved your account. |
| `nemar auth profile set-name --given <name> --family <name>` | Set your given and family name. Refused while a verified ORCID iD is linked, since your name is read from ORCID on every sign-in. |
| `nemar auth profile set-location --city <city> --country <country>` | Set your city and country. |
| `nemar auth profile orcid <link\|relink\|unlink>` | Link, re-link, or unlink your ORCID iD. `link` and `relink` print a URL and try to open it in a browser (`--no-open` prints the URL only), then poll your account until the iD appears or `--timeout <seconds>` runs out (default 300); a headless machine just needs the URL copied elsewhere. `unlink` is immediate (confirm with `-y`, decline with `-n`) and clears the iD from your account. |

Each command prints the same typed refusal message the backend returns,
the same wording you'd see from Settings,
plus where else the change can be made,
so a CLI refusal never reads differently from a web one.

### ORCID linking is a signed, account-bound handoff

`nemar auth profile orcid link` and `relink` cannot show you ORCID's consent screen in a terminal,
so the CLI opens your browser to a NEMAR page instead of ORCID directly.
That page names your account (username and masked email) before it continues to ORCID,
and a browser signed in to a *different* NEMAR account is refused there rather than silently linking the wrong one.
The link it opens is single-use:
reusing an old link (from shell history or a log) is refused rather than replayed.

### Refusal codes you might see

Settings and these CLI commands enforce [one person, one account](/web/account-settings/#one-person-one-account) (ADR 0043) and username uniqueness.
A refusal names a code and a sentence;
the sentence is what prints, but the code is stable if you're scripting against it:

| Code | Means | Fix |
|------|-------|-----|
| `email_in_use` | That email address already backs another live NEMAR account. | Sign in to that account instead, or change its email first; see [If you already created two accounts](/web/account-settings/#if-you-already-created-two-accounts). |
| `github_in_use` | That GitHub handle already backs another live NEMAR account. | Sign in to that account instead, or change its GitHub handle first. |
| `orcid_in_use` | That ORCID iD already backs another live NEMAR account. | Sign in to that account instead; unlink the iD there first if you want it on this one. |
| `identity_conflict_remains` | An admin tried to clear this account's identity-conflict flag, but the collision that caused it is still there. | Resolve the collision on the other account first (change its email or GitHub handle, or unlink its ORCID iD), then ask the admin to clear the flag. |
| `username_taken` | Someone else already holds that username (compared without regard to case). | Pick a different username; this isn't an identity conflict, just a name already in use. |

Every one of these is the self-service fix on the account you're keeping, never a merge.
Moving datasets, DOIs (Digital Object Identifiers), or collaborator access between two accounts' owners is a manual admin operation;
see [One person, one account](/web/account-settings/#one-person-one-account).

## `nemar auth request-upload-access`

Submits the one-time request an admin reviews to grant upload access.

```bash
nemar auth request-upload-access
nemar auth request-upload-access --why "Sharing our lab's 64-channel EEG study of motor imagery"
```

| Option | Description |
|--------|-------------|
| `--why <text>` | What you intend to upload, 20-500 characters. Prompted interactively if omitted. |

Your account needs a username, a given and family name, a GitHub username that exists, and a city and country before this can be submitted;
see [Account settings](/web/account-settings/) to fill them in.
If any are missing, the command lists exactly which ones,
in the same wording `nemar auth profile` and Settings use for the same gap:

```text
  Finish these first:
    Username is missing: needed to request upload access. Set it in Settings or run `nemar auth profile set-username`.
    City is missing: needed to request upload access. Set it in Settings or run `nemar auth profile set-location`.

  Settings: https://nemar.org/settings
```

Running the command again while a request is still open reports that you already have one open,
rather than mailing a second one,
unless the first email never reached an admin,
in which case the repeat call retries that notification instead of doing nothing.
Once granted, you cannot request again.
There is nothing left to ask for.

If your upload access is later revoked,
the open request (or the grant) is cleared along with it;
requesting again after that starts a fresh request, not a re-opened old one.

## What your profile still needs

`nemar auth status` and `nemar auth profile` both print a **Profile** block:
one sentence per field your account is missing, each naming exactly what it blocks and where to fix it.
That is the identical list and identical wording a refused `nemar auth request-upload-access` and the website's Settings and dashboard use,
because all of them read the same computed list off your account (`profile_gaps`, epic #1250 phase 8).
Nothing is missing from one surface and present on another.

```text
Profile
  GitHub handle is missing: needed to request upload access. Set it in Settings or run `nemar auth profile set-github`.
```

`nemar auth profile` always fetches this live.
`nemar auth status` prints it from the local cache, refreshed with `--refresh`.
Like the Upload access line, it is honest about not knowing:
an account that has never refreshed shows `not checked — run 'nemar auth status --refresh'` rather than an empty (and misleadingly reassuring) list,
and a refresh that fails reports the same rather than showing yesterday's list as current.

Sandbox training (`nemar sandbox`) appears in this same block when it isn't done yet, but only here.
It is a CLI-only step with no equivalent in Settings,
so it never appears in a web-side gap list or in an upload-access refusal.

### Coming: a verified ORCID iD will also be a gap

:::note[Planned, not yet shipped: nemar-cli#1271]
Not yet implemented at this writing;
the spec is settled but the code isn't merged.
Once it ships,
a **regular** account without a verified ORCID iD will see it listed as a gap blocking the upload access request,
fixed with `nemar auth profile orcid link` (or "Connect your ORCID" in Settings).
Admin and owner accounts are exempt for now.
This doesn't change CLI signup, which already collects and verifies an iD;
it only affects accounts that skipped or never verified one.
A web account always has a verified iD already,
because signing in with ORCID is the only way a web account is created.
:::

## `nemar auth status`'s Upload access line

`nemar auth status` (and its alias `nemar auth whoami`) prints an `Upload access` line alongside the rest of your cached account info:

```text
Upload access: granted

Upload access: not granted
    A one-time admin grant. Reviewed against export-control and local-jurisdiction rules.
    Ask for it with `nemar auth request-upload-access`.
```

This is read from the local cache by default, refreshed from the server whenever you run `--refresh`:

```bash
nemar auth status --refresh
```

An account that has never been refreshed since this field was introduced reports `unknown` rather than guessing:
a stale "not granted" answer would send someone who already holds the grant off to ask for it again,
which is worse than saying nothing.
