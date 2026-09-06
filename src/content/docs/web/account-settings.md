---
title: "Account settings"
description: "Change your email, GitHub handle, and ORCID link, choose a username and name, and what one person, one account means for you."
---

Settings on [nemar.org](https://nemar.org/settings) is where you manage the identifiers on your NEMAR account: your email, your GitHub handle, your ORCID iD (Open Researcher and Contributor ID), your username, and your name.
Everything on this page is self-service; nothing here needs an admin.

The CLI (command-line interface) can show you the same identifiers with `nemar auth profile`, each with a note on where to change it.
Once the epic that adds it ships, it can change them directly, too, with subcommands under `nemar auth profile`; see [Changing identifiers from the CLI](/cli/reference/account-access/#changing-identifiers-from-the-cli).

## Change your email

Enter the new address in Settings.
NEMAR sends a verification code to that new address, not the old one, so you have to be able to read mail there before the change takes effect.
Enter the code on the same page to confirm it.

An email address (compared without regard to case, so `Ada@lab.org` and `ada@lab.org` count as the same address) can back only one NEMAR account.
If the address you want is already attached to another account, the change is refused; see [One person, one account](#one-person-one-account) below.

## Change your GitHub handle

Enter the new handle in Settings.
NEMAR checks that the handle actually exists on GitHub before accepting it; if GitHub itself is briefly unreachable when you save, NEMAR tells you to try again rather than claiming the handle doesn't exist.
A GitHub handle can also back only one NEMAR account, so a handle already attached elsewhere is refused.

Your GitHub handle is how collaborators are invited to your datasets and how NEMAR verifies you before adding you as a collaborator on someone else's, so keep it current if you change GitHub accounts.

## Link, re-link, or unlink your ORCID iD

Linking ORCID (Open Researcher and Contributor ID) ties your NEMAR account to your public researcher record, and is how NEMAR reads your name for dataset citation (see [Your name](#your-name) below).

- **Link.** From Settings, start the ORCID authorization flow and approve it on orcid.org. This is only ever started by a click, never by loading a page, so nothing gets linked by accident.
- **Re-link.** Use this if your ORCID record has changed (for example, your name became public) and you want NEMAR to re-read it. Re-linking cannot take an iD away from another account: if the iD you authorize is already linked elsewhere, the re-link is refused.
- **Unlink.** Removing the link clears both the iD and its verified status from your account. NEMAR does not keep a stale claim on an iD it can no longer prove. Linking again later re-attaches the same iD and re-reads your name from it.

An ORCID iD can back only one NEMAR account at a time, checked exactly (not case-insensitively, since a check-digit ORCID iD only ever differs in whether that digit is a lowercase or uppercase `X`, and NEMAR normalizes it to uppercase on every write).

## Choose or change your username

Settings suggests a default built from your name (your first initial plus your family name, for example `alovelace` for Ada Lovelace, with a number appended if that handle is already taken), but you can type your own instead. Occasionally there is no suggestion at all — you have no family name on record, or every variant of your default is already taken — and in that case the field is simply left for you to fill in by hand.

A username must be unique, compared without regard to case: `Ada` and `ada` are the same username as far as NEMAR is concerned.

If you never set a username while onboarding, NEMAR assigns you one automatically the next time you sign in on the web, using the same first-initial-plus-family-name rule, so your account can never be left with no handle at all — a username is what your datasets and DOIs are attributed to. You will see a one-time notice that a username was chosen for you, and can change it here until an admin grants your account upload access.

**The lock is on changing a username, not on having one.** If you don't have a username yet, you can set one for the first time whatever state your account is in, including after you're approved for upload access — this is what lets the accounts that predate usernames get one at all. What's locked, once you're approved, is changing a username you already have to a different one; re-saving your current username alongside other changes still works.

## Your name

Your given name and family name are what NEMAR cites you by on any DOI (Digital Object Identifier) minted for a dataset you deposit.
NEMAR never cites a DOI by your NEMAR username.

- **If you have a verified ORCID iD linked,** your name is read from your ORCID record every time you sign in, and Settings will not accept a typed edit; that keeps your NEMAR name and your ORCID record from drifting apart. If your ORCID record does not publish a name, make it public at orcid.org, then sign in again so NEMAR can re-read it.
- **If you have no ORCID iD linked,** you can type your given name and family name directly into Settings.

An account with only half a name set (a given name with no family name, or the reverse) is treated as having no citable name at all: it can neither be used for a DOI nor unlock upload access, so fill in both parts together.

## One person, one account

An ORCID iD, an email address, or a GitHub handle backs at most one live NEMAR account.
This is enforced by the database, not just by convention, so a sign-up or a link that would create a second account on any of the three is refused with a message telling you which identifier is already taken and where to fix it, rather than silently creating a duplicate.
The refusal carries a stable code alongside its sentence: `email_in_use`, `github_in_use`, or `orcid_in_use`, plus `identity_conflict_remains` if an admin tries to clear a flagged account before the underlying collision is actually gone.
See [Refusal codes you might see](/cli/reference/account-access/#refusal-codes-you-might-see) for the full table.
A username that is merely already taken (`username_taken`) is not one of these three; it just needs a different username, not an identifier freed up elsewhere.

### If you already created two accounts

1. **Decide which account to keep.** Usually that is the one that can already sign in with your ORCID iD, or the one that holds your datasets and collaborator access. If you are not sure, contact an admin.
2. **Free up the identifier on the other account.** On the account you are giving up, change its email address, change its GitHub handle, or unlink its ORCID iD in Settings, whichever one is blocking the account you want to keep.
3. **Ask an admin to merge them if it goes further than an identifier.** Moving datasets, DOIs, storage credentials, and collaborator access from one account's owner to another's is not self-service; it has to be done by hand, because a wrong merge cannot be undone. Reach an admin through [nemar.org/support](https://nemar.org/support) once the identifier conflict itself is resolved.
