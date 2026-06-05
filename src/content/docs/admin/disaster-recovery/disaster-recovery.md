---
title: "NEMAR DISASTER RECOVERY GUIDE"
---

**🚨 EMERGENCY RESPONSE PROCEDURES**

**Version:** 1.0.0
**Last Updated:** 2026-01-18
**Operator:** nemarRestore account
**Emergency Contact:** shirazi@ieee.org

---

## 🔴 EMERGENCY: Datasets Accidentally Deleted

**TIME IS CRITICAL** - Follow these steps immediately:

### STEP 0: EMERGENCY SETUP (2-5 minutes)

**If this is your first time responding to an emergency**, setup the environment:

```bash
# 1. Create restore directory
mkdir -p /tmp/restore && cd /tmp/restore

# 2. Download restoration files from GitHub
curl -L "https://raw.githubusercontent.com/nemarOrg/nemar-cli/main/scripts/nemar-restore-dataset.sh" -o nemar-restore-dataset.sh
curl -L "https://raw.githubusercontent.com/nemarOrg/nemar-cli/main/scripts/restore_database_entries.sql" -o restore_database_entries.sql
curl -L "https://raw.githubusercontent.com/nemarOrg/nemar-cli/main/docs/disaster-recovery/DISASTER_RECOVERY.md" -o DISASTER_RECOVERY.md
chmod +x nemar-restore-dataset.sh

# 3. Verify tools are installed
command -v git && echo "✓ git" || echo "✗ git - install with: brew install git"
command -v git-annex && echo "✓ git-annex" || echo "✗ git-annex - install with: brew install git-annex"
command -v gh && echo "✓ gh CLI" || echo "✗ gh CLI - install with: brew install gh"
command -v aws && echo "✓ aws CLI" || echo "✗ aws CLI - install with: brew install awscli"
command -v npx && echo "✓ npx (for cfman wrangler)" || echo "✗ npx - install Node.js"

# 4. Authenticate to services
gh auth status || gh auth login
# Cloudflare uses the SCCN account via cfman (token in ~/.config/cfman/tokens.json)
npx cfman wrangler --account sccn whoami
```

**Expected time:** 2 minutes if tools installed, 15-30 minutes if tools must be installed

**Proceed to STEP 1 once setup is complete.**

---

### STEP 1: ASSESS DAMAGE (5 minutes)

```bash
# 1. Check what's in S3 (data layer)
export AWS_ACCESS_KEY_ID="<from-1password>"
export AWS_SECRET_ACCESS_KEY="<from-1password>"
aws s3 ls s3://nemar/ | grep "^PRE nm"

# 2. Check what's on GitHub (metadata layer)
gh repo list nemarDatasets --limit 200 | grep "^nemarDatasets/nm"

# 3. Check database (SCCN account; run from the nemar-cli repo root)
npx cfman wrangler --account sccn d1 execute nemar-db --remote -c backend/wrangler-sccn.toml --command \
  "SELECT dataset_id, name, concept_doi, status FROM datasets ORDER BY dataset_id"
```

:::note
All Cloudflare operations use the SCCN account only (the personal `neuromechanist` account was retired 2026-05-18). Always pass `-c backend/wrangler-sccn.toml` so wrangler doesn't pick up the unrelated `wrangler.jsonc` at the repo root. If you hit an `Authentication error [code: 10000]` on `/memberships`, prefix the command with `CLOUDFLARE_ACCOUNT_ID=da8d7a2a8680dab01592bbbc6f67f12c`. If `CLOUDFLARE_API_TOKEN` is exported in your shell, unset it first (`env -u CLOUDFLARE_API_TOKEN ...`) or it overrides cfman.
:::

**Record findings:**
- S3 buckets present: ___________
- GitHub repos present: ___________
- Database entries present: ___________

---

### STEP 2: VERIFY DATA INTEGRITY (5 minutes)

