---
title: "Getting started on the web"
---

NEMAR (Neuroelectromagnetic Data Archive and Tools Resource) is where neuroscience teams archive, share, and process EEG, MEG, and iEEG datasets.
This page walks you through the everyday flow:
signing in, getting an account, and uploading your first dataset.

## Getting an account

There are two ways to get a NEMAR account, and both share the same backend account model.

On the web, there is no separate sign-up form:
authorizing with ORCID (Open Researcher and Contributor ID) at the [login page](https://nemar.org/login) for the first time creates your account as part of that same flow.
You enter your email, city, and country during that authorization;
NEMAR then emails you a verification code to confirm the address.
Your account is created right away, without a username or password,
and reaches the base tier once you confirm that code;
no admin review is involved either way.

On the CLI, creating a NEMAR account starts with the same ORCID sign-in the web uses:

```
bun install -g @nemar/cli
nemar auth signup
```

`nemar auth signup` opens a browser to NEMAR's sign-in page, the same one the login page above uses;
ORCID creates your account there, collecting your email, city, and country as part of that authorization, the same as on the web.
Back in the terminal, it then asks only for whatever is still missing, typically a username and your GitHub handle,
and ends by requesting upload access for you.
Verify your email from the link NEMAR sends, and your account reaches the base tier:
no admin review at sign-up.
A headless machine (no browser available) is a normal case, not a fallback:
the command prints a link and a code to copy into a browser anywhere;
see [Authentication](/cli/getting-started/authentication/).
See [the sign-up page](https://nemar.org/signup) for the field-by-field breakdown,
and [Upload access](/web/upload-access/) for the one thing an admin still has to grant before you can upload a real dataset.

## Signing in

At the [login page](https://nemar.org/login), sign in with ORCID,
or enter your email and use the one-time 6-digit code NEMAR sends you;
either way you land on your dashboard with no password.
The web and CLI share the same backend account,
so `nemar auth login` works too.
Signing in with ORCID for the first time is also how a web account gets created;
see above.

Browsing, the dashboard, and [account settings](/web/account-settings/) are all available the moment your email is verified;
no admin is involved.
Uploading and publication requests need one more thing:
a one-time [upload access](/web/upload-access/) grant from an admin, requested from Settings once your profile is complete.

## The dashboard at a glance

Once signed in, the dashboard at `/dashboard` lists every dataset you own. Each card shows:

- The dataset name, modalities, and last-updated time
- A status badge: **Draft**, **Awaiting review**, **Published**, **Denied**, or **Validation failed**
- Quick actions: view detail, manage collaborators, request publication, or delete (drafts only)

## Uploading your first dataset

Click **Upload dataset** in the top navigation. Drop your BIDS-formatted folder onto the page or use the file picker. NEMAR runs a quick pre-check, walks you through any issues it finds, and creates the dataset entry while your files transfer to S3 in the background. See [Uploading a dataset](/web/uploading/) for the full walkthrough.

## Working with collaborators

Each dataset has a collaborators page at `/dataset/<id>/collaborators`. The owner (and any admin) can invite NEMAR users by username. Invited collaborators can push to the dataset's git repo and view it on the dashboard. See [Managing your datasets](/web/managing-datasets/) for details.

## When you're ready to publish

Datasets start private and stay that way until you click **Request publication**. An admin reviews the BIDS validation, checks the metadata, and either approves (which mints a DOI and makes the dataset public) or sends a denial with feedback you can address. See [Publication review](/web/publication-review/) for what to expect.

## Web or CLI?

Both work; most people use the web. The [CLI](/cli/getting-started/installation/) is a power-user tool for scripted publishes, git-annex parallel uploads, and server-side workflows. See [CLI vs the web](/ecosystem/cli-vs-web/) if you're weighing one against the other.
