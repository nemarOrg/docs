---
title: "API Reference"
description: "The NEMAR API: browser device sign-in, named API keys, account kinds, and the datasets/admin endpoints. For advanced users."
---

NEMAR CLI communicates with the NEMAR API. This reference is for advanced users.

## Base URL

```
https://api.nemar.org
```

## Authentication

All authenticated endpoints require:

```
Authorization: Bearer nemar_your_api_key
```

## Endpoints

### Auth: browser device sign-in

`nemar auth login` and `nemar auth signup` drive this instead of a password (RFC 8628, the OAuth 2.0 Device Authorization Grant):

| Method | Endpoint | Who calls it | Description |
|--------|----------|---------------|-------------|
| POST | /auth/device/start | CLI | Mint a device code and an 8-character user code |
| POST | /auth/device/token | CLI | Poll for the API key once the code is confirmed |
| GET | /auth/device/lookup | Browser (session) | Read what a code names, before confirming or denying |
| POST | /auth/device/confirm | Browser (session) | Authorize the code; mints nothing itself, the key is minted only when the CLI collects it at `/token` |
| POST | /auth/device/deny | Browser (session) | Decline the code |

`POST /auth/device/token` answers HTTP 400 with an `error` code the CLI's poll loop switches on
(`authorization_pending`, `slow_down`, and the three terminal codes `expired_token`, `access_denied`, `invalid_grant`).
A terminal answer also carries `reason`, the more specific refusal code below:

```json
{
  "error": "expired_token",
  "reason": "device_code_expired",
  "message": "The code expired. Run `nemar auth login` again for a new one."
}
```

### Auth: API keys

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /auth/keys | List this account's live keys |
| POST | /auth/keys | Mint a named key (the paste-key fallback; refused for `service`/`test` accounts) |
| DELETE | /auth/keys/:id | Revoke a key by row id |
| DELETE | /auth/keys/current | Revoke the key that authenticated this request (bearer credential only) |

### Auth: refusal codes

Every device-flow and key route above that refuses answers `{ "error": <code>, "message": <sentence> }`:

| Code | HTTP | Means |
|------|------|-------|
| `device_code_unknown` | 404 | That code was not found. |
| `device_code_expired` | 410 | The code's 10-minute window passed. |
| `device_code_used` | 409 | That code has already been used. |
| `device_code_denied` | 409 | The sign-in was declined in the browser. |
| `account_pending` | 403 | The account's email is not verified yet. |
| `account_revoked` | 403 | The account's access has been revoked. |
| `identity_conflict` | 403 | The account shares an identifier with another NEMAR account. |
| `service_account` | 403 | This is a service or test account; it cannot sign in this way. An owner mints its keys with `nemar admin keys create`. |
| `person_account` | 403 | This account belongs to a person; only `POST /admin/users/:username/keys` refuses this way, since a person mints their own keys instead. |
| `too_many_keys` | 409 | The account already holds the maximum of 25 live keys. |
| `key_not_found` | 404 | That key was not found, or is already revoked. |

### Auth: password-era (deprecated)

:::caution[Deprecated in v0.9.17, removed in the next release]
These routes still exist for accounts created before browser sign-in, but `nemar auth login` /
`nemar auth signup` (above) are the replacement for all of them. `POST /auth/login` is the one
exception: it still validates a pasted key for `nemar auth login --key`, and is not going away.
:::

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/login | Validate an API key (used by `nemar auth login --key`; not deprecated) |
| POST | /auth/signup | Register a new user with a password (deprecated) |
| POST | /auth/resend-verification | Resend email verification |
| POST | /auth/retrieve-key | Retrieve API key by email + password (deprecated) |
| POST | /auth/request-key-regeneration | Request key regeneration (deprecated) |
| GET | /auth/confirm-key-regeneration | Confirm key regeneration (deprecated) |

:::note
`GET /auth/me` is the web-dashboard route (cookie session, not Bearer token). The CLI gets the current authenticated user via `GET /users/me`.
:::

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /users/me | Get current authenticated user (Bearer token) |
| GET | /users/me/datasets | List the current user's datasets |

### Datasets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /datasets | List datasets |
| GET | /datasets/search | Full-text and semantic dataset search (`?q=`) |
| GET | /datasets/resolve/:sourceId | Resolve a source ID (e.g. OpenNeuro accession) to a NEMAR dataset |
| GET | /datasets/:id | Get dataset details |
| POST | /datasets | Create dataset |
| POST | /datasets/:id/upload-urls | Get presigned URLs for direct file upload |
| POST | /datasets/:id/upload-credentials | Get temporary S3 credentials for upload |
| POST | /datasets/:id/download-credentials | Get temporary S3 credentials for download |
| GET | /datasets/:id/manifest | Get the latest version manifest |
| GET | /datasets/:id/versions | List dataset versions |
| POST | /datasets/:id/publish/request | Request publication of a dataset |
| GET | /datasets/:id/publish/status | Check publication request status |

### Sandbox

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /sandbox/status | Check sandbox training status |
| POST | /sandbox/complete | Mark sandbox training complete |
| POST | /sandbox/reset | Reset sandbox training |

### Admin

:::note
Admin approval grants **upload access**;
it does not gate sign-in, the API key, or the dashboard.
Those unlock as soon as a user verifies their email (`POST /auth/device/token` and `POST /auth/login` above already work at that point).
:::

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /admin/users | List users (statuses, tiers, roles, kinds, and open upload-access requests) |
| GET | /admin/users/:username | Get a single user |
| POST | /admin/approve/:username | Grant upload access to a verified user |
| POST | /admin/revoke/:username | Revoke a user's access |
| POST | /admin/users/:username/kind | Change a user's account kind: `person`, `service`, or `test` (owner only) |
| POST | /admin/users/:username/keys | Mint a key for a `service`/`test` account (owner only; refused for a `person` target) |
| GET | /admin/users/:username/keys | List a target account's live keys (owner only; any kind) |
| DELETE | /admin/users/:username/keys/:id | Revoke one of a target account's keys (owner only; any kind) |
| GET | /admin/datasets/:id/doi | Get DOI info for a dataset |
| POST | /admin/datasets/:id/doi/concept | Create concept DOI |
| POST | /admin/datasets/:id/doi/update | Update DOI metadata |
| GET | /admin/publish/requests | List publication requests |
| POST | /admin/publish/:id/approve | Approve and publish a dataset |
| POST | /admin/publish/:id/deny | Deny a publication request |
| DELETE | /admin/datasets/:id | Delete a dataset and all its resources |

## Error Responses

```json
{
  "error": "Error message",
  "details": ["Additional information"]
}
```

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not found |
| 409 | Conflict (a device code already used or denied, or a key/kind change raced another request) |
| 410 | Gone (a device code's window expired) |
| 500 | Server error |
