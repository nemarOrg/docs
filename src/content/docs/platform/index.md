---
title: Platform & APIs
description: The NEMAR backend API and the public data plane — the HTTP surfaces behind the CLI and the website.
---

The NEMAR platform exposes four HTTP surfaces, all served by one Cloudflare Worker that forks on
the hostname it was reached at. The **backend API** powers authentication, the dataset lifecycle,
admin operations, publication, and DOIs. The **data plane** serves public dataset content. The
**Zarr gateway** serves the chunked serving copies. The **MCP server** answers tool calls. The
[CLI](/cli/) and the [browser](/ecosystem/) are clients of these APIs; you can also call them
directly.

## APIs

- [Hosts and routes](/platform/hosts-and-routes/) — every NEMAR hostname, what serves it, which
  paths live on which host, and where a retired URL goes. Start here if you are not sure which
  surface you want.
- [Backend API](/platform/api/) — `api.nemar.org`. Bearer-token authenticated endpoints for
  auth, datasets, sandbox, publication, and admin.
- [Data API](/platform/data-api/) — `data.nemar.org`. Public, unauthenticated access to dataset
  files, version manifests, `records.json`, and archive zips.
- [Zarr and edge access](/platform/zarr/) — `zarr.nemar.org`. The derived, latest-only serving
  copy, its index contract, and the cost ladder for reading it.
- [For agents and tools](/platform/for-agents/) — `mcp.nemar.org` and the machine-readable entry
  points, for anything driving NEMAR programmatically.

:::note
Webhook and internal-service contracts are intentionally not published here; they live in the
`nemar-cli` repository documentation for maintainers.
:::
