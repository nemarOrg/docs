---
title: "Account Kinds"
description: "person, service, and test accounts: who sets a kind, the sign-in refusal, owner-minted keys, and the migrated operational accounts."
---

`users.account_kind` names what an account IS, not what it may do (ADR 0048).
Role (`owner`/`admin`/`member`) is a permission level and stays orthogonal to this;
an account's kind never changes because of its role.

## The three kinds

| Kind | Meaning |
|------|---------|
| `person` | A human's own account. The default: every existing row and every future sign-up is `person` unless an owner says otherwise. |
| `service` | Operational automation. No human signs in to it directly; its keys are minted by an owner with `nemar admin keys create`. |
| `test` | A human's secondary persona. Signs in and uploads exactly like a `person` account, but on production may only own `xx` sandbox datasets, never a real `nm` dataset. |

## Who sets a kind

Only an owner, with `nemar admin kind`:

```bash
nemar admin kind cool-vibers test      # mark a persona account
nemar admin kind nemarAdmin service    # mark an operational account
nemar admin kind cool-vibers person -y # revert (skip confirm)
```

Kinds are never inferred from role, email, or anything else.
A change can be refused with one of four typed codes (`{ error, message }`):

| Code | HTTP | Means |
|------|------|-------|
| `own_account` | 400 | You cannot change your own account kind; ask another owner. |
| `same_kind` | 409 | The account already has that kind. |
| `orcid_linked` | 409 | The account has a verified ORCID iD linked (see below). |
| `kind_changed_concurrently` | 409 | The account's kind changed between the read and the write; re-check and retry. |

## The ORCID exemption

A verified ORCID (Open Researcher and Contributor ID) iD identifies a person: an account with one already proven blocks a move to `service`/`test`, refused with `orcid_linked`:

```text
An ORCID iD identifies a person, and this account has one verified and linked. Run `nemar auth profile orcid unlink` on that account first, then retry.
```

Moving `person` to `service`/`test` is fine for an account with no verified iD linked;
unlink first (Settings, or `nemar auth profile orcid unlink`) if one is already there.
Conversely, `service`/`test` accounts are exempt from the "you need a verified ORCID iD" gap that blocks a `person` account's upload-access request:
the exemption is by kind, not by role, so an admin who happens to hold a verified iD is no longer exempt from linking one.

## The device-flow refusal

A `service`/`test` account cannot sign in through the browser at all.
`nemar auth login`/`nemar auth signup` and the self-service `POST /auth/keys` mint both refuse it:

```text
This is a service or test account, and it cannot sign in this way. Ask an owner to create a key for it with `nemar admin keys create`.
```

One refusal code, `service_account`, covers both kinds: from the sign-in side, "a service account" and "a test persona" are the same fact, a human is not meant to sign in this way.

## Owner-minted keys

Since a `service`/`test` account cannot sign in to mint its own key, an owner mints one for it instead:

```bash
nemar admin keys create <username> <name>   # mint a key for a service/test account
nemar admin keys list <username>             # list a target account's live keys
nemar admin keys revoke <username> <id>      # revoke one of a target account's keys
```

This mint runs in the opposite direction from every other key route: it refuses a `person` target (`person_account`), because a person creates their own keys by signing in, and it is the only path that can mint one for `service`/`test`.
Listing and revoking work for any kind; those are administrative record-keeping, not a liveness question.

**A kind change never revokes keys.** Moving an account between kinds leaves whatever keys it already holds exactly as they were.

## The production `xx`-only rule for test personas

A `test`-kind account is otherwise a person, on purpose: off production, or while staying inside the `xx` sandbox band, it can request upload access, upload, and publish exactly like a `person` account.
On production, creating a real (`nm`) dataset is refused with `test_account_sandbox_only`.
No restriction applies off production, and none applies to a `service` account, which cannot sign in to reach dataset creation at all.

Which EZID shoulder a DOI lands on stays the admin's own decision at DOI-creation time (`sandbox` flag on `POST /admin/datasets/:id/doi/concept`), independent of the uploading account's kind.
The sandbox-only dataset-create gate is what keeps a `test` account from ever reaching a real `nm` dataset to attach a production DOI to in the first place.

## The migrated operational accounts

Migration 0082 moved four accounts to `service`: `nemarOwner`, `nemarAdmin`, `test-admin`, and `test-owner` (its role is `owner`, for exercising owner-only routes in tests; that is orthogonal to its `service` kind).
None of the four holds an ORCID iD, and none ever will.

Five accounts moved to `test`: `cool-vibers` (an owner's own persona account for exercising the regular-user experience) and the seeded fixtures `test-user`, `test-pending`, `test-verified`, `test-revoked`.

**`test-web` stays a `person`.** It is the shared web-QA account (#1008) that has to reach the ORCID authorize page and the Settings key form the way a real person would; moving it to `test` would exempt it from exactly the flows it exists to exercise.

### Checking the migrated accounts stayed put

```bash
nemar admin doctor kinds
```

Read-only: it checks each of the nine accounts above against its expected kind and reports a mismatch or an absent account, without changing anything.
Fix a finding the normal way, with `nemar admin kind <username> <kind>`.

## What the website doesn't show yet

The website does not render kind in the admin user list or account settings yet (website#318).
`account_kind` is optional on the user wire schemas and simply absent until that ships;
nothing here depends on it.
