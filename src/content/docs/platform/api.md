---
title: "API Reference"
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

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/login | Validate API key |
| POST | /auth/signup | Register new user |
| POST | /auth/resend-verification | Resend email verification |
| POST | /auth/retrieve-key | Retrieve API key (email + password) |
| POST | /auth/request-key-regeneration | Request key regeneration |
| GET | /auth/confirm-key-regeneration | Confirm key regeneration |

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

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /admin/users | List users (includes pending approvals) |
| GET | /admin/users/:username | Get a single user |
| POST | /admin/approve/:username | Approve a pending user |
| POST | /admin/revoke/:username | Revoke a user's access |
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
| 500 | Server error |