```bash
# For each missing dataset, verify S3 data exists
for dataset_id in nm000103 nm000104 nm000105 nm000106 nm000107; do
  echo "Checking $dataset_id..."
  count=$(aws s3 ls s3://nemar/${dataset_id}/ --recursive | wc -l)
  echo "  Files in S3: $count"
done
```

**✅ IF S3 DATA EXISTS** → Proceed to restoration (safe!)
**❌ IF S3 DATA MISSING** → STOP - Escalate to shirazi@ieee.org immediately

---

### STEP 3: GET ZENODO ARCHIVES (10 minutes)

Zenodo archives are our backup. Find concept DOIs from nemarDatasets profile:

```bash
# Visit https://github.com/nemarDatasets/.github/blob/main/profile/README.md
# Or use gh cli:
gh repo view nemarDatasets/.github --web

# Download archives for each missing dataset
# IMPORTANT: Visit each Zenodo record page to find the exact filename and latest version
# Example: https://zenodo.org/records/17613958 → click Files section → copy download link

cd /tmp/restore

# nm000103 (HBN-EEG NC v1.0.0)
curl -L "https://zenodo.org/records/17306881/files/nm000103-v1.0.0.zip?download=1" -o "nm000103-v1.0.0.zip"

# nm000104 (emg2qwerty v1.1.0)
curl -L "https://zenodo.org/records/17613953/files/nm000104-v1.1.0.zip?download=1" -o "nm000104-v1.1.0.zip"

# nm000105 (discrete_gestures v1.1.0)
curl -L "https://zenodo.org/records/17613958/files/nm000105-v1.1.0.zip?download=1" -o "nm000105-v1.1.0.zip"

# nm000106 (handwriting v1.1.0)
curl -L "https://zenodo.org/records/17613961/files/nm000106-v1.1.0.zip?download=1" -o "nm000106-v1.1.0.zip"

# nm000107 (wrist v1.1.0)
curl -L "https://zenodo.org/records/17613963/files/nm000107-v1.1.0.zip?download=1" -o "nm000107-v1.1.0.zip"
```

**Dataset → Zenodo Mapping:**
| Dataset | Concept DOI | Name |
|---------|-------------|------|
| nm000103 | 10.5281/zenodo.17306881 | HBN-EEG NC |
| nm000104 | 10.5281/zenodo.17613953 | emg2qwerty |
| nm000105 | 10.5281/zenodo.17613958 | discrete_gestures |
| nm000106 | 10.5281/zenodo.17613961 | handwriting |
| nm000107 | 10.5281/zenodo.17613963 | wrist |

---

### STEP 4: RUN RESTORATION SCRIPT (30-60 minutes)

```bash
# CRITICAL: Verify you have the script and credentials
cd /tmp/restore
ls -lh nemar-restore-dataset.sh  # Should exist
chmod +x nemar-restore-dataset.sh

# Set AWS credentials
export AWS_ACCESS_KEY_ID="<from-1password>"
export AWS_SECRET_ACCESS_KEY="<from-1password>"

# Restore each dataset (smallest first for quick validation)
./nemar-restore-dataset.sh nm000105 v1.1.0 "discrete_gestures" \
  10.5281/zenodo.17613958 f9028a54-3d7e-4af0-994f-19dc40de6a0a

# If first one succeeds, continue with others:
./nemar-restore-dataset.sh nm000107 v1.1.0 "wrist" \
  10.5281/zenodo.17613963 b4c4e0f8-6f5d-4960-a7d2-1484f06d573d

./nemar-restore-dataset.sh nm000106 v1.1.0 "handwriting" \
  10.5281/zenodo.17613961 3aaf506c-8474-43ff-854c-b9f22ca415d7

./nemar-restore-dataset.sh nm000104 v1.1.0 "emg2qwerty" \
  10.5281/zenodo.17613953 a2cae823-ec7e-4733-a0d9-a4e6876bbb46

./nemar-restore-dataset.sh nm000103 v1.0.0 "HBN-EEG NC" \
  10.5281/zenodo.17306881 4f073991-06ed-4587-93a0-36b4b5535ad0
```

