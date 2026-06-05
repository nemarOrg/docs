---
title: Platform & APIs
description: The NEMAR backend API and the public data plane — the HTTP surfaces behind the CLI and the website.
---

The NEMAR platform exposes two HTTP surfaces. The **backend API** powers authentication, the
dataset lifecycle, admin operations, publication, and DOIs. The **data plane** serves public
dataset content. Both run on Cloudflare. The [CLI](/cli/) and the [browser](/ecosystem/) are
clients of these APIs; you can also call them directly.

## APIs

- [Backend API](/platform/api/) — `api.nemar.org`. Bearer-token authenticated endpoints for
  auth, datasets, sandbox, publication, and admin.
- [Data API](/platform/data-api/) — `data.nemar.org`. Public, unauthenticated access to dataset
  files, version manifests, `records.json`, and archive zips.

:::note
Webhook and internal-service contracts are intentionally not published here; they live in the
`nemar-cli` repository documentation for maintainers.
:::
