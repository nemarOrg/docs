#!/usr/bin/env bun
/**
 * One-time migration: nemar-cli/docs (MkDocs Material) -> Starlight content.
 *
 * - Maps each source markdown file to its Starlight location, moving
 *   admin/ops/disaster-recovery content under `admin/` so it can be gated by
 *   Cloudflare Access on the `/admin/*` path at the edge.
 * - Adds required Starlight frontmatter (title pulled from the first H1).
 * - Converts MkDocs admonitions (`!!! type "Title"`) to Starlight asides
 *   (`:::type[Title]`).
 * - Strips `.md` from internal links and remaps the renamed disaster-recovery
 *   files.
 *
 * Usage: bun run scripts/migrate-from-mkdocs.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

const SRC = "/Users/yahya/Documents/git/nemar/nemar-cli/docs";
const DST = join(import.meta.dir, "..", "src", "content", "docs");

// [source (relative to SRC), destination (relative to DST)]
const MAP: [string, string][] = [
  // Getting started (public)
  ["getting-started/installation.md", "getting-started/installation.md"],
  ["getting-started/quickstart.md", "getting-started/quickstart.md"],
  ["getting-started/authentication.md", "getting-started/authentication.md"],
  // Command reference (public; generated from --help)
  ["commands/index.md", "commands/index.md"],
  ["commands/auth.md", "commands/auth.md"],
  ["commands/dataset.md", "commands/dataset.md"],
  ["commands/sandbox.md", "commands/sandbox.md"],
  // Guides (public)
  ["guides/uploading.md", "guides/uploading.md"],
  ["guides/validation.md", "guides/validation.md"],
  ["guides/downloading.md", "guides/downloading.md"],
  ["guides/versioning.md", "guides/versioning.md"],
  ["guides/publishing.md", "guides/publishing.md"],
  // Reference (public)
  ["reference/configuration.md", "reference/configuration.md"],
  ["reference/environment.md", "reference/environment.md"],
  ["reference/api.md", "reference/api.md"],
  ["reference/data-api.md", "reference/data-api.md"],
  // Development (contributor)
  ["development/setup.md", "development/setup.md"],
  ["development/zenodo-testing.md", "development/zenodo-testing.md"],
  // Admin-gated (served under /admin/*, fronted by Cloudflare Access)
  ["commands/admin.md", "admin/commands.md"],
  ["guides/github-app-setup.md", "admin/github-app-setup.md"],
  ["operations/access-policies.md", "admin/operations/access-policies.md"],
  ["operations/manifest-summary-backfill.md", "admin/operations/manifest-summary-backfill.md"],
  ["operations/zarr-serving.md", "admin/operations/zarr-serving.md"],
  ["disaster-recovery/README.md", "admin/disaster-recovery/index.md"],
  ["disaster-recovery/DISASTER_RECOVERY.md", "admin/disaster-recovery/disaster-recovery.md"],
  ["disaster-recovery/FUTURE_FAIL_SAFES.md", "admin/disaster-recovery/future-fail-safes.md"],
  ["disaster-recovery/NEMAR_RESTORATION_GUIDE.md", "admin/disaster-recovery/restoration-guide.md"],
  ["disaster-recovery/NEMAR_USER_ROLES.md", "admin/disaster-recovery/user-roles.md"],
];

// MkDocs admonition type -> Starlight aside type
const ASIDE: Record<string, string> = {
  note: "note",
  info: "note",
  tip: "tip",
  success: "tip",
  question: "tip",
  warning: "caution",
  caution: "caution",
  danger: "danger",
  error: "danger",
  bug: "danger",
  example: "note",
  quote: "note",
};

// Renamed disaster-recovery targets, for fixing cross-links.
const LINK_RENAME: Record<string, string> = {
  "DISASTER_RECOVERY": "disaster-recovery",
  "FUTURE_FAIL_SAFES": "future-fail-safes",
  "NEMAR_RESTORATION_GUIDE": "restoration-guide",
  "NEMAR_USER_ROLES": "user-roles",
};

function convertAdmonitions(body: string): string {
  const lines = body.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^!!!\s+(\w+)(?:\s+"([^"]*)")?\s*$/);
    if (!m) {
      out.push(lines[i]);
      continue;
    }
    const type = ASIDE[m[1].toLowerCase()] ?? "note";
    const title = m[2];
    // Collect the indented block that follows.
    const block: string[] = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      const ln = lines[j];
      if (ln.trim() === "") {
        block.push("");
        continue;
      }
      if (/^\s{4}/.test(ln)) {
        block.push(ln.replace(/^\s{4}/, ""));
        continue;
      }
      break;
    }
    // Trim leading/trailing blank lines inside the block.
    while (block.length && block[0] === "") block.shift();
    while (block.length && block[block.length - 1] === "") block.pop();
    out.push(title ? `:::${type}[${title}]` : `:::${type}`);
    out.push(...block);
    out.push(":::");
    i = j - 1;
  }
  return out.join("\n");
}

function fixLinks(body: string): string {
  // Strip `.md` (with optional anchor) from internal links, remapping renamed
  // disaster-recovery files first.
  return body.replace(/\]\(([^)]+?)\.md(#[^)]*)?\)/g, (_full, path: string, anchor = "") => {
    const segs = path.split("/");
    const last = segs[segs.length - 1];
    if (LINK_RENAME[last]) segs[segs.length - 1] = LINK_RENAME[last];
    return `](${segs.join("/")}${anchor})`;
  });
}

function deriveTitle(body: string, fallback: string): { title: string; body: string } {
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^#\s+(.+?)\s*$/);
    if (m) {
      lines.splice(i, 1);
      // drop one trailing blank line left behind
      if (lines[i] === "") lines.splice(i, 1);
      return { title: m[1].trim(), body: lines.join("\n") };
    }
  }
  return { title: fallback, body };
}

function titleFromPath(rel: string): string {
  const base = rel.split("/").pop()!.replace(/\.md$/, "");
  if (base === "index") return rel.split("/").slice(-2, -1)[0] ?? "Overview";
  return base.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

let count = 0;
for (const [srcRel, dstRel] of MAP) {
  let raw: string;
  try {
    raw = readFileSync(join(SRC, srcRel), "utf-8");
  } catch {
    console.warn(`  SKIP (missing): ${srcRel}`);
    continue;
  }
  const { title, body } = deriveTitle(raw, titleFromPath(srcRel));
  const converted = fixLinks(convertAdmonitions(body)).replace(/^\n+/, "");
  const safeTitle = title.replace(/"/g, '\\"');
  const frontmatter = `---\ntitle: "${safeTitle}"\n---\n\n`;
  const outPath = join(DST, dstRel);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, frontmatter + converted.trimEnd() + "\n");
  console.log(`  ${srcRel}  ->  ${dstRel}`);
  count++;
}
console.log(`\nMigrated ${count} files into ${DST}`);