**Watch for:**
- ✅ Green SUCCESS messages at each step
- ❌ Red ERROR messages → STOP and investigate
- 🟡 Yellow WARNING messages → Note but continue

---

### STEP 5: VERIFY GITHUB RESTORATION (10 minutes)

```bash
# Check all repos exist
for dataset in nm000103 nm000104 nm000105 nm000106 nm000107; do
  gh repo view nemarDatasets/$dataset --json name,isPrivate,url
done

# Check both branches present
for dataset in nm000103 nm000104 nm000105 nm000106 nm000107; do
  echo "$dataset branches:"
  gh api repos/nemarDatasets/$dataset/branches --jq '.[].name'
done

# CRITICAL: Verify README is NOT annexed
for dataset in nm000103 nm000104 nm000105 nm000106 nm000107; do
  size=$(gh api repos/nemarDatasets/$dataset/contents/README.md --jq '.size')
  echo "$dataset README: $size bytes"
  if [ "$size" -lt 100 ]; then
    echo "  ⚠️  WARNING: README may be annexed (too small)"
  fi
done
```

**Expected:**
- All repos exist and are PRIVATE
- Both `main` and `git-annex` branches present
- README files are 2-10 KB (actual content, not 69-byte pointers)

---

### STEP 6: RESTORE DATABASE ENTRIES (5 minutes)

```bash
# Run the SQL restoration script (SCCN account; run from the nemar-cli repo root)
npx cfman wrangler --account sccn d1 execute nemar-db --remote -c backend/wrangler-sccn.toml \
  --file=/tmp/restore/restore_database_entries.sql

# Verify restoration
npx cfman wrangler --account sccn d1 execute nemar-db --remote -c backend/wrangler-sccn.toml --command \
  "SELECT dataset_id, name, concept_doi, status FROM datasets
   WHERE dataset_id IN ('nm000103', 'nm000104', 'nm000105', 'nm000106', 'nm000107')
   ORDER BY dataset_id"
```

**Expected output:** 5 rows showing all datasets with status='active'

---

### STEP 7: TEST END-TO-END (15 minutes)

```bash
# Clone one dataset and test file download
cd /tmp/test-recovery
git clone git@github.com:nemarDatasets/nm000105.git
cd nm000105

# Verify README is readable
cat README.md | head -10
# Should show actual content, not "/annex/objects/..."

# Test downloading a data file
git annex get sub-000/ses-000/emg/sub-000_ses-000_task-discretegestures_emg.bdf
# Should download ~250 MB from S3 successfully

# Verify file is now present locally
ls -lh sub-000/ses-000/emg/sub-000_ses-000_task-discretegestures_emg.bdf
# Should show full file size, not small pointer
```

---

### STEP 8: DOCUMENT & NOTIFY (10 minutes)

```bash
# Create GitHub issue documenting the incident
gh issue create --repo nemarOrg/nemar-cli \
  --title "Dataset Restoration: nm000103-nm000107 - $(date +%Y-%m-%d)" \
  --body "## Incident

**Date:** $(date)
**Datasets affected:** nm000103, nm000104, nm000105, nm000106, nm000107
**Cause:** [Describe what happened]
**Data loss:** None (S3 data intact, recovered from Zenodo archives)

## Recovery Actions

- [x] Verified S3 data intact
- [x] Downloaded Zenodo archives
- [x] Restored GitHub repositories
- [x] Restored database entries
- [x] Verified end-to-end functionality

## Restored Repositories

- https://github.com/nemarDatasets/nm000103
- https://github.com/nemarDatasets/nm000104
- https://github.com/nemarDatasets/nm000105
- https://github.com/nemarDatasets/nm000106
- https://github.com/nemarDatasets/nm000107

## Lessons Learned

[Document what went wrong and how to prevent it]

## Follow-up Actions

- [x] Deletion fail-safes implemented (guarded cascade delete + audit log)
- [ ] Update disaster recovery procedures
- [ ] Test recovery procedures quarterly

**Recovered by:** nemarRestore
**Contact:** shirazi@ieee.org"

# Email notification to admin
echo "Subject: NEMAR Dataset Recovery Complete

Datasets nm000103-nm000107 have been successfully recovered.

See issue for details: [issue-url]

All datasets verified functional.

- NEMAR Restore
" | mail -s "NEMAR Recovery Complete" shirazi@ieee.org
```

