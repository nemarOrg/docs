---
title: "Access and Hosting"
description: "The stable URL, anonymous S3 access, the browser-versus-machine split at the edge, caching, and rate limits for the Zarr serving copy."
---

:::note[Rollout]
This page describes the contract as it ships with **nemar-cli release 0.9.12** (epic #1181), not as it stands today.
Checked live on 2026-09-02, on both production and the `zarr-test.nemar.org` staging host:
the redirect split, the tokened/untokened cache lifetimes below, `GET /catalog.json`, and `GET /schemas/*` do not exist yet.
Today, every request — browser or not — is proxied the same way, and `index.json` and a store's `zarr.json` share one flat cache lifetime (`max-age=60, stale-while-revalidate=300`), checked against the deployed source.
Anonymous S3 access, the `s3:ListBucket` denial, and the 10,000-requests-per-60-seconds rate bucket are **already live today**, independent of this release — see each section below for which parts of it apply now.
:::

## The one stable URL

`https://zarr.nemar.org` is the only host and base path a client should hardcode:
it is the index document's own `contract_base`, `https://zarr.nemar.org/<dataset_id>/zarr/`.
That said, `contract_base` itself is a `format_version 3` field —
today's `format_version 1` index does not publish it, so a client reading a v1 index has only the hostname convention above to go on, not the field itself.

`data_base` and `s3_uri`, also published in [`index.json`](/platform/zarr/index-contract/) once v3 ships,
describe where the bytes happen to live *today* — currently a public Amazon S3 object under `s3://nemar/<dataset_id>/zarr/`, region `us-east-2` —
and may change independently of `contract_base`.
**Read them from the index each time rather than hardcoding either one.**
A client that only ever needs to read bytes can ignore both and simply request everything through `contract_base`;
`data_base`/`s3_uri` exist for a reader that wants to talk to S3 directly (see the [cost ladder page](/platform/zarr/cost-ladder/) for a worked example of each).

## Anonymous S3 access

Every public dataset's Zarr prefix is anonymously readable, **already, today**:
`GET`/`HEAD` against `s3://nemar/<dataset_id>/zarr/...`
(or the equivalent `https://nemar.s3.us-east-2.amazonaws.com/...` URL)
works with **no AWS credentials**,
for any object whose key you already know.

**`s3:ListBucket` is denied for the anonymous principal — entirely, not only within a dataset's prefix.**
There is no anonymous directory listing at any level of the bucket, including its root; this is also already true today, independent of this epic.
This is exactly why the [index](/platform/zarr/index-contract/) and the [`zarr-catalog.json` discovery front door](/platform/zarr/index-contract/#zarr-catalogjson-the-discovery-front-door) exist:
with no listing available, a document a client can *fetch by name* is the only way to discover what a dataset serves, or which datasets are served at all.
If you find yourself reaching for `ListObjectsV2` against this bucket, the object you want is `index.json` or `catalog.json`, not a listing —
though `catalog.json` itself is one of the pieces still shipping with 0.9.12; see the rollout note above.

A private dataset's objects are excluded from the bucket's public-read grant,
so a request for one returns `403` at S3 (or `404` through the gateway below) — the same as a path that does not exist.

## Browser versus everything else

The split described in this section ships with nemar-cli release 0.9.12; today, every request is proxied, with no redirect branch at all.
Once it ships, `zarr.nemar.org` — a Cloudflare Worker in front of that same S3 origin — will treat two kinds of request differently:

- **A browser request** — one carrying an `Origin` header from `nemar.org`, a `*.nemar.org` subdomain, or `localhost`/`127.0.0.1` — is **proxied**:
  the Worker fetches the object server-side, sets Cross-Origin Resource Sharing (CORS) headers scoped to that origin, and edge-caches the response.
  This is what makes `zarr.nemar.org` the authoritative *browser* gateway:
  a third-party site cannot cross-origin stream these bytes into its own page, even though the underlying S3 object is openly downloadable.
- **Every other `GET` for a store object** — a library, a high-performance computing (HPC) job, an agent, `curl` with no `Origin` —
  gets a **`302` redirect straight to the public S3 object**, not a proxied response.
  This is the overwhelming majority of request volume, and Cloudflare's terms restrict proxying large files at this scale on a non-Enterprise plan regardless —
  every request is counted whether the Worker carries the bytes or not, so redirecting costs nothing extra and avoids that ceiling.
- **`index.json` is always proxied**, regardless of `Origin` — it is the mandatory entry point and needs to be visibility-gated and edge-cached the same way for every caller.
  **`manifest.json` and every other object are not specially exempted**: a non-browser `GET` for `manifest.json` redirects to S3 exactly like a chunk object does.
- **`HEAD` is never redirected**, regardless of `Origin` — always answered by the proxied path.
  This matters in practice: `fsspec`'s `info()` and `rclone`'s HTTP backend both probe with `HEAD`, and `rclone` does not follow a redirected `HEAD`.
- **Only public datasets are gated on the proxied branches.** The redirect branch relies on the S3 bucket policy itself as the enforcement point:
  a redirect that then 403s at S3 for a private dataset's object leaks nothing the proxied `404` would not.

`GET /catalog.json` (no dataset id segment) will be a separate route that can never match the redirect rule above —
it is always proxied and edge-cached, the same as `index.json`, once it ships (see the rollout note above; it 404s today).

## Caching and freshness

The table below is the shape that ships with the release.
Today, `index.json` and a store's `zarr.json` share one flat, untokened lifetime — `max-age=60, stale-while-revalidate=300` — with no tokened variant at all;
every other object already uses the same `max-age=86400, stale-while-revalidate=86400` shown below, since that part has not changed.

| Object | Untokened | Tokened (`?v=<updated_utc>`) |
| --- | --- | --- |
| `index.json` | `max-age=300, stale-while-revalidate=3600` | `max-age=86400, stale-while-revalidate=86400` |
| a store's `zarr.json` (group/array metadata) | `max-age=60, stale-while-revalidate=300` | `max-age=86400, stale-while-revalidate=86400` |
| every other object (chunks, `manifest.json`) | `max-age=86400, stale-while-revalidate=86400` | same |
| `GET /catalog.json` | `max-age=3600, stale-while-revalidate=3600` | — |
| `GET /schemas/*` | `max-age=86400` | — |
| a `404` from this gateway | `max-age=60` | — |

Chunk data (the level-0 signal and `view/*` bytes) gets a long cache lifetime regardless of tokening,
because a given store's chunks do not change between conversions — only a re-conversion replaces them, in place.
`index.json` and each store's `zarr.json` get a short *untokened* lifetime instead,
so a re-conversion surfaces to a client within minutes.

Because chunk data is cached far longer than the metadata that describes it,
a client that caches store URLs across a re-conversion can end up pairing a fresh `index.json` with stale, previously cached chunk bytes.
Append the store entry's (or the whole index's) `updated_utc` as a `?v=` query parameter to force a fresh fetch instead of reusing a cache entry keyed to the previous conversion —
for example `.../eeg_250hz/0/c/0/0?v=2026-08-30T04:12:09Z`.
The query string does not change which object is fetched, only the cache key.

## Rate limits

The shared rate-limit bucket itself is **already live today**: every request under `<zarr.nemar.org host>/<id>/zarr/...` — proxied today, redirected once 0.9.12 ships —
is counted against one shared, IP-keyed bucket of **10,000 requests per 60 seconds**, the same generous data-plane bucket `data.nemar.org` uses.
What is new is the *observe-only* treatment of a redirect, which cannot exist before the redirect branch itself does.

Once the release ships: a redirect is **observe-only**: it still counts against that shared bucket, but it never itself returns `429` —
a `302` costs a fraction of a millisecond of Worker time and zero bytes of egress, so there is no reason to block it.
A *proxied* request from the same client IP — a browser-origin fetch, or a request for `index.json` —
is enforced normally and can `429` once the shared bucket the redirected traffic already counted against is exhausted.
In other words: redirected traffic is never itself throttled, but it is not free either —
heavy redirected traffic from one IP can still trip the limit for that IP's proxied requests.
Today, with no redirect branch, every request against this bucket is a normal, enforced hit — there is no observe-only case yet.

Everything above is anonymous by design;
there is no authentication on this gateway, and no token-keyed bucket applies here — contrast the authenticated, token-bucketed [backend API](/platform/api/).
