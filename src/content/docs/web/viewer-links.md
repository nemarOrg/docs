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
The viewer only opens for recordings NEMAR has converted for streaming. A dataset still being converted shows a note explaining that instead. See [the Zarr serving copy](/platform/zarr/) for what conversion covers.
:::

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