---

## 📋 QUICK REFERENCE

### Essential Credentials

**Store in 1Password:**
- AWS Access Key ID: `<retrieve from 1Password: NEMAR Production vault>`
- AWS Secret Access Key: `<retrieve from 1Password: NEMAR Production vault>`
- GitHub SSH: `~/.ssh/config` → nemarDatasets deploy key
- Cloudflare auth: SCCN account token in `~/.config/cfman/tokens.json` (used by `npx cfman wrangler --account sccn`)

**1Password Details:**
- Vault: "NEMAR Production"
- Item: "AWS S3 NEMAR Bucket"
- Retrieve: `op item get "AWS S3 NEMAR Bucket" --vault "NEMAR Production" --field "access key id"`
- Retrieve: `op item get "AWS S3 NEMAR Bucket" --vault "NEMAR Production" --field "secret access key"`

### Essential Files

**Must have ready:**
```
/tmp/restore/
├── nemar-restore-dataset.sh       # Main restoration script
├── restore_database_entries.sql   # Database restoration SQL
├── DISASTER_RECOVERY.md           # This guide
├── NEMAR_RESTORATION_GUIDE.md     # Detailed technical docs
└── NEMAR_USER_ROLES.md            # Account roles and access
```

### DataLad IDs (Critical for Restoration)

| Dataset | DataLad ID |
|---------|------------|
| nm000103 | 4f073991-06ed-4587-93a0-36b4b5535ad0 |
| nm000104 | a2cae823-ec7e-4733-a0d9-a4e6876bbb46 |
| nm000105 | f9028a54-3d7e-4af0-994f-19dc40de6a0a |
| nm000106 | 3aaf506c-8474-43ff-854c-b9f22ca415d7 |
| nm000107 | b4c4e0f8-6f5d-4960-a7d2-1484f06d573d |

---

## ⚠️ PREVENTION NOTE

**Dataset deletion IS implemented** in the NEMAR CLI and backend (`backend/src/services/deletion.ts`, `DELETE /admin/datasets/:id`, and `nemar admin delete-dataset <id>`). The incident on 2026-01-18 predated this and occurred through direct GitHub repository deletion and database manipulation, not through normal NEMAR operations.

