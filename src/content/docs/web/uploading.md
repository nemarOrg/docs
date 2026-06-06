---
title: "Uploading a dataset (web)"
---

NEMAR datasets follow the [BIDS](https://bids.neuroimaging.io) (Brain Imaging Data Structure) standard. The upload page accepts a folder drop or directory selection; we walk through validation, content-addressed storage in S3, and a GitHub repo under `nemarDatasets` for the metadata files.

## The minimum BIDS folder

A NEMAR-uploadable BIDS folder needs at least:

- `dataset_description.json` at the top level with `Name` and `BIDSVersion` populated
- One or more `sub-<id>/` participant directories
- Modality folders inside each participant (`eeg/`, `meg/`, `ieeg/`, etc.) with the appropriate file pairs

The upload page's drop-zone runs a client-side pre-check before any bytes leave your machine. You'll see a green check next to each required file as it's detected, or a yellow warning explaining what's missing.

## What we check at upload time

- **BIDS validation.** Server-side, against the current BIDS schema. Failures block publication but not the upload itself, you can keep iterating.
- **File size.** Single files cap at 5 GB. Multi-gigabyte datasets transfer fine; the cap is per-file, not per-dataset. (Multipart-upload UX for very large files is on the roadmap.)
- **Path length.** Long nested paths inside BIDS can break some tools. We flag anything over 240 chars so you can rename before publishing.
- **Naming.** The BIDS spec restricts filename characters; we surface violations during pre-check.

## How the upload works under the hood

NEMAR uploads use S3 presigned URLs minted by the backend. Your browser uploads files directly to S3 (not through us), which means upload throughput is constrained only by your connection. Metadata files (`*.json`, `*.tsv`, the README) also get committed to a GitHub repo under `nemarDatasets` so the dataset has a permanent, versioned home.

## If something fails

- **A single file failed.** Click the file in the progress list to retry. The presigned URLs are valid for 24 h.
- **BIDS validation failed after upload.** Your dashboard card shows **Validation failed**. Fix the issues locally and re-upload, the dataset id stays the same.
- **Browser crashed mid-upload.** Files already in S3 are kept; just refresh the page and re-drop the folder. The pre-check skips already-uploaded files.

## Next steps

Once your dataset is fully uploaded and BIDS-valid, the next move is [requesting publication](/web/publication-review/). While you wait for review, you can [invite collaborators](/web/managing-datasets/) who'll need write access.
