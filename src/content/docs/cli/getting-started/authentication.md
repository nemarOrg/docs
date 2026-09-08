---
title: "Authentication"
description: "Sign in to the NEMAR CLI with your browser, the headless case, the paste-key fallback, and managing a named key per machine."
---

The NEMAR CLI signs you in through your browser. One command, on any machine:

```bash
nemar auth login
```

This works whether you already have a NEMAR account or not:
ORCID (Open Researcher and Contributor ID) creates a brand-new account the first time,
or signs you into the one you already have.
It activates the account either way:
browsing, the dashboard, sandbox training, and an API key all work from there, with no admin involved.
If you're setting up a brand-new account and want the CLI to also collect your username, GitHub handle, city, and country and request upload access,
run `nemar auth signup` instead;
see [Quick Start](/cli/getting-started/quickstart/).
Uploading a real dataset needs one more thing on top of either command:
a one-time admin grant.
See [Upload access](/web/upload-access/) and [Account Access](/cli/reference/account-access/).

## The walk-through

Running `nemar auth login` prints a link and a code, then waits:

```text
  https://app.nemar.org/cli/authorize?code=XXXX-XXXX
  Code: XXXX-XXXX
  (if the page asks for it)
```

1. Open that link in any browser, on any device; it doesn't have to be the machine you ran the command on.
2. Sign in to NEMAR with ORCID if you're not already, then confirm on the page once it names your account and this machine.
3. The terminal finishes on its own. It's polling in the background and picks up your new key the moment you confirm.

The link and code are the whole mechanism.
The CLI also tries to open a browser for you as a convenience, but nothing waits on whether that attempt worked;
if it didn't, the printed link above is exactly what you'd have clicked anyway.

`nemar.org/cli/authorize` redirects to the `app.nemar.org` link above, keeping the code:
this is the one place in these docs where "the website" means `app.nemar.org` rather than `nemar.org`,
because the authorize page itself is served from the authenticated app host.

## On a machine with no browser at all

A compute cluster, a container, or an SSH session with no display is the CLI's normal case here, not a fallback.
Skip the local browser attempt outright:

```bash
nemar auth login --no-open
```

(equivalently, set `NEMAR_NO_BROWSER=1`).
This prints the link and code only.
Copy the link into a browser on your laptop or phone, sign in and confirm there,
and the original terminal still finishes on its own the moment you do; it never stops polling.

## The paste-key fallback

For a host that can't reach the network to poll while you're confirming elsewhere, or a CI runner, mint a key ahead of time instead:

- In Settings on nemar.org (see [Account settings](/web/account-settings/)), or
- From another machine that can sign in: `nemar auth keys create <name>`.

Then paste it on the host that needs it:

```bash
nemar auth login --key nemar_your_api_key_here
```

or set it in the environment first:

```bash
export NEMAR_API_KEY=nemar_your_api_key_here
nemar auth login
```

`NEMAR_API_KEY` is read only by `nemar auth login`;
nothing else in the CLI consults it per request, so a script or CI job has to run `login` once before any other command.
A pasted key is validated with the backend before anything is written to your config, and mints nothing new;
it's the key you already had, not a fresh one for this machine.

## Check status

```bash
nemar auth status
nemar auth status --refresh
```

`--refresh` fetches your current role, account kind (only shown when it isn't the default `person`), upload-access grant, and profile gaps from the server;
without it, `status` reads the local cache so it stays usable offline.
Status also prints a `Key:` line describing this machine's stored credential:
the machine name and sign-in date for a browser-minted key, `pasted key` for one supplied with `--key`/`NEMAR_API_KEY`,
or a note that a password-era key predates both and can be replaced by running `nemar auth login` once.

For the full set of identifiers on your account (username, name, email, GitHub handle, ORCID link) plus that same tier,
run `nemar auth profile` instead; see [Account Access](/cli/reference/account-access/).

## Log out

```bash
nemar auth logout
nemar auth logout --all
```

By default, logging out also revokes this machine's own key server-side, since a browser-minted key is not used anywhere else.
A pasted or password-era key may be shared with other machines, so logout keeps it valid;
revoke it deliberately with `nemar auth keys revoke` or in Settings on nemar.org when you actually mean to kill it.

```bash
nemar auth logout --revoke-key      # revoke this machine's key even if it may be shared
nemar auth logout --no-revoke-key   # clear locally only, never touch the key server-side
```

## Switch accounts

```bash
nemar auth switch              # interactive picker
nemar auth switch <username>   # or a GitHub username
```

Switching also updates the GitHub CLI (`gh`) to the matching account.

## Keys per machine

Every browser-based `nemar auth login` names a key for the machine it runs on.
`nemar auth keys` manages the whole set on your account, not just the active one:

```bash
nemar auth keys                    # list your live keys
nemar auth keys create build-box   # mint a key for a machine that can't open a browser
nemar auth keys revoke 12          # revoke by id
nemar auth keys revoke current     # revoke this machine's own key
```

`nemar auth login`/`logout` already cover the common case, this machine's own key;
reach for `nemar auth keys` to look at or manage the whole set, or to mint one for a headless host ahead of time (the paste-key fallback above).

## Password sign-in is deprecated

:::caution[Deprecated in v0.10.0, removed in the next release]
`nemar auth retrieve-key` and `nemar auth regenerate-key` still work for a password-era account, and print this before their first prompt:

> Deprecated: password sign-in is being removed in favor of `nemar auth login` (browser device sign-in). This command still works for a password-era account in the meantime.

`nemar auth login` is the replacement for both.
Existing password-era keys keep working; `nemar auth status` shows `Key: password-era key` until you run `nemar auth login` once, which replaces it with a machine-named key.
To rotate a password-era key without a browser, mint a fresh named key with `nemar auth keys create <name>` and revoke the old one with `nemar auth keys revoke <id>`.
`nemar auth regenerate-key` still works too, but revokes the key on every machine at once, not just the one you meant to rotate.
:::