Deletion now cascades through all three layers in one operation: the GitHub repo, the S3 objects (and the dataset's private bucket-policy carve-out), and the D1 records (`dataset_versions`, `publication_requests`, `dataset_collaborators`, `user_s3_permissions`, `datasets`), plus removal of the Vectorize search vector. Every deletion is written to `audit_log`.

### Built-in Fail-Safes

The shipped deletion path enforces the following protections (`backend/src/routes/admin.ts`):

1. **Permission model:**
   - Unpublished datasets (no concept DOI, private): admin **or** owner may delete.
   - Published datasets (with a DOI or `visibility = public`): NEMAR **owner only**, and the request must set `force=true` (`--force` on the CLI) as explicit confirmation.
2. **Active publication requests block deletion** — a dataset with any non-`published`/non-`denied` publication request returns `409` until those requests are denied or completed.
3. **System catalog rows are refused** — folded legacy nemar.org catalog rows (`owner = nemar-system`) cannot be deleted here; they are managed by the catalog sync.
4. **Interactive confirmation** — the CLI prompts before deleting; deleting a DOI dataset additionally requires `--force`.
5. **Audit log** — every deletion attempt is recorded in `audit_log` with the requesting user, force flag, per-step results, and warnings.

### Scheduled Cleanup (cron)

A daily cron (3 AM UTC, production only; see `wrangler-sccn.toml [triggers]` and `scheduledCleanup` in `backend/src/index.ts`) performs automated housekeeping:

- **Sandbox (`xx`) datasets** older than 14 days are **auto-deleted** (disposable).
- **Stale `nm` datasets** (private, no DOI, no active publication requests, inactive 90 days) are **never auto-deleted** (#662). The cron emails the owner an escalating warning runway (30/14/7/2/1 days) and, at the deadline, asks an admin to delete manually via `nemar admin delete-dataset`. Real archive data is only ever removed by a deliberate human action.

This recovery guide remains the procedure for restoring datasets that are lost through means outside these guarded paths (e.g., direct GitHub/D1 manipulation, or a mistaken manual `delete-dataset`).

---

## 🔍 TROUBLESHOOTING

### Problem: "Bucket already exists" error

**Cause:** Trying to use `initremote` with existing S3 bucket

**Solution:** Use `registerurl` approach (already in script)

### Problem: README shows pointer on GitHub

**Cause:** `annex.largefiles` not configured before adding files

**Solution:**
```bash
# Delete repo and re-run restoration script
gh repo delete nemarDatasets/nm000105 --yes
/tmp/restore/nemar-restore-dataset.sh nm000105 v1.1.0 ...
```

### Problem: Can't download files (`git annex get` fails)

**Cause:** S3 URLs not registered or git-annex branch not pushed

**Solution:**
```bash
cd /path/to/dataset
# Re-register S3 URLs
git annex find --include='*.bdf' | while read file; do
  key=$(git annex lookupkey "$file")
  git annex registerurl "$key" \
    "https://nemar.s3.us-east-2.amazonaws.com/nm000105/$key"
done
git push origin git-annex
```

### Problem: Permission denied during cleanup

**Cause:** Git-annex locks files

**Solution:**
```bash
chmod -R +w /tmp/restore/restore_work/nm000105
rm -rf /tmp/restore/restore_work/nm000105
```

---

## 📞 EMERGENCY CONTACTS

| Role | Contact | When to Contact |
|------|---------|-----------------|
| **Owner** | shirazi@ieee.org | S3 data missing, policy decisions |
| **nemarAdmin** | shirazi@ieee.org | Database access, user issues |
| **AWS Support** | aws.amazon.com/support | S3 access issues |
| **GitHub Support** | support.github.com | Repository access issues |

---

## 📊 RECOVERY TIME OBJECTIVES (RTO)

| Component | Target RTO | Actual (2026-01-18) |
|-----------|------------|---------------------|
| **Assessment** | 5 min | 5 min |
| **S3 Verification** | 5 min | 3 min |
| **Download Archives** | 10 min | 8 min |
| **Restore 1 dataset** | 10 min | 7 min |
| **Restore all 5** | 60 min | 45 min |
| **Database restore** | 5 min | 2 min |
| **Verification** | 15 min | 10 min |
| **TOTAL** | **< 2 hours** | **< 90 min** |

---

## 🔄 QUARTERLY DRILL

**Every 3 months, test recovery procedure:**

1. Create test dataset `nm999999`
2. "Accidentally" delete it
3. Restore from Zenodo archive
4. Verify end-to-end functionality
5. Document timing and issues
6. Update procedures based on learnings

**Last drill:** 2026-01-18 (production incident)
**Next drill:** 2026-04-18

---

## 📝 VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-18 | Initial version based on real incident recovery |

---

**This document saved lives (or at least datasets).**

**Keep it updated. Practice the drills. Implement the fail-safes.**

**🚨 In an emergency, read STEP 1-8 above. Don't read the whole document first.**
