---
title: "Backend Fail-Safes Against Dataset Deletion"
---

**Status:** IMPLEMENTED (shipped; originally tracked in Issue #35)
**Priority:** P0 - Critical

---

## Overview

The deletion fail-safes specified after the 2026-01-18 incident (datasets nm000103-nm000107 lost through direct GitHub/D1 manipulation, **not** through NEMAR operations) have **shipped**. Dataset deletion is now a single guarded, audited operation in the backend and CLI.

This page is a short summary; the authoritative, kept-up-to-date description of the deletion path and its protections lives in the main recovery guide. See [DISASTER_RECOVERY.md → Prevention Note](./disaster-recovery#prevention-note).

:::note
Deletion is exposed as `DELETE /admin/datasets/:id` (admin-gated via `authMiddleware` + `adminMiddleware`) and `nemar admin delete-dataset <id>`. The shared cascade lives in `backend/src/services/deletion.ts`; the guard logic lives in `backend/src/routes/admin.ts`.
:::

---

## Implemented Safeguards

The shipped deletion path enforces the following protections:

1. **DOI / published gate.** A dataset with a concept DOI, or with `visibility = 'public'`, can only be deleted by the **owner** role (admins get `403`), and the request must set `force=true` (otherwise `400`). Unpublished datasets (no concept DOI, private) may be deleted by an admin or the owner.
2. **Active publication requests block deletion.** A dataset with any publication request not in `published`/`denied` status returns `409` until those requests are denied or completed.
3. **System catalog rows are refused.** Folded legacy nemar.org catalog rows (`owner = nemar-system`) cannot be deleted here; they are managed by the catalog sync. `deleteDatasetCascade` refuses them too, as defense-in-depth for other callers.
4. **Full cascade.** Deletion removes, in one operation: the GitHub repository (`nemarDatasets/<id>`), the S3 objects under `s3://nemar/<id>/` and the dataset's private bucket-policy carve-out, the D1 records (`dataset_versions`, `publication_requests`, `dataset_collaborators`, `user_s3_permissions`, `datasets`), and the Vectorize search vector. `dataset_collaborators` also cascades via its foreign key.
5. **Audit log.** Every deletion is written to `audit_log` with the requesting user, the `force` flag, per-step results, and any warnings.

---

## Scheduled Cleanup (cron)

A daily cron at **3 AM UTC (production only)** performs automated housekeeping. See `scheduledCleanup` in `backend/src/index.ts` and the `crons` trigger in `backend/wrangler-sccn.toml`; staleness thresholds live in `backend/src/services/staleness.ts`.

- **Sandbox (`xx`) datasets** older than 14 days are **auto-deleted** (disposable).
- **Stale `nm` datasets** (private, no DOI, no active publication requests, inactive 90 days) are **never auto-deleted** (#662/#663). The cron emails the owner an escalating warning runway (30/14/7/2/1 days), and at the deadline asks an admin to delete manually via `nemar admin delete-dataset`. Real archive data is only ever removed by a deliberate human action.

`last_activity_at` (migration 0011) feeds the staleness window; endpoints that mutate a dataset (uploads, version creation, publication requests) update it so an active dataset is never flagged stale (see also `0027_dataset_staleness_tracking.sql`).

---

## Related

- **Recovery procedure:** [DISASTER_RECOVERY.md](./disaster-recovery) — the procedure for restoring datasets lost through means outside these guarded paths (direct GitHub/D1 manipulation, or a mistaken manual `delete-dataset`).
- **Context:** 2026-01-18 incident (datasets nm000103-nm000107 lost outside NEMAR operations).
- **Issue:** #35 - Two-tier admin permissions and deletion fail-safes (closed; shipped).
