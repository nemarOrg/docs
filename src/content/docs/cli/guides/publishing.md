---
title: "Publishing Datasets"
---

This guide explains how to publish private datasets to make them publicly accessible with a citable
DOI and a preserved release state.

## Overview

The publication workflow transforms a private dataset into a public, citable resource through a multi-step process:

1. **User Request** - Dataset owner requests publication
2. **Admin Review** - NEMAR admin reviews and approves
3. **Automated Orchestrator** - System makes dataset public and assigns DOI
4. **Published** - Dataset is public with permanent DOI

## User Perspective

### Prerequisites

Before requesting publication, ensure your dataset:

- [x] Has been uploaded to NEMAR
- [x] Passes BIDS validation
- [x] Is complete and ready for public sharing
- [x] Has accurate metadata in `dataset_description.json`

### Requesting Publication

Submit a publication request for your dataset:

```bash
nemar dataset publish request nm000104
```

**What happens next:**
1. Your request is recorded in the system
2. All NEMAR admins receive an email notification
3. Your dataset remains private until approved
4. You can check status at any time

### Checking Status

Check the status of your publication request:

```bash
nemar dataset publish status nm000104
```

**Possible statuses:**
- `requested` - Waiting for admin review
- `approving` - Admin is running the publication process
- `published` - Dataset is now public with DOI
- `denied` - Request was denied (includes reason)

### Resending Notification

If admins haven't responded, you can resend the notification:

```bash
nemar dataset publish resend nm000104
```

This sends a reminder email to all admins without creating a duplicate request.

### After Approval

Once approved, you'll receive an email containing:

- Confirmation that your dataset is now public
- Your permanent DOI (e.g., `10.82901/NEMAR.nm000104`)
- Link to the public dataset page
- Citation information

Your dataset is now:
- Publicly visible on GitHub
- Protected by tag protection (versions cannot be modified)
- Backed by permanent S3 storage with Object Lock
- Citable with a permanent DOI

NEMAR's canonical dataset DOI is issued through EZID. A version workflow may create a non-public
Zenodo draft as a best-effort archive backup, but that draft is not the dataset's canonical DOI.

## Admin Perspective

### Reviewing Requests

List all publication requests:

```bash
# All requests
nemar admin publish list

# Filter by status
nemar admin publish list --pending
nemar admin publish list --approved
nemar admin publish list --denied
```

**Output includes:**
- Dataset ID and name
- Requesting user
- Request date
- Current status
- Current step (if approving)

### Approving Publication

Approve a publication request:

```bash
nemar admin publish approve nm000104
```

**Interactive confirmation:**
The CLI will show you:
- Dataset information
- Requesting user
- What will happen (16 orchestrator steps)

You can:
- Press `y` to proceed
- Press `n` to cancel
- Use `--yes` flag to skip confirmation

**DOI provider:**
```bash
# Production DOI (EZID)
nemar admin publish approve nm000104

# EZID test shoulder (for testing)
nemar admin publish approve nm000104 --sandbox
```

The current dataset publication path uses EZID. Older CLI surfaces may still display a Zenodo
provider option for compatibility, but the current backend rejects Zenodo as the dataset DOI
provider.

**Non-interactive mode:**
```bash
nemar admin publish approve nm000104 --yes
```

### The Publication Orchestrator

When you approve a request, an automated 16-step orchestrator runs. Steps are idempotent and can be
resumed if interrupted. The current dataset DOI path uses EZID; `--sandbox` selects the EZID test
shoulder for testing.

#### Step 1: `ci_check` - CI Verification
Checks if BIDS validation and version-check workflows exist on the repo. Deploys them if missing. Verifies the latest CI run passes (if any runs exist).

#### Step 2: `enrichment_check` - Check Optional Metadata
Checks whether the dataset has optional NEMAR enrichment metadata available for the DOI record.
This is a warning-only step; missing enrichment does not block publication.

