#!/usr/bin/env bun
/**
 * One-time restructure: reframe the site so the CLI is ONE part of the NEMAR
 * ecosystem, not the whole thing.
 *
 *   getting-started/ guides/ commands/ reference/{configuration,environment}
 *       -> cli/...
 *   reference/{api,data-api}        -> platform/...
 *   development/                    -> develop/...
 *   admin/                          (unchanged; edge-gated)
 *
 * Every internal markdown link is resolved against the file's OLD location and
 * rewritten to a stable root-absolute slug, so moves can't break links.
 *
 * Usage: bun run scripts/restructure-ecosystem.ts
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { posix } from "path";

const DOCS = join(import.meta.dir, "..", "src", "content", "docs");

// old (relative to DOCS) -> new (relative to DOCS)
const MOVES: [string, string][] = [
  ["getting-started/installation.md", "cli/getting-started/installation.md"],
  ["getting-started/quickstart.md", "cli/getting-started/quickstart.md"],
  ["getting-started/authentication.md", "cli/getting-started/authentication.md"],
  ["commands/index.md", "cli/commands/index.md"],
  ["commands/auth.mdx", "cli/commands/auth.mdx"],
  ["commands/dataset.mdx", "cli/commands/dataset.mdx"],
  ["commands/sandbox.mdx", "cli/commands/sandbox.mdx"],
  ["guides/uploading.md", "cli/guides/uploading.md"],
  ["guides/validation.md", "cli/guides/validation.md"],
  ["guides/downloading.md", "cli/guides/downloading.md"],
  ["guides/versioning.md", "cli/guides/versioning.md"],
  ["guides/publishing.md", "cli/guides/publishing.md"],
  ["reference/configuration.md", "cli/reference/configuration.md"],
  ["reference/environment.md", "cli/reference/environment.md"],
  ["reference/api.md", "platform/api.md"],
  ["reference/data-api.md", "platform/data-api.md"],
  ["development/setup.md", "develop/setup.md"],
  ["development/zenodo-testing.md", "develop/zenodo-testing.md"],
];

// Slug helper: drop extension; `index` collapses to its directory.
function toSlug(rel: string): string {
  let s = rel.replace(/\.(md|mdx)$/, "");
  s = s.replace(/\/index$/, "");
  if (s === "index") s = "";
  return s;
}

// old slug -> new slug for moved files.
const slugMap = new Map<string, string>();
for (const [oldRel, newRel] of MOVES) slugMap.set(toSlug(oldRel), toSlug(newRel));

function rewriteLinks(body: string, oldRel: string): string {
  const oldDir = dirname(oldRel); // e.g. "guides"
  return body.replace(/\]\(([^)]+)\)/g, (full, target: string) => {
    // Leave external links, mailto, and pure anchors alone.
    if (/^([a-z]+:)?\/\//i.test(target) || /^(mailto:|#)/i.test(target)) return full;
    const [pathPart, anchor = ""] = target.split(/(#.*)$/);
    if (!pathPart) return full;
    let oldSlug: string;
    if (pathPart.startsWith("/")) {
      oldSlug = pathPart.replace(/^\/+/, "").replace(/\/+$/, "");
    } else {
      // Resolve relative to the file's OLD directory.
      oldSlug = posix.normalize(posix.join(oldDir, pathPart)).replace(/\/+$/, "");
    }
    oldSlug = oldSlug.replace(/\/index$/, "");
    const newSlug = slugMap.get(oldSlug) ?? oldSlug; // unchanged (e.g. admin/*) keeps slug
    return `](/${newSlug}/${anchor})`;
  });
}

let moved = 0;
for (const [oldRel, newRel] of MOVES) {
  const oldPath = join(DOCS, oldRel);
  let raw: string;
  try {
    raw = readFileSync(oldPath, "utf-8");
  } catch {
    console.warn(`  SKIP (missing): ${oldRel}`);
    continue;
  }
  const out = rewriteLinks(raw, oldRel);
  const newPath = join(DOCS, newRel);
  mkdirSync(dirname(newPath), { recursive: true });
  writeFileSync(newPath, out);
  if (newPath !== oldPath) rmSync(oldPath);
  console.log(`  ${oldRel}  ->  ${newRel}`);
  moved++;
}

// Drop now-empty old directories.
for (const d of ["getting-started", "commands", "guides", "reference", "development"]) {
  try {
    rmSync(join(DOCS, d), { recursive: true });
  } catch {}
}

console.log(`\nRestructured ${moved} files into the ecosystem layout.`);
