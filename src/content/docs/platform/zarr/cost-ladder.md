---
title: "Cost Ladder and Recipes for Agents"
description: "Roughly how many bytes and requests each layer of the Zarr contract costs, and worked read recipes in Python and JavaScript."
---

Every layer of the [store](/platform/zarr/store-contract/) and [index](/platform/zarr/index-contract/) contract exists to keep a client from paying for more than it needs.
This page puts rough numbers on that, from smallest to largest,
then gives the read recipe Architecture Decision Record (ADR) [0025](https://github.com/nemarOrg/nemar-cli/blob/main/.context/decisions/0025-inference-compute-runs-on-device-mcp-is-a-stateless-broker.md) commits any agent-facing tooling to.

## The ladder

| Layer | Rough size | What it costs to read |
| --- | --- | --- |
| [`catalog.json`](/platform/zarr/index-contract/#zarr-catalogjson-the-discovery-front-door) | tens to low hundreds of kilobytes (kB) | One request, regardless of how many datasets you end up reading. |
| [`index.json`](/platform/zarr/index-contract/) | kB, up to roughly a dozen MB for the largest datasets | One request per dataset. |
| [`events.parquet`](/platform/zarr/index-contract/#eventsparquet) | *shipping in a following release* | — |
| `view/*` (the whole render pyramid for one recording) | tens of kB to a few MB | 1–4 requests per screenful, at whichever level fills the viewport (see below). |
| level-0 signal (one recording) | MB for a short recording, up to several gigabytes (GB) for a long, high-density one | 1 request per shard read (4 s chunks bundled into 300 s shards) via HTTP range requests. |

### `catalog.json`

One entry (`ZarrCatalogDataset` in `backend/src/services/zarr-catalog.ts`) is on the order of 500–700 bytes of JSON.
There is exactly one document for the whole platform —
its size grows with the number of converted public datasets, not with how many you read,
so it is the cheapest possible "what is there" query regardless of scale.

### `index.json`

Measured directly against production on 2026-09-02:
a one-recording dataset's index is 675 bytes;
a 14-recording dataset is 7.1 kB;
a 5-recording dataset is 2.3 kB;
and `nm000103`, one of the largest datasets on the platform at 3,522 recordings, is 1.6 MB —
about 462 bytes per store entry on average, in today's still-live format v1 shape.
Format v1 (the shape currently live for most datasets) carries an inline `source_key` per store;
on the `nm000281` dataset that one field alone was 2.3 MB of a 12.8 MB index — 18 percent of it, for a field no consumer on `nemar.org` reads.
Format v3 splits that into the separate [manifest file](/platform/zarr/index-contract/#the-manifest-file) for exactly this reason.
Set against that saving, v3 also adds new per-store detail (the `layout` recipe geometry, `units_report`, structured provenance) that v1 does not carry —
a fully-populated v3 store entry runs a few hundred bytes larger than its v1 equivalent by schema shape alone —
so the net effect on total index size varies by dataset depending on how many of the new, optional fields apply to it.

Either way: **fetch `index.json` once per dataset, not per recording.**
Everything needed to decide which recording to open, and at what rate, is already in it.

### `view/*`

Before the chunk geometry fix (biosigIO 1.2.6, [nemarOrg/nemar-cli#1178](https://github.com/nemarOrg/nemar-cli/issues/1178)),
a `view/*` level was chunked the same way level 0 is — its chunk width shrinking by the downsample factor at every level.
Measured against a live store still on the older chunking (a 172 s, 129-channel electroencephalography (EEG) recording, biosigIO 1.2.1):
a single chunk near the finest render level is 87 kB,
and the level itself is split across roughly 44 such chunks end to end —
a full-level read there costs dozens of small requests, not one.
The 1178 audit put a number on exactly that cost at production scale:
a whole-recording render on a 40-minute, 129-channel store was **594 requests for 1.16 MB** at one level and **148 requests for 77 kB** at the coarsest, before the fix.
With every `view/*` level chunked at a constant `view_chunk_columns` (1024 by default) instead, the *same* two reads become **3 requests and 1 request**.
A viewport needs roughly 1000–2500 columns at whatever level it picks,
so a constant-column chunk is sized to the request, not to the recording's length —
this is the shape every store converted under the current [engine version](/platform/zarr/format-stability/) has;
see the [store contract's rollout note](/platform/zarr/store-contract/) for which stores still predate it.

### Level 0

Level 0 is `n_channels × n_samples × 2` bytes uncompressed (`int16`), then zstd-compressed.
Measured against the same 172 s / 129-channel / 250 Hz recording above:
11.1 MB of raw samples compressed to a 7.1 MB stored shard (one shard covers this recording — 172 s is under the 300 s shard span),
a compression ratio of about 0.64 — physiological signal does not compress much further than its own noise floor.
The same arithmetic on a longer, higher-density recording reaches gigabyte scale quickly:
an 8-hour, 256-channel recording at the EEG cap (250 Hz) is `256 × 7,200,000 × 2` bytes ≈ 3.7 GB uncompressed, roughly 2.4 GB at that same compression ratio.
Read it in shard-sized (300 s) sequential windows, not the whole array at once, unless you actually need the whole recording in memory.

## Recipe-first guidance for agents (ADR 0025)

NEMAR's platform design for agent-facing tooling ([ADR 0025](https://github.com/nemarOrg/nemar-cli/blob/main/.context/decisions/0025-inference-compute-runs-on-device-mcp-is-a-stateless-broker.md)) treats bulk signal bytes as something that never passes through a broker:
any future NEMAR tool server returns a **recipe** —
an S3 URI, region, anonymous flag, group name, level, chunk or sample slice, and the `scale`/`offset` needed to dequantize —
computed from `index.json`, and the actual read happens directly against S3 from the caller's own device.
The two examples below are that recipe, worked by hand:
fetch `index.json`, pick a store and group, open the level-0 array, dequantize.

### Python (`zarr` + anonymous S3)

```python
import zarr
from zarr.storage import FsspecStore

base = "https://zarr.nemar.org/nm000103/zarr"

# 1. Fetch the index and pick a store (any HTTP client works here).
import urllib.request, json
with urllib.request.urlopen(f"{base}/index.json") as r:
    index = json.load(r)
store_entry = next(s for s in index["stores"] if "eeg" in s["modalities"])

# 2. Open the store directly from S3, anonymously -- no credentials needed.
#    `zarr_format=3` is required here: without it, zarr-python probes for
#    legacy Zarr v2 sidecar files (.zgroup, .zattrs, .zmetadata) that do not
#    exist in this store, and because anonymous ListBucket is denied on this
#    bucket, S3 answers a HEAD for a missing key with 403 rather than 404 --
#    which zarr-python does not treat as "not found" and raises instead.
s3_uri = f"s3://nemar/nm000103/zarr/{store_entry['zarr']}"
fs_store = FsspecStore.from_url(
    s3_uri, storage_options={"anon": True, "client_kwargs": {"region_name": "us-east-2"}}
)
root = zarr.open_group(store=fs_store, mode="r", zarr_format=3)

# 3. Open the level-0 signal array of the group named in the index entry
#    (never "view/*" for inference).
group_name = store_entry["groups"][0]["name"]  # e.g. "eeg_250hz"
signal = root[group_name]["0"]

# 4. Read a short slice and dequantize: physical = digital * scale + offset.
region = signal[0:4, 0:500]  # first 4 channels, first 500 samples
scale = signal.attrs["scale"]
offset = signal.attrs["offset"]
physical = region[0].astype("float64") * scale[0] + offset[0]
# physical is now in the unit given by root[group_name].attrs["channels"][0]["unit"].
```

Verified against `nm000103` on 2026-09-02 with `zarr>=3`, `s3fs`, and `aiohttp` (`uv run --with zarr>=3 --with s3fs --with aiohttp ...`).

### JavaScript (zarrita)

```ts
import * as zarr from "zarrita";

const base = "https://zarr.nemar.org/nm000103/zarr";

// 1. Fetch the index and pick a store.
const index = await fetch(`${base}/index.json`).then((r) => r.json());
const storeEntry = index.stores.find((s: any) => s.modalities.includes("eeg"));

// 2. Open the store root, then the channel group named in the index entry.
const store = new zarr.FetchStore(`${base}/${storeEntry.zarr}`);
const root = await zarr.open(store, { kind: "group" });
const groupName = storeEntry.groups[0].name; // e.g. "eeg_250hz"
const group = await zarr.open(root.resolve(groupName), { kind: "group" });

// 3. Open the level-0 signal array (full resolution, anti-aliased; never "view/*").
const signal = await zarr.open(group.resolve("0"), { kind: "array" });

// 4. Read a 2-second slice for the first 4 channels.
const rate = (group.attrs as any).rate as number;
const nSamples = Math.floor(2 * rate);
const region = await zarr.get(signal, [zarr.slice(0, 4), zarr.slice(0, nSamples)]);

// 5. Dequantize to physical units: physical = digital * scale + offset, per channel.
const scale = (signal.attrs as any).scale as number[];
const offset = (signal.attrs as any).offset as number[];
const [nChan, nSamp] = region.shape;
const physical = new Float64Array(region.data.length);
for (let c = 0; c < nChan; c++) {
  for (let t = 0; t < nSamp; t++) {
    physical[c * nSamp + t] = (region.data as any)[c * nSamp + t] * scale[c] + offset[c];
  }
}
// physical[c, t] is now in the unit given by group.attrs.channels[c].unit.
```

Run under Bun against `nm000103` on 2026-09-02;
its first five dequantized samples matched the Python example above exactly.

Both examples read only what they asked for: `index.json` once, then range-limited reads of the level-0 array.
Neither downloads a whole recording, and neither needs an account, an API token, or S3 credentials —
every dataset this reaches is already public, and public means anonymously readable (see [Access and hosting](/platform/zarr/access/)).
