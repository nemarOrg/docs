---
title: "Hosts and Routes"
description: "Every NEMAR hostname, what serves it, and how a request is routed: the two website hosts, the four Worker hostnames, the docs and dashboard sites, the page and API routes, and where old URLs go."
---

NEMAR is four deployed things behind eight production hostnames.
This page is the map: which hostname is served by which deployment,
which paths live on which host, and where a retired URL ends up.

If you are looking for what an endpoint *does*, the reference pages are
[Backend API](/platform/api/), [Data API](/platform/data-api/) and
[Zarr and edge access](/platform/zarr/).
This page answers the question before those: *which host, and why that one.*

```
                nemar.org ──────────┐   public pages, the dataset browser
            app.nemar.org ──────────┴─  Cloudflare Pages, from nemarOrg/website

            api.nemar.org ──┐
           data.nemar.org ──┤
           zarr.nemar.org ──┼─────────  ONE Cloudflare Worker, from nemarOrg/nemar-cli
            mcp.nemar.org ──┘           (backend/, with D1, Vectorize, Workers AI, S3)

           docs.nemar.org ───────────   this site, from nemarOrg/docs
      dashboard.nemar.org ───────────   from nemarOrg/nemar-observability
```

## Production hostnames

| Hostname | Serves | Deployed from | Authentication |
|---|---|---|---|
| `nemar.org` | Home, `/discover`, dataset landing pages, policies | `nemarOrg/website`, Cloudflare Pages | Anonymous; responses are edge-cacheable |
| `app.nemar.org` | Dashboard, upload, settings, admin, CLI authorize | The same build and the same project | Session cookie, scoped to this host |
| `api.nemar.org` | The backend API | `nemarOrg/nemar-cli` `backend/`, Worker `nemar-api` | Bearer API key, or the web session cookie |
| `data.nemar.org` | Public dataset files, version manifests, archive zips | The same Worker, data fork | Anonymous |
| `zarr.nemar.org` | The Zarr serving copies and their index documents | The same Worker, zarr fork | Anonymous |
| `mcp.nemar.org` | The Model Context Protocol server | The same Worker, mcp fork | Anonymous |
| `docs.nemar.org` | This site | `nemarOrg/docs`, Worker Static Assets | Anonymous, except `/admin/*` behind Cloudflare Access |
| `dashboard.nemar.org` | `/observability` health dashboard, `/citations` | `nemarOrg/nemar-observability`, plus a Pages project for `/citations` | Anonymous and read-only; the public snapshot carries no private dataset ids |

## One Worker, four hostnames

`api`, `data`, `zarr` and `mcp` are not four deployments.
They are one Worker that forks on the hostname it was reached at,
so a change to shared middleware, D1 access or a service module lands on all four at once.

| Hostname | Fork | What it dispatches to |
|---|---|---|
| `api.nemar.org` | `api` | The full API app: the middleware stack, then the path mounts below |
| `data.nemar.org` | `data` | The data sub-app at the root, so the public contract is `data.nemar.org/<id>/<version>/...` with no `/data/` prefix. The bare root serves the catalog index |
| `zarr.nemar.org` | `zarr` | A self-contained sub-app with its own tightly scoped CORS, `Range` pass-through and edge caching |
| `mcp.nemar.org` | `mcp` | A self-contained sub-app: the origin gate and rate-limit bridge that the Streamable HTTP transport needs |

Two properties of the fork are worth knowing, because both are deliberate:

- **The hostname is read from the request URL, never from the `Host` header.**
  A forged `Host:` therefore cannot steer an `api.nemar.org` request into the data, zarr or mcp fork.
- **The zarr and mcp forks bypass the API middleware stack on purpose.**
  The global CORS policy allows `*.nemar.org` broadly, which is right for the API
  and wrong for a host that browsers hit with credentials-free byte-range reads.
  Those two hosts declare their own.

Every fork is also reachable by path on the api host and on the `workers.dev` fallback,
which is how a deploy is tested before a custom domain exists:

| Path mount | Reaches |
|---|---|
| `api.nemar.org/data/...` | The data fork's handlers |
| `<worker>.workers.dev/zarrproxy/<id>/zarr/<path>` | The zarr gateway |
| `<worker>.workers.dev/mcp` | The MCP transport endpoint, and only that endpoint |

The hostnames themselves are environment variables (`DATA_HOSTNAME`, `ZARR_HOSTNAME`,
`MCP_HOSTNAME`) rather than literals in code,
which is what lets the staging Worker answer on the `-test` mirrors below without a code change.

