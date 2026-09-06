---
title: "Authentication"
---

NEMAR uses API key authentication.
Verifying your email is what unlocks the key;
admin approval is a separate, later step that only gates uploading real datasets.

## Workflow Overview

1. **Sign up** - Create an account with your details
2. **Verify email** - Click the link in the verification email.
   This reaches the `verified` tier:
   browsing, the dashboard, sandbox training, and your API key all work from here, with no admin involved.
3. **Retrieve API key** - Use `nemar auth retrieve-key` with your email and password
4. **Log in** - Use your API key to authenticate
5. **Request upload access** - Before uploading a real dataset, run `nemar auth request-upload-access` and wait for the one-time admin review. See [Upload access](/web/upload-access/) and [Account Access](/cli/reference/account-access/).

## Creating an Account

```bash
nemar auth signup
```

You'll be prompted for:

| Field | Description |
|-------|-------------|
| Username | 3-30 characters, alphanumeric with - and _ |
| Email | Valid email for verification |
| Password | Minimum 12 characters |
| GitHub Username | Required for PR collaboration. Backs at most one NEMAR account. |
| ORCID iD (Open Researcher and Contributor ID) | Required: it's how NEMAR gets your name for DOI citation, and where author matching starts. Backs at most one NEMAR account. |
| City | Required for export-control screening |
| Country | Required for export-control screening |
| Description | Why you need NEMAR access (min 20 chars) |

## Logging In

### Interactive

```bash
nemar auth login
```

### With API Key

```bash
nemar auth login -k nemar_your_api_key_here
```

### Environment Variable

```bash
export NEMAR_API_KEY=nemar_your_api_key_here
nemar auth login
```

## Check Status

```bash
# View cached credentials
nemar auth status

# Refresh from server
nemar auth status --refresh
```

`nemar auth status` prints an `Upload access` line alongside your cached account info.
For the full set of identifiers on your account (username, name, email, GitHub handle, ORCID link),
plus that same tier, run `nemar auth profile` instead;
see [Account Access](/cli/reference/account-access/).

## Log Out

```bash
# Remove the active account
nemar auth logout

# Remove all stored accounts
nemar auth logout --all
```

## Switch Accounts

If you have multiple NEMAR accounts:

```bash
# Interactive account picker
nemar auth switch

# Switch to a specific account
nemar auth switch <username>
```

## Resend Verification Email

If you didn't receive the verification email:

```bash
nemar auth resend-verification
```

## Planned: signing in with ORCID (not yet available)

:::caution[Planned: nemar-cli epic #1272]
Nothing below is implemented yet.
`nemar auth login` and `nemar auth retrieve-key` remain the only way to sign in from the CLI today;
do not rely on this until it ships.
:::

A follow-up epic (nemar-cli#1272), starting after the account-tiers epic above ships,
plans to move CLI sign-in to ORCID, through the browser, with a device code,
the same shape as `gh auth login`:
the CLI shows a code, you open a link, approve it on orcid.org, and the CLI picks up a session on its own.
No password is typed and no API key is pasted in.
This note exists so the plan is visible ahead of the change, not so you can use it yet.

## Security Notes

:::caution[Keep Your API Key Secure]
- Never commit your API key to version control
- Use environment variables in scripts
- Don't share your API key with others
:::
Your API key is linked to:
- Your GitHub Personal Access Token (for repository operations)
- Your S3 credentials (for data upload/download)

If you suspect your key is compromised, regenerate it immediately:

```bash
nemar auth regenerate-key
```

This sends a verification email and revokes the old key upon confirmation.