#### Step 3: `s3_public_read` - S3 Public Read Access
The bucket is public-by-default behind a single deny-list policy (a public-read `Allow` with a
`NotResource` carve-out listing every private dataset prefix; see #673/#674). Making this dataset
public **removes** its prefix from the carve-out so anonymous `GetObject` is allowed; it does not
add a new grant. Idempotent. This enables anonymous downloads via git-annex web remote URLs.

#### Step 4: `repo_public` - Make Repository Public
Changes GitHub repository visibility from private to public. Updates the database visibility record.

#### Step 5: `tag_protect` - Tag Protection
Enables tag protection rules on the repository, preventing deletion or modification of version tags. Ensures DOI integrity since DOIs reference specific tags.

#### Step 6: `doi_create` - Create Concept DOI
Creates the concept (parent) DOI through EZID with DataCite kernel-4 XML metadata. DOI pattern:
`10.82901/NEMAR.<dataset_id>` in production or `10.5072/FK2<dataset_id>` in the EZID test
shoulder.

Skipped if a concept DOI already exists.

#### Step 7: `update_metadata` - Update dataset_description.json
Reads BIDS metadata from the repo, enriches it with DOI information, and commits an updated `dataset_description.json` back to the repo.

#### Step 8: `update_readme` - Update README
Generates or updates the dataset README with DOI badge, citation info, and dataset description.

#### Step 9: `create_tag` - Create Version Tag
Creates a `v1.0.0` git tag on the repo's main branch if no tags exist yet.

#### Step 10: `create_release` - Create GitHub Release
Creates a GitHub Release from the version tag.

#### Step 11: `upload_to_zenodo` - Compatibility step
The current publication orchestrator retains this step so older progress records remain readable,
but the dataset publication path skips the Zenodo upload. A later version workflow may create a
non-public Zenodo draft as a best-effort archive backup.

#### Step 12: `publish_doi` - Publish DOI
Changes the EZID identifier status from `reserved` to `public`, making the DOI publicly resolvable.

The DOI identifier is permanent. If a dataset is later withdrawn, NEMAR can restrict the dataset
and leave the DOI resolving to a tombstone rather than silently changing the released state.

#### Step 13: `version_doi` - Create Version DOI and Manifest
Creates the first version DOI under the concept DOI and dispatches the version manifest workflow.
The version DOI identifies the released version and its file manifest.

#### Step 14: `s3_lock` - S3 Object Lock
Applies S3 Object Lock (governance mode) to all dataset objects, preventing accidental deletion. Lock duration: 10 years.

#### Step 15: `sync_nemar` - Compatibility step
The legacy dataexplorer synchronization is disabled. The step is retained as a logged no-op so
older publication records remain valid. Archive-zip generation is **not** an orchestrator step; the
central version workflow dispatches it separately after the version DOI is minted.

#### Step 16: `notify_user` - Send Notification Email
Sends a publication confirmation email to the dataset owner with the DOI and citation information. This is the final step; the publication request status changes to "published".

### Resuming Failed Publications

If a step fails, you can resume from the failed step:

```bash
nemar admin publish approve nm000104 --resume
```

**How it works:**
- System remembers which steps completed successfully
- Only failed and remaining steps are re-run
- Safe to run multiple times (idempotent)

**Example scenario:**
```bash
# First attempt fails at step 5 (tag_protect)
nemar admin publish approve nm000104
# Error: Tag protection failed

# Fix the issue (e.g., remove conflicting GitHub rules)
# Then resume
nemar admin publish approve nm000104 --resume
# Skips completed steps 1-4, retries step 5, then continues with 6-16
```

### Denying Publication

Deny a publication request with a reason:

```bash
nemar admin publish deny nm000104 --reason "BIDS validation failing - please fix errors and resubmit"
```

**What happens:**
- Request status set to `denied`
- User receives email with your reason
- User can fix issues and submit a new request

## Email Notifications

### Publication Request Email (to admins)

**Subject:** `[NEMAR] Publication request for nm000104`

**Content:**
- Dataset information (ID, name)
- Requesting user details
- Link to dataset
- CLI command to approve/deny

### Publication Approved Email (to user)

**Subject:** `[NEMAR] Your dataset nm000104 has been published`

**Content:**
- Confirmation of publication
- Permanent DOI
- Link to public dataset
- Citation information
- Next steps (creating version DOIs)

### Publication Denied Email (to user)

**Subject:** `[NEMAR] Publication request for nm000104 denied`

**Content:**
- Denial reason from admin
- What to fix
- How to resubmit after fixing issues

## Troubleshooting

### User Issues

**Problem:** Request submission fails with "Dataset not found"
- **Cause:** Dataset ID is incorrect or dataset doesn't exist
- **Solution:** Check dataset ID with `nemar dataset list --mine`

**Problem:** Request submission fails with "Already published"
- **Cause:** Dataset is already public
- **Solution:** No action needed, dataset is already public

**Problem:** Request submission fails with "Unauthorized"
- **Cause:** Not logged in or not dataset owner
- **Solution:** Run `nemar auth login` and ensure you own the dataset

**Problem:** Status shows "denied" but I fixed the issues
- **Cause:** Old request was denied
- **Solution:** Submit a new request with `nemar dataset publish request <id>`

### Admin Issues

**Problem:** Approval fails at `ci_check`
- **Cause:** BIDS validation is failing
- **Solution:** User needs to fix validation issues first. Deny request with clear reason.

**Problem:** Approval fails at `repo_public`
- **Cause:** GitHub API error or permissions issue
- **Solution:** Check `GITHUB_ADMIN_PAT` is valid with `repo` and `admin:org` scopes. Retry with `--resume`.

> **Heads up:** the `GITHUB_ADMIN_PAT` user-token approach is being replaced by a GitHub App installation token; see [GitHub App setup](/admin/github-app-setup/). Migration tracked in [epic #432](https://github.com/nemarOrg/nemar-cli/issues/432).

**Problem:** Approval fails at `doi_create`
- **Cause:** EZID API error
- **Solution:**
  - Check `EZID_USERNAME`/`EZID_PASSWORD` are valid
  - Retry with `--resume`

**Problem:** Approval fails at `publish_doi`
- **Cause:** EZID status change failed
- **Solution:** Check EZID status. The DOI may already be in the correct state. Retry with `--resume`.

**Problem:** Approval fails at `s3_lock`
- **Cause:** AWS API error or permissions issue
- **Solution:** Check AWS credentials are valid. Verify S3 bucket exists. Retry with `--resume`.

**Problem:** Want to re-run entire orchestrator
- **Cause:** Need fresh start (not resume)
- **Solution:** Not currently supported. Contact dev team if needed.

## Best Practices

### For Users

1. **Validate before requesting** - Run `nemar dataset validate` locally first
2. **Complete metadata** - Ensure `dataset_description.json` is accurate
3. **Be patient** - Admins may take time to review
4. **Communicate** - If urgent, contact admins directly (don't just resend)

### For Admins

1. **Check CI first** - Review BIDS validation status before approving
2. **Use --resume** - If a step fails, fix the issue and resume (don't start over)
3. **Provide clear reasons** - When denying, explain exactly what needs fixing
4. **Monitor email** - Publication request emails help track new requests

## FAQ

**Q: How long does publication take?**
A: Once approved, the orchestrator runs its 16 tracked steps; runtime depends on repository size,
S3 object count, and external services. Admin review time varies.

**Q: Can a published dataset be withdrawn?**
A: A dataset can be restricted through the takedown process. Its DOI is not deleted; it resolves to
a tombstone that records the withdrawal.

**Q: Can I update a published dataset?**
A: Yes. Dataset owners can update their datasets via direct pushes or pull requests.

**Q: What if I need to publish urgently?**
A: Contact NEMAR admins directly. Publication requests are processed in order received.

**Q: Can I have multiple publication requests?**
A: Only one active request per dataset. Previous requests must be completed (approved/denied) before submitting new ones.

**Q: What happens if orchestrator is interrupted?**
A: Use `--resume` to continue from the last successful step. The system tracks progress automatically.

## DOI registration

### EZID
- Production DOIs: `10.82901/NEMAR.<dataset_id>` (e.g., `10.82901/NEMAR.nm000104`)
- Version DOIs: `10.82901/NEMAR.nm000104.V1.0.1`
- Sandbox DOIs: `10.5072/FK2<dataset_id>` (auto-deleted after 2 weeks)
- Metadata format: DataCite kernel-4 XML
- DOI lifecycle: `reserved` → `public`; a withdrawn record may be marked unavailable while
  remaining resolvable as a tombstone.

### Zenodo archive backup
Zenodo is not NEMAR's canonical dataset DOI provider. The version workflow may create or update a
non-public Zenodo draft as a best-effort archive backup; availability of that backup does not change
which DOI researchers should cite.

## Organization-Level Secrets

The following secrets are configured at the nemarDatasets organization level (inherited by all dataset repos):

- `NEMAR_WEBHOOK_TOKEN` - Authenticates webhook calls from GitHub Actions to the backend
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` - For S3 operations in workflows

No per-repo secret setup is needed when creating new datasets.

## Related Commands

- `nemar dataset upload` - Upload a new dataset
- `nemar dataset validate` - Validate BIDS compliance
- `nemar dataset release` - Create a version bump PR
- `nemar dataset update` - Push changes via PR
- `nemar admin publish approve` - Approve publication request (admin)
- `nemar admin doi create` - Create concept DOI standalone (admin)
- `nemar admin doi info` - View DOI information (admin)

## See Also

- [Dataset Commands Reference](/cli/commands/dataset/)
- [Admin Commands Reference](/admin/commands/)
- [Uploading Datasets Guide](/cli/guides/uploading/)
- [BIDS Validation Guide](/cli/guides/validation/)