## The website's two hosts

`nemar.org` and `app.nemar.org` are one Astro build.
The split is about the session cookie, not about the code:
the cookie is issued with `Domain=app.nemar.org` so that it never attaches to
byte-range fetches against `data.nemar.org`, to search requests against `api.nemar.org`,
or to any future subdomain.
That in turn keeps the public host anonymous, and therefore edge-cacheable.

Every path belongs to exactly one of the two hosts, and the middleware redirects it off the other:
`301` for `GET` and `HEAD`, `307` for anything with a method and body to preserve.

These prefixes live on the app host:

| Prefix | Why it is app-only |
|---|---|
| `/login`, `/welcome`, `/onboarding` | Sign-in and the account setup that follows it |
| `/dashboard`, `/upload`, `/settings` | Read and write the signed-in account through the host-scoped cookie |
| `/admin` | Admin and owner operations |
| `/cli` | The CLI device-authorization page the backend hands the CLI as its `verification_uri` |
| `/auth` | The ORCID browser flow; the state, pending and session cookies are all host-scoped, and the OAuth `redirect_uri` host has to match |
| `/api/auth`, `/api/admin`, `/api/v1` | Same-origin proxies for cookie-authenticated calls. Classified as marketing they would be redirected cross-origin and the cookie would not travel |
| `/dataset/<id>/collaborators` | Per-dataset access management |

Two exceptions to the binary split, both of which exist because something was broken without them:

- **`/api/notices` is host-neutral.**
  It feeds the site-wide notice banner, which renders on public *and* signed-in pages.
  Pinned to either host it would be redirected cross-origin from the other,
  where no CORS headers apply, and the banner would silently never appear.
- **An app-to-public redirect is suppressed when the request carries a session.**
  Otherwise a signed-in user who clicked "Discover" was sent to the public host,
  where the cookie does not travel, and watched themselves get signed out for using the nav.
  The reverse is never suppressed: letting a cookie change what the public host serves
  would vary a shared cache entry per user.

Because the app host can serve a public route, the canonical URL is a property of the
route rather than of the host that answered,
so `app.nemar.org/discover` canonicalises to `nemar.org/discover` instead of competing with it.

## Website routes

### Public pages

| Route | What it is |
|---|---|
| `/` | Home |
| `/discover` | The dataset browser: search, facet filters, sort |
| `/dataset/<id>` | Dataset landing page, and the canonical DOI landing target. `?v=v1.0.0` selects a version |
| `/dataset/<id>.md` | The same page as Markdown, for agents and for pasting into a prompt |
| `/signup` | How to create an account; links to `/login` on the app host |
| `/about`, `/support` | Project and contact pages |
| `/privacy`, `/terms` | Policies. The full set is under [Policies](/policies/) |
| `/api/notices` | Active site-wide notices. Served on both hosts |
| `/404` | Not found |

### Machine-readable endpoints

| Route | What it is |
|---|---|
| `/llms.txt` | Site map written for language models |
| `/robots.txt`, `/sitemap.xml` | Crawler directives and the page index. Non-production hosts are `noindex` |
| `/version.json` | The deployed build version, matching the `x-nemar-version` response header |
| `/og/dataset/<id>.png`, `/og/dataset/<id>.svg` | Social card for a dataset |

More agent-facing entry points, including the MCP server and the Zarr index,
are collected in [For agents and tools](/platform/for-agents/).

### Signed-in pages

| Route | What it is |
|---|---|
| `/login`, `/login/verify`, `/login/pending` | Sign in with ORCID or an email code, and the states after it |
| `/welcome`, `/onboarding` | First-run account setup: username, name, location |
| `/dashboard` | Your datasets, requests and account state |
| `/upload`, `/upload/success` | Browser upload |
| `/settings` | Profile, email, ORCID link, API keys, upload access |
| `/dataset/<id>/collaborators` | Manage collaborators on a dataset you own |
| `/cli/authorize` | Confirm or deny a CLI device code |
| `/auth/orcid/start`, `/auth/orcid/callback`, `/auth/orcid/complete` | The ORCID browser flow |
| `/admin`, `/admin/users`, `/admin/users/<username>`, `/admin/publication-requests`, `/admin/imports`, `/admin/notices` | Admin surface |
| `/api/auth/...`, `/api/admin/...`, `/api/v1/<path>` | Same-origin proxies to the backend for the cookie session |

