---
title: "Linking to a recording"
---

Every dataset page on [nemar.org](https://nemar.org) can open its signal viewer directly on a named recording, driven by a `view` parameter in the URL:

```
https://nemar.org/dataset/on007753?view=sub-05_task-BCCWJreading
```

Follow a link like that and the viewer opens on subject 5's recording for that task, with the subject and task selectors already set. Nothing else is required: the dataset page is public, so the link works for anonymous visitors and needs no sign-in.

## Sharing what you are looking at

The address bar always holds the link to the recording on screen. Open the viewer, step to whichever subject, task, or run you want, and the URL updates as you go, so copying it from the address bar is enough.

The enlarged viewer also has a **Copy link** button in its header, which puts the same URL on your clipboard. Closing the viewer removes the parameter again, so a link you copy always describes something that was actually on screen.

## Writing links by hand

The `view` value uses ordinary BIDS entity syntax, joined by underscores, and you can be as specific as your own records allow. Fewer entities means a broader match:

| Link | Opens |
| --- | --- |
| `?view=sub-01_task-rest_run-1` | that exact recording |
| `?view=sub-01_task-rest` | that subject's first `rest` run |
| `?view=sub-01` | that subject's first recording |
| `?view=task-rest` | the first `rest` recording in the dataset |
| `?v=1.0.2&view=sub-01` | the same, pinned to a published version |

Six entities are recognized: `sub`, `ses`, `task`, `acq`, `run`, and `recording`. They may appear in any order, and anything else in the value (`split`, `desc`, a file suffix) is ignored, so a filename copied straight out of the file tree works as a value too:

```
https://nemar.org/dataset/on007753?view=sub-05_task-BCCWJreading_eeg.vhdr
```

Without a `v` parameter the link resolves against the dataset's latest published version. Add `v` to pin a link that must keep showing the same data as the dataset gains versions.

## How a link resolves

The parameter names a recording; it does not guarantee one exists. When a dataset has nothing matching the full value, NEMAR drops the least specific part of the request and tries again, so a link stays useful as datasets grow and change:

- `?view=sub-01_task-rest_run-3` on a subject with only two runs opens run 1 of that task.
- `?view=sub-01_task-rest` on a subject who never ran that task opens that subject's first recording.

Two things it deliberately will not do:

- **It never changes subject.** If the dataset has no `sub-01` at all, the page says so and shows the dataset rather than opening someone else's recording. A link that is wrong reads as wrong instead of quietly showing the wrong data.
- **It never guesses across differing labels.** `sub-1` will find `sub-01`, since leading zeros are a common difference between one catalog's records and another's, but an exact match always wins first.

:::note
The viewer only opens for recordings NEMAR has converted for streaming. A dataset still being converted shows a note explaining that instead, and the next section is how to find out which recordings are ready.
:::

## Which recordings can I link to?

The viewer opens for recordings NEMAR has converted to its streaming copy, which is usually most of a dataset but rarely all of it. That list is public, per dataset, and needs no key:

```bash
curl -s https://zarr.nemar.org/on007753/zarr/index.json | jq -r '.stores[].path'
```

```
sub-01/eeg/sub-01_task-BCCWJreading_eeg.vhdr
sub-02/eeg/sub-02_task-BCCWJreading_eeg.vhdr
sub-03/eeg/sub-03_task-BCCWJreading_eeg.vhdr
...
```

Each entry in `stores` is a recording the viewer can open. The same document's `failures` says why anything missing is missing, in the same words the dataset page shows a visitor:

```bash
curl -s https://zarr.nemar.org/nm000112/zarr/index.json \
  | jq '{discovered: .discovered_count, viewable: .store_count, failed: .failure_count},
       (.failures[0] | {path, code, reason})'
```

```json
{ "discovered": 123, "viewable": 90, "failed": 33 }
{
  "path": "sub-004/eeg/sub-004_task-watchingVideoClips_eeg.bdf",
  "code": "corrupt_or_truncated",
  "reason": "This recording's data file appears truncated or corrupt, so the viewer could not be generated."
}
```

That view is trimmed; a real failure entry also carries `zarr`, `attempts`, and a `detail` field with the underlying converter error (for the recording above, an EDF/BDF compliance error). `reason` is the visitor-facing sentence, `detail` is for whoever is going to fix it.

Nothing is silently dropped: every discovered recording is either in `stores`, in `failures` with a reason, or in `pending` because it is still expected to convert. [The index contract](/platform/zarr/index-contract/) documents all three field by field, and [the serving copy overview](/platform/zarr/) explains what conversion covers.

:::caution[Read `format_version` first]
Older datasets still serve a version 1 index until they are reconverted, and version 1 has no `discovered_count`. Branch on `format_version` rather than assuming the shape above; for a v1 index, treat `store_count + failure_count` as the denominator.
:::

### Generating a link per recording

Derive the entities from each store's own path rather than from a participant table, and the links cannot outrun the data:

```bash
curl -s https://zarr.nemar.org/on007753/zarr/index.json \
  | jq -r --arg id on007753 '.stores[] | "https://nemar.org/dataset/\($id)?view=" +
      (.path | split("/") | last | split("_")
             | map(select(test("^(sub|ses|task|acq|run)-"))) | join("_"))'
```

```
https://nemar.org/dataset/on007753?view=sub-01_task-BCCWJreading
https://nemar.org/dataset/on007753?view=sub-02_task-BCCWJreading
...
```

Two reasons to take the list from `stores` rather than from subject numbering: `on007753` above has 41 recordings but skips `sub-22`, `sub-37`, and `sub-42`, and `nm000112` has 33 recordings that exist in the dataset yet cannot be viewed. Enumerating subjects yourself produces links to both.

### Starting from no dataset id

For a list of every dataset with a streaming copy, read the catalog at the same host:

```bash
curl -s https://zarr.nemar.org/catalog.json | jq -r '.count, .datasets[0].index_url'
```

It carries each dataset's identity, modalities, tasks, and the absolute `index_url` for the per-dataset document above. Anonymous bucket listing is denied, so these two documents -- the catalog and the per-dataset index -- are the intended discovery path rather than a fallback.

### Or just look at the page

Every dataset page shows the same thing to a reader, computed from that identical index: a panel reading **"N of M recordings viewable"**, with anything that failed grouped by reason underneath and each viewable recording linking into the file tree. If you only want to check one dataset, that is faster than any of the above.

## For catalogs and other integrators

If you maintain a catalog, index, or paper supplement that lists NEMAR datasets, these links let each entry point at the data rather than at a landing page. Generating them needs only the subject and task labels you already hold:

```
https://nemar.org/dataset/{dataset_id}?view=sub-{subject}_task-{task}
```

Three properties worth relying on:

- **OpenNeuro identifiers work.** `https://nemar.org/dataset/ds007753?view=sub-05` redirects to the NEMAR identifier for that mirror and keeps the parameter, so you can build links from the accession you already store.
- **Links do not expire on version changes.** An unpinned link follows the latest published version. A recording that no longer exists relaxes to the nearest match instead of erroring.
- **The parameter is read in the browser.** It does not change the page's server-rendered content, its canonical URL, or how it is indexed, so publishing many per-dataset links costs nothing in search terms.

To confirm a batch before publishing it, request each URL and check it returns `200`; resolution happens in the browser, so a `200` confirms the dataset page exists, and opening a sample in a browser confirms the recording matches.
