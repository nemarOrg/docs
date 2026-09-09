---
title: "Cost Ladder and Recipes for Agents"
description: "Roughly how many bytes and requests each layer of the Zarr contract costs, and worked read recipes in Python and JavaScript."
---

Every layer of the [store](/platform/zarr/store-contract/) and [index](/platform/zarr/index-contract/) contract exists to keep a client from paying for more than it needs.
This page puts rough numbers on that, from smallest to largest,
then gives the read recipe Architecture Decision Record (ADR) [0025](https://github.com/nemarOrg/nemar-cli/blob/main/.context/decisions/0025-inference-compute-runs-on-device-mcp-is-a-stateless-broker.md) commits any agent-facing tooling to.

## The ladder

:::note[Current deployment]
The catalog, v3 index, manifest, and events rows are deployed. Checked on 2026-09-09, the
production catalog contained 625 datasets, `nm000103` served a v3 index, and its
`events.parquet` file was available. The staging catalog endpoint is live but currently reports
zero datasets. Measurements below mix current live objects with historical or synthetic
measurements; each section labels its basis.
:::

| Layer | Rough size | What it costs to read |
| --- | --- | --- |
| [`catalog.json`](/platform/zarr/index-contract/#zarr-catalogjson-the-discovery-front-door) | tens to low hundreds of kilobytes (kB) | One request, regardless of how many datasets you end up reading. |
| [`index.json`](/platform/zarr/index-contract/) | kB, up to roughly a dozen megabytes (MB) for the largest datasets | One request per dataset. |
| [`events.parquet`](/platform/zarr/index-contract/#eventsparquet) | tens of kB for a small dataset, low tens of MB for one with hundreds of thousands of event rows | One request for the whole dataset (or fewer, if your reader prunes row groups by `store_path`). |
| `view/*` (the whole render pyramid for one recording) | tens of kB to a few MB | 1–4 requests per screenful, at whichever level fills the viewport (see below). |
| level-0 signal (one recording) | MB for a short recording, up to several gigabytes (GB) for a long, high-density one | 1 request per shard read (4 s chunks bundled into 300 s shards) via HTTP range requests. |

### `catalog.json`

One entry (`ZarrCatalogDataset` in `backend/src/services/zarr-catalog.ts`) is on the order of 500–700 bytes of JSON.
There is exactly one document for the whole platform —
its size grows with the number of converted public datasets, not with how many you read,
so it is the cheapest possible "what is there" query regardless of scale.
The catalog is live; see the [index contract](/platform/zarr/index-contract/) for its fields and
the current rollout context.

### `index.json`

Measured directly against production on 2026-09-02:
a one-recording dataset's index is 675 bytes;
a 14-recording dataset is 7.1 kB;
a 5-recording dataset is 2.3 kB;
`nm000103` (3,522 recordings) is 1.6 MB;
and `nm000281`, the largest dataset checked at 25,253 recordings, is 12.85 MB.
`nm000103` is a mid-sized dataset by this measure, not one of the largest — `nm000281` alone has more than seven times as many recordings.

Those measurements are a historical format v1 baseline, not a statement that every dataset still
serves v1. At the 2026-09-09 check, the `nm000103` v3 index response was 2,742,915 bytes; the
size of an index varies with its dataset and conversion state.
Format v1 carries an inline `source_key` per store.
**Measurement method**: fetched `nm000281`'s live index (12,846,915 bytes, 25,253 stores) and parsed it.
Removed the `source_key` field from every store entry,
then re-serialized both the original and the stripped document with identical compact JSON formatting (`json.dumps(..., separators=(",", ":"))`),
so the diff reflects field content, not whitespace style —
the re-serialized original matched the live file's byte count exactly,
confirming the live document is already compact JSON with no formatting noise to control for.
Result: stripping `source_key` saves **2,593,563 bytes, about 20.2 percent of the document** —
higher than the 18 percent a prior, smaller measurement of this same dataset found, consistent with the dataset having grown since.
Format v3 splits `source_key` into the separate [manifest file](/platform/zarr/index-contract/#the-manifest-file) for exactly this reason.
Set against that saving, v3 also adds new per-store detail (the `layout` recipe geometry, `units_report`, structured provenance) that v1 does not carry —
a fully-populated v3 store entry runs a few hundred bytes larger than its v1 equivalent by schema shape alone —
so the net effect on total index size varies by dataset depending on how many of the new, optional fields apply to it.

Either way: **fetch `index.json` once per dataset, not per recording.**
Everything needed to decide which recording to open, and at what rate, is already in it.

### `events.parquet`

`events.parquet` is live for datasets whose current conversion produced it — for example,
`nm000103` served the object on 2026-09-09. The synthetic per-row estimate below was not derived
from that production file, so it should be treated as a planning range rather than a measurement of
the live object.
Building small synthetic files against the real schema-building code (`events_schema`/`events_table_from_columns` in `scripts/zarr/generate_zarr.py`) puts the per-row cost, zstd-compressed, at **roughly 10 to 40 bytes per row** — not a single number, because it moves with the shape of the data, not just the row count:
the numeric columns (`onset_s` float64, `duration_s` float32, `sample_index` int64) cost about the same either way,
but the dictionary-encoded string columns (`store_path`, `subject`, `trial_type`, `value`, and whether `session`/`hed` are populated at all) compress hard when a small set of distinct strings repeats across many rows, and far less when the dictionary is nearly as large as the row count —
a dataset with many stores but few events each sits toward the high end for exactly that reason, one with fewer stores and denser trial designs toward the low end.
Row count is what actually drives total size: it is `events × channel groups`, summed across every store, so a resting-state dataset with few events per recording lands in the tens-of-kB range,
while a dense trial design (hundreds of events per store) or a store with several channel groups (each onset counted once per group) can reach the tens-of-MB range at the same per-row rate.

Either read the whole file, if you want every event in the dataset, or filter by `store_path` (predicate pushdown skips row groups that cannot match, without downloading them) if you only want one recording's events.
Plain `pyarrow.parquet.read_table()` does not accept an `https://` URL directly (it raises `Unrecognized filesystem type in URI`) —
read straight from S3 instead, anonymously, the same pattern the Python recipe below uses for the store itself:

```python
import pyarrow.fs as pafs
import pyarrow.parquet as pq

fs = pafs.S3FileSystem(anonymous=True, region="us-east-2")
table = pq.read_table(
    "nemar/nm000103/zarr/events.parquet",
    filesystem=fs,
    filters=[("store_path", "=", "sub-01/eeg/sub-01_task-rest_eeg.zarr")],
)
# table now has one row per (event, channel group) for just that store, ordered by onset_s then group_name.
```

or the same filter in one line of [duckdb](https://duckdb.org/), which reads a remote Parquet file directly over HTTPS with no S3 credentials needed:

```sql
SELECT * FROM read_parquet('https://zarr.nemar.org/nm000103/zarr/events.parquet')
WHERE store_path = 'sub-01/eeg/sub-01_task-rest_eeg.zarr'
ORDER BY onset_s, group_name;
```

The `filesystem=`/`filters=` combination above was verified against the synthetic file (through a local filesystem, same code path pyarrow uses for S3),
and `pafs.S3FileSystem(anonymous=True, region="us-east-2")` was separately verified live against this exact bucket, reading a real object (`nm000103/zarr/index.json`) anonymously —
the two together cover the access pattern; the live object exists, but the examples above were not
benchmarked against its contents.
duckdb's remote-HTTPS `read_parquet()` was verified against a public test file (its own httpfs support auto-loads; no separate `INSTALL`/`LOAD` needed) — again the mechanism, not this specific URL.

### `view/*`

Before the chunk geometry fix (biosigIO 1.2.6, [nemarOrg/nemar-cli#1178](https://github.com/nemarOrg/nemar-cli/issues/1178)),
a `view/*` level was chunked the same way level 0 is — its chunk width shrinking by the downsample factor at every level.
Measured against a live store still on the older chunking (a 172 s, 129-channel electroencephalography (EEG) recording, biosigIO 1.2.1):
a single chunk near the finest render level is 87 kB,
and the level itself is split across roughly 44 such chunks end to end —
a full-level read there costs dozens of small requests, not one.
The 1178 audit put a number on exactly that cost at production scale, on the two pyramid levels furthest apart:
a whole-recording render on a 40-minute, 129-channel store was **594 requests for 1.16 MB at level 4**, and **148 requests for 77 kB at the level-6 minimap** (the coarsest level that store had), before the fix.
With every `view/*` level chunked at a constant `view_chunk_columns` (1024 by default) instead, that same level-4 render becomes **3 requests**, and the level-6 minimap becomes **1 request**.
A viewport needs roughly 1000–2500 columns at whatever level it picks,
so a constant-column chunk is sized to the request, not to the recording's length —
current stores converted with the fixed geometry carry this shape; older stores may retain earlier
chunking until they are reconverted. See the [store contract's current-deployment note](/platform/zarr/store-contract/)
for the version-dependent attributes.

### Level 0

Level 0 is `n_channels × n_samples × 2` bytes uncompressed (`int16`), then zstd-compressed.
Measured against the same 172 s / 129-channel / 250 Hz recording above:
11.1 MB of raw samples compressed to a 7.1 MB stored shard (one shard covers this recording — 172 s is under the 300 s shard span),
a compression ratio of about 0.64 — physiological signal does not compress much further than its own noise floor.
The same arithmetic on a longer, higher-density recording reaches gigabyte scale quickly:
an 8-hour, 256-channel recording at the EEG cap (250 Hz) is `256 × 7,200,000 × 2` bytes ≈ 3.7 GB uncompressed, roughly 2.4 GB at that same compression ratio.
Read it in shard-sized (300 s) sequential windows, not the whole array at once, unless you actually need the whole recording in memory.

## Recipe-first guidance for agents (ADR 0049)

NEMAR's platform design for agent-facing tooling ([ADR 0049](https://github.com/nemarOrg/nemar-cli/blob/main/.context/decisions/0049-compute-runs-in-the-browser-osa-owns-the-runtime-only-hpc-is-gated.md), which supersedes ADR 0025) treats bulk signal bytes as something that never passes through a broker:
a NEMAR tool server returns a **recipe** —
an S3 URI, region, anonymous flag, group name, level, chunk or sample slice, and the `scale`/`offset` needed to dequantize —
computed from `index.json`, and the actual read happens directly against S3 from the caller's own device.

**This is no longer hypothetical.** `read_window` on the
[MCP server](/platform/for-agents/#read_window-a-recipe-by-default-a-taste-on-request) computes
exactly that recipe for a dataset, recording and time window, including the seconds-to-samples
conversion at the served rate. The two examples below are the same recipe worked by hand:
fetch `index.json`, pick a store and group, open the level-0 array, dequantize.

### Python (`zarr` + anonymous S3)

```python
import zarr
from zarr.storage import FsspecStore

base = "https://zarr.nemar.org/nm000103/zarr"

# 1. Fetch the index and pick a store. Cloudflare's bot management blocks the
#    default Python-urllib User-Agent with a 403 unrelated to S3 (see step 2);
#    set a normal-looking one to get past it.
import urllib.request, json
req = urllib.request.Request(f"{base}/index.json", headers={"User-Agent": "nemar-docs-recipe/1.0"})
with urllib.request.urlopen(req) as r:
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