## Backend path mounts

On `api.nemar.org`, the API is mounted by prefix:

| Prefix | Covers | Reference |
|---|---|---|
| `/auth` | CLI sign-in, the device authorization grant, named API keys, web email codes, ORCID | [Backend API](/platform/api/) |
| `/users` | Your own account, upload-access requests | [Backend API](/platform/api/) |
| `/datasets` | The dataset lifecycle: validate, upload, version, publish, search | [Backend API](/platform/api/) |
| `/sandbox` | The sandbox training run required before a first upload | [Sandbox commands](/cli/commands/sandbox/) |
| `/admin` | Approvals, DOIs, imports, sweeps, fleet governance | [Admin commands](/admin/commands/) |
| `/schemas` | Published JSON Schemas, including the Zarr index schema | [Index contract](/platform/zarr/index-contract/) |
| `/openapi.json` | The OpenAPI 3.1 document for this API, generated from the same schemas the server validates against | [Backend API](/platform/api/) |
| `/data` | The data plane, also served at the root of `data.nemar.org` | [Data API](/platform/data-api/) |
| `/webhooks` | Internal callbacks from dataset CI. Not a public contract | — |

## Staging

Staging is a second Worker and a second Pages project, on the same zone.
It is a real deploy, not a preview: it has its own database, its own dataset
fixtures and its own DOI shoulder.

| Staging hostname | Production counterpart |
|---|---|
| `test.nemar.org` | `nemar.org` and `app.nemar.org` together, in single-host mode |
| `api-test.nemar.org` | `api.nemar.org` |
| `data-test.nemar.org` | `data.nemar.org` |
| `zarr-test.nemar.org` | `zarr.nemar.org` |
| `mcp-test.nemar.org` | `mcp.nemar.org` |

:::caution
Staging holds its own catalog, so a dataset id that resolves on production may not exist there.
Never authenticate against a staging host with a production API key.
:::

## Where old URLs go

The previous NEMAR site addressed datasets under `/dataexplorer`.
Those URLs are permanently redirected, so a citation or a bookmark still resolves:

| Old URL | Now | Status |
|---|---|---|
| `/dataexplorer` | `/discover` | 301 |
| `/dataexplorer/detail?dataset_id=<id>` | `/dataset/<id>` | 301 |
| `/docs`, `/docs/<page>` | The matching page on `docs.nemar.org` | 301 |
| `/citation-dashboard` | `dashboard.nemar.org/citations/` | 301 |
| `/resources`, `/tools`, `/members`, `/groups`, `/citations` | The legacy site at `ww1.nemar.org` | 302 |

The last row is `302` rather than `301` deliberately.
Those sections have no counterpart on the current site,
so they still serve from the legacy host, and that host will retire;
a cached permanent redirect would outlive it with no way to reach the clients holding it.

The dataset id is passed through untranslated.
`/dataset/<id>` resolves a legacy `ds*` accession to its NEMAR id with a real catalog lookup,
and declines when no mirror exists rather than inventing an id.

One subtlety worth knowing if you are debugging a redirect:
a request that arrives with a `Referer` on the legacy host is sent back there,
on the reasoning that someone mid-session on the old site followed an absolute link
and should not be ejected.
A request with no `Referer` at all is treated as a citation and sent to the current site,
because a missing `Referer` is the common case for a typed URL, a bookmark or a search result.

## Where these facts come from

Everything above is derived from configuration and code, not from probing hosts.
If you need to confirm or extend it, read these rather than sending requests:

| Fact | Source |
|---|---|
| Which hostnames the Worker answers on, and the staging mirrors | `nemar-cli` `backend/wrangler-sccn.toml`, the `routes` blocks for the default and `dev` environments |
| The hostname fork | `nemar-cli` `backend/src/services/host-routing.ts`, plus the dispatch middleware in `backend/src/index.ts` |
| Backend path mounts | The `api.route(...)` calls in `nemar-cli` `backend/src/index.ts` |
| The app and public host split, redirects, canonical origins, legacy URLs | `website` `src/lib/host.ts`, applied in `src/middleware.ts` |
| The website's routes | `website` `src/pages/` |
| Website environment hostnames | `website` `wrangler.toml`, and `.github/workflows/deploy-test.yml` for staging |
| This site's deploy | `docs` `wrangler.jsonc` |
| The dashboard's routes | `nemar-observability` `wrangler.toml` |
