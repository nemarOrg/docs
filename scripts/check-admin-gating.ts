#!/usr/bin/env bun
/**
 * Fail the build if any admin page could still be read through site search.
 *
 * Everything under src/content/docs/admin/ is gated on /admin/*, but Pagefind's
 * search index is served from /pagefind/*, which that gate does not cover.
 * An indexed admin page therefore hands its full text to anyone who queries
 * search: the gate stays intact and the content is public anyway.
 * `pagefind: false` in the Starlight frontmatter keeps the page out of the index
 * (the field is declared in node_modules/@astrojs/starlight/schema.ts).
 *
 * This repo has no CI and no test runner, so the build chain is the only
 * enforcement point that actually runs. The Cloudflare Pages build invokes
 * `bun run build`, which invokes this script, which is what makes the exclusion
 * a gate rather than a convention someone can forget on the next admin page.
 *
 * Usage: bun run scripts/check-admin-gating.ts   (runs from `bun run build`)
 */
import { existsSync, readdirSync, readFileSync } from "fs";
import { join, relative } from "path";

const DOCS_ROOT = join(import.meta.dir, "..");
const ADMIN_DIR = join(DOCS_ROOT, "src", "content", "docs", "admin");

// Extensions Astro turns into a page. Assets that may sit beside the content
// (images, downloads) carry no frontmatter and are not pages, so they are not
// checked. `.astro` is in the list on purpose: it has no Starlight frontmatter
// to opt out with, so it gets reported rather than quietly skipped.
const PAGE_EXTENSIONS = [".md", ".mdx", ".markdown", ".mdoc", ".astro"];

// Matched per line instead of parsed as YAML to keep this script dependency-free
// (Bun and nothing else). The field is always written as its own top-level line,
// by hand or by scripts/generate-commands.ts. A quoted "false" is deliberately
// NOT accepted: Starlight's schema types this as a boolean and would reject it.
const OPT_OUT = /^pagefind:\s*false\s*(#.*)?$/;

/** The frontmatter lines of a page, or null when it has no frontmatter block. */
function frontmatterLines(source: string): string[] | null {
  const lines = source.split("\n");
  if (lines[0]?.trim() !== "---") return null;
  const close = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
  if (close === -1) return null;
  return lines.slice(1, close);
}

function pages(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...pages(full));
    else if (PAGE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) found.push(full);
  }
  return found;
}

// A missing or empty admin tree means this check protects nothing, which is
// indistinguishable from a rename that also moved the pages out from under the
// /admin/* path gate. Fail closed and make a human confirm the move instead.
if (!existsSync(ADMIN_DIR)) {
  console.error(
    `admin gating: ${relative(DOCS_ROOT, ADMIN_DIR)} does not exist.\n` +
      "If the admin section moved, update this script AND the /admin/* path gate to the new location.",
  );
  process.exit(1);
}

const found = pages(ADMIN_DIR);
if (found.length === 0) {
  console.error(
    `admin gating: no pages found under ${relative(DOCS_ROOT, ADMIN_DIR)}.\n` +
      "If the admin pages moved, update this script AND the /admin/* path gate to the new location.",
  );
  process.exit(1);
}

const offenders: string[] = [];
for (const page of found) {
  const front = frontmatterLines(readFileSync(page, "utf-8"));
  const rel = relative(DOCS_ROOT, page);
  if (front === null) offenders.push(`${rel}: no frontmatter block`);
  else if (!front.some((line) => OPT_OUT.test(line.trim()))) offenders.push(`${rel}: missing 'pagefind: false'`);
}

if (offenders.length > 0) {
  console.error(
    `admin gating: ${offenders.length} of ${found.length} admin pages would be indexed by Pagefind:\n` +
      offenders.map((o) => `  ${o}`).join("\n") +
      "\n\nAdd 'pagefind: false' to the Starlight frontmatter of each page listed above.\n" +
      "Admin pages are gated on /admin/*, but the search index is served from /pagefind/*,\n" +
      "so an indexed admin page publishes its full text past that gate.",
  );
  process.exit(1);
}

console.log(`admin gating: ${found.length} admin pages excluded from the search index`);
