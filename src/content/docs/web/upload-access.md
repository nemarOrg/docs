---
title: "Upload access"
description: "The three account states, what each one unlocks, and how to request the one-time admin approval that lets you upload."
---

NEMAR separates *having an account* from *being allowed to upload*.
Most of what an account is for, you get the moment you verify your email;
uploading is the one thing an admin has to grant, once, by hand.

## The states, in plain words

You do not need an account at all to browse, search, or download any public dataset;
that is open to everyone.
An account adds three states on top of that:

- **Pending.** You have signed up, but you have not yet verified your email address.
  Almost everything is locked until you do;
  check your inbox for the verification link, or run `nemar auth resend-verification` if it did not arrive.
- **Verified.** Your email is confirmed.
  This is the base tier, and it needs no admin at all:
  you can browse, use the dashboard, change your [account settings](/web/account-settings/), hold a CLI API key, and run sandbox training.
  The only thing it does not include is uploading a real dataset.
- **Approved.** An admin reviewed your upload access request and granted it.
  This is a one-time grant:
  once it is made, it stays made, and you never ask again unless it is later revoked.

## What upload access unlocks

Being approved is what lets you upload a real dataset, on the web or with the CLI,
and request that it be published once it is ready.
It does not change anything about browsing, downloading, or your dashboard;
those already worked at the verified tier.

## Admins act once, at the request

An admin's only decision in this whole flow is whether to grant your upload access request.
They are not approving your sign-up, and they are not approving each dataset you later upload or publish;
those are separate, ordinary parts of the dataset lifecycle (see [Publication review](/web/publication-review/)) and do not involve this grant again.

## How to request upload access

Once your account is verified, request upload access either of two ways:

- In Settings on nemar.org, click **Request upload access**.
- From the CLI, run `nemar auth request-upload-access`.

Before the request can be submitted, your account needs a complete profile:
a username, your given and family name, a GitHub handle that exists, and your city and country.
If any of these are missing,
the request tells you exactly which ones, so you can fill them in from [Account settings](/web/account-settings/) and try again.
That list is the same wherever you meet it:
the request's refusal, the dashboard's nudge, and `nemar auth status` or `nemar auth profile` on the CLI all compute it from the one place NEMAR keeps the rule.
A field named as missing here is never absent from a CLI listing, or the reverse.

Your GitHub handle also has to resolve on GitHub at the moment you submit.
If GitHub itself is briefly unreachable,
NEMAR tells you to try again in a few minutes rather than claiming your handle doesn't exist;
nothing about your profile needs fixing in that case.

### What each field blocks, and where to set it

A verified email address comes first and blocks more than this one request:
it is what separates the pending tier from the verified tier,
so it stops browsing, the dashboard, and everything else, not just this request.
Past that, here is what an incomplete profile blocks and where each field is set on both surfaces:

| Field | Blocks | Set on the web | Set on the CLI |
|-------|--------|-----------------|-----------------|
| Username | Upload access request | Settings | `nemar auth profile set-username` |
| Given name | Upload access request, publication | Settings, or your ORCID (Open Researcher and Contributor ID) record at orcid.org (then sign in again) if a verified ORCID iD is linked | `nemar auth profile set-name`, or none while a verified iD is linked |
| Family name | Upload access request, publication | Same as given name | Same as given name |
| GitHub handle | Upload access request, publication | Settings | `nemar auth profile set-github` |
| City | Upload access request | Settings | `nemar auth profile set-location` |
| Country | Upload access request | Settings | `nemar auth profile set-location` |
| What you intend to upload | Upload access request | The request form in Settings | `nemar auth request-upload-access` |

Given and family name also block publication, separately from this request:
a DOI (Digital Object Identifier) cites you by that name,
so a dataset cannot be published without both parts on record, whichever surface you use to deposit it.
A GitHub handle blocks publication too, since that is how collaborators and reviewers are attached to your dataset repository.

This is the same table `nemar auth status` and `nemar auth profile` render on the CLI, word for word,
because both surfaces read it from one place;
see [What your profile still needs](/cli/reference/account-access/#what-your-profile-still-needs).

:::note[A verified ORCID iD joins this list too]
A regular (`person`-kind) account also needs a verified ORCID (Open Researcher and Contributor ID) iD before it can request upload access,
fixed with "Connect your ORCID" in Settings or `nemar auth profile orcid link` on the CLI.
The exemption is by account kind, not by role: `service` and `test` accounts are exempt, whatever their role, but an admin or owner who holds a `person` kind is not.
See [Account Kinds](/admin/operations/account-kinds/).
A web account already always has a verified iD,
since signing in with ORCID is the only way a web account gets created;
signing in through the CLI's browser sign-in leaves the same guarantee.
This mainly affects accounts that predate browser sign-in and signed up without verifying an iD.
:::

## What the request needs

Alongside your profile, the request asks for a short explanation, 20 to 500 characters, of what you intend to upload.
This, together with your name, GitHub handle, city, and country, is what an admin reviews;
NEMAR hosts export-controlled research data,
so an admin looks at who is asking and from where before granting access.

## What happens after you request

Your request goes into one email to the NEMAR admins with every field above on it,
so a single admin can review and act without having to look you up separately.
You get an email of your own only once a decision is made;
there is no email just for submitting the request.

Asking again while your first request is still open normally does nothing new:
NEMAR reports that you already have an open request instead of mailing a second one.
The one exception is if that first email never reached an admin (a delivery problem on NEMAR's end, not something you did):
in that case, asking again retries the notification,
since a request nobody was told about is no better than no request at all.
You can check where things stand any time with `nemar auth status --refresh` or `nemar auth profile`.

## If access is later revoked

Upload access can be revoked, same as it can be granted.
Revoking clears the grant and any open request together,
so a reinstated account starts clean and has to submit a new request rather than finding an old one still pending.

## The CLI's extra step: sandbox training

Upload access alone is enough to upload from the web.
The CLI additionally requires a completed sandbox training run, `nemar sandbox`, before it will let you upload a real dataset;
this verifies your git-annex and GitHub setup once, against a disposable test dataset,
so problems show up there instead of partway through your first real upload.
Sandbox training itself needs only the verified tier;
do it any time before you have upload access, and it will already be done once you are approved.
