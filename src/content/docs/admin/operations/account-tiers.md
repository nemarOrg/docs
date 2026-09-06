---
title: "Account Tiers and Upload Access"
description: "What nemar admin approve now grants, the users filters and tier column, duplicate-account cleanup, and the name/username backfills."
---

:::caution[Ships with nemar-cli epic #1250]
Everything on this page describes behavior in the `nemar-cli` account-tiers epic (issue [#1250](https://github.com/nemarOrg/nemar-cli/issues/1250)), not yet in a released CLI version. Confirm your CLI's version before relying on it; run `nemar admin --help-all` to see what your installed version actually supports.
:::

Three account states matter to admins: pending (email not verified — cannot be approved), verified (the base tier, needs no admin), and approved (an admin granted upload access, once). See [Upload access](/web/upload-access/) for the user-facing explanation.

## `nemar admin approve` grants upload access

Approving a user is now the single action that grants upload access; it is not a step that happens at sign-up or at email verification.

```bash
nemar admin approve <username>
nemar admin approve --id <id>          # web/ORCID accounts, which have no username
```

Approval is refused for an account whose email is not verified, whatever its sign-up source:

```text
User must verify their email address first; approval cannot skip the inbox check
```

An ORCID (Open Researcher and Contributor ID) sign-up no longer substitutes for that check: ORCID proves the person, the email code proves the inbox, and both are required before an account is approvable at all. `nemar admin users --pending` lists accounts still waiting on their own email confirmation; there is nothing for an admin to do for those until the user acts.

## `nemar admin revoke` voids an open request too

Revoking a user clears the upload-access grant and, in the same statement, any open upload-access request the account was holding. A revoked-then-reinstated account does not come back with an old request still sitting in the queue; it has to submit a new one from scratch, which is also why it drops out of `--awaiting-approval` the moment it's revoked rather than lingering there.

## `nemar admin users` filters and the tier column

```bash
nemar admin users --awaiting-approval    # accounts with an open upload-access request
nemar admin users --no-upload-access     # every account without the upload grant, requested or not
```

`--awaiting-approval` means exactly what it says: a **verified** account that submitted an upload access request and has not yet been granted it — a pending or revoked account cannot have an open request, so this filter never surfaces one. `--no-upload-access` is the wider set — every account without the grant, whether or not anyone has asked for one.

Each row also reports a tier:

| Tier | Meaning |
|------|---------|
| `browse` | Base tier: browse, dashboard, settings. No upload access. |
| `upload` | An admin granted upload access; `nemar admin approve` is the grant. |
| `unknown` | The API reported no tier for this account — a backend older than the tier split, or a rolling deploy. |

## `nemar admin duplicates`

Reports live accounts that share an ORCID iD, an email address, or a GitHub handle — an identifier is meant to back exactly one account, and this is where a violation (existing before enforcement began, or one an admin needs to resolve) shows up.

```bash
nemar admin duplicates
nemar admin duplicates --json
nemar admin duplicates --clear <id>
```

The report groups colliding accounts, marks which one is canonical (the one that keeps the identifier), and shows what an admin actually needs to weigh: account age, dataset count, and whether the account can still sign in with the identifier in question.

This command never merges or deletes an account by itself. Its `--clear <id>` half only un-flags one account's identity-conflict flag, and only once the underlying collision is actually gone (for example, the other account already changed its email); it refuses with a 409 and the still-colliding rows otherwise. Resolving a real collision is the account holder's own Settings change (see [Account settings](/web/account-settings/)); merging two accounts that both need to keep their history is a manual, by-hand operation, not something this command does.

## `nemar admin backfill-names` and `nemar admin backfill-usernames`

Two accounts predate reading a name from ORCID at sign-up, or predate having a username at all (web and ORCID sign-ups left `username` `NULL`). Both backfills are dry-run by default and never send anything until you pass `--apply`.

```bash
nemar admin backfill-names               # dry run: what would be filled
nemar admin backfill-names --apply       # write given_name/family_name from each account's public ORCID record

nemar admin backfill-usernames           # dry run: what would be assigned
nemar admin backfill-usernames --apply   # assign a username derived from the name, and email a verification code
```

`backfill-names` reads each account's own public ORCID record and fills `given_name`/`family_name` only when both parts are published there; an account whose ORCID record publishes only one part is reported as `no_public_name` and left alone; nothing is guessed.

`backfill-usernames` derives a username from an account's given and family name (first initial plus family name, ASCII-folded and lowercased, with `-2`/`-3` appended on a collision) and, for every account it actually assigns one to, sends that person a single verification-code email so they can sign in and use it. An account with only one name part on record is reported as `single_name` and skipped — run `backfill-names` first. Each run also retries the verification email for any *previously assigned* account whose message never went out, reported separately from the current batch's assignments so a failed send doesn't quietly stay failed.

Neither backfill derives anything from an email address: a handle or a name nobody chose is worse than a row left for a human.

## Run both backfills once after this release

Once the release that ships this epic is live, run:

```bash
nemar admin backfill-names --apply
nemar admin backfill-usernames --apply
```

in that order — usernames are derived from names, so running them the other way round leaves every currently-nameless account without a username on the first pass. This is a one-time catch-up for the accounts that predate ORCID name capture and username assignment at sign-up; there is no cron for either; a fresh account is named and usernamed as normal at sign-up from this release forward, and needs neither.
