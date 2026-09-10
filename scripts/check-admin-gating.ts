#!/usr/bin/env bun
/**
 * Fail the build if any admin page could still be read past the `/admin/*` gate.
 *
 * Everything under src/content/docs/admin/ is gated on `/admin/*`, but Pagefind's
 * search index is served from `/pagefind/*`, the sitemap from `/sitemap-0.xml`
 * and the agent index from `/llms.txt`, none of which that gate covers. An admin
 * page that reaches any of them hands its URL, and in Pagefind's case its full
 * text, to anyone who asks: the gate stays intact and the content is public
 * anyway.
 *
 * TWO CHECKS, RUN AT TWO POINTS IN THE BUILD, because they answer different
 * questions:
 *
 *   bun run scripts/check-admin-gating.ts            # source, before astro build
 *   bun run scripts/check-admin-gating.ts --built     # output, after astro build
 *
 * The source check is a fast early error that names the file you forgot, before
 * you wait on a build. It is NOT the gate, and it cannot be:
 *
 *   - `pagefind: false` is honoured only as a TOP-LEVEL frontmatter field
 *     (node_modules/@astrojs/starlight/schema.ts:105 declares it there, and
 *     components/Page.astro:39 sets `data-pagefind-body` unless
 *     `entry.data.pagefind !== false`). A line-matching check can be told what
 *     the text is but not what nesting depth it sits at, so a `pagefind: false`
 *     nested under `head:` used to satisfy the check while the page kept
 *     `data-pagefind-body` and landed in the index. Matching at column 0 closes
 *     that particular hole -- YAML cannot indent a nested key or a block-scalar
 *     line to column 0 -- but it is still an argument about source text.
 *   - `slug:` frontmatter decouples the source path from the published URL in
 *     BOTH directions: an admin source file can publish somewhere else, and a
 *     file outside src/content/docs/admin/ can publish under `/admin/`. No
 *     source-path-driven check can be complete about what is served at
 *     `/admin/*`.
 *
 * The `--built` check is therefore the deciding one: it reads what was actually
 * published and fails if an `/admin/` URL appears in a document served outside
 * the gate. It runs after `astro build`, so a leak fails the build after the
 * output exists rather than before -- which is fine, because Cloudflare Pages
 * deploys only on a zero exit from the build command, so a non-zero exit here
 * discards the whole deployment.
 *
 * Pagefind fragments are gzip behind a literal `pagefind_dcd` marker, so a plain
 * text search over dist/pagefind/ finds nothing EVEN WHEN THE CONTENT IS THERE.
 * That false pass is the trap this file exists to avoid; decompress or check
 * nothing.
 *
 * This repo has no CI, so the build chain is the only enforcement point that
 * actually runs. The Cloudflare Pages build invokes `bun run build`, which
 * invokes both halves of this script.
 */
import { existsSync, readdirSync, readFileSync } from "fs";
import { join, relative } from "path";

const DOCS_ROOT = join(import.meta.dir, "..");
const ADMIN_DIR = join(DOCS_ROOT, "src", "content", "docs", "admin");
const DIST = join(DOCS_ROOT, "dist");
const FRAGMENT_DIR = join(DIST, "pagefind", "fragment");

/** The path prefix that the `/admin/*` gate covers, as it appears in a URL. */
const GATED_PREFIX = "/admin/";

// Extensions Astro turns into a page. Assets that may sit beside the content
// (images, downloads) carry no frontmatter and are not pages, so they are not
// checked. `.astro` is in the list on purpose: it has no Starlight frontmatter
// to opt out with, so it gets reported rather than quietly skipped.
const PAGE_EXTENSIONS = [".md", ".mdx", ".markdown", ".mdoc", ".astro"];

// Matched per line instead of parsed as YAML to keep this script dependency-free
// (Bun and nothing else). Anchored at column 0 against the RAW line, never a
// trimmed one: Starlight reads only the top-level field, so an indented match is
// a false pass, and YAML gives every nested key and every block-scalar line at
// least one column of indentation. A quoted "false" is deliberately NOT
// accepted: Starlight's schema types this as a boolean and would reject it.
const OPT_OUT = /^pagefind:\s*false\s*(#.*)?$/;

/** The frontmatter lines of a page, or null when it has no frontmatter block. */
export function frontmatterLines(source: string): string[] | null {
  const lines = source.split("\n");
  if (lines[0]?.trim() !== "---") return null;
  const close = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
  if (close === -1) return null;
  return lines.slice(1, close);
}

/**
 * Whether the page opts out of Pagefind in the one place Starlight reads:
 * a top-level frontmatter field. `null` means there is no frontmatter at all.
 */
export function optsOutOfPagefind(source: string): boolean | null {
  const front = frontmatterLines(source);
  if (front === null) return null;
  return front.some((line) => OPT_OUT.test(line));
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

/**
 * The URL a Pagefind fragment describes, or null when the bytes cannot be read
 * as a fragment at all. A null is never "no admin URL here": the caller must
 * treat it as a failure, because an unreadable fragment is indistinguishable
 * from a fragment whose URL we failed to look at.
 */
export function fragmentUrl(bytes: Uint8Array): string | null {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const marker = buffer.indexOf("pagefind_dcd");
  const payload = marker >= 0 ? buffer.subarray(marker + "pagefind_dcd".length) : buffer;

  let text: string;
  try {
    text = new TextDecoder().decode(Bun.gunzipSync(payload));
  } catch {
    // A future Pagefind could stop compressing. Reading the payload as text is
    // a fallback, not a silent skip: if the URL is not in there either, this
    // returns null and the caller fails.
    text = new TextDecoder().decode(payload);
  }
  return text.match(/"url"\s*:\s*"([^"]*)"/)?.[1] ?? null;
}

/** `<loc>` URLs whose path is under the gate, for one sitemap document. */
export function gatedUrlsInSitemap(xml: string): string[] {
  const found: string[] = [];
  for (const match of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    const loc = match[1] as string;
    const path = loc.startsWith("http") ? new URL(loc).pathname : loc;
    if (path.startsWith(GATED_PREFIX)) found.push(loc);
  }
  return found;
}

/**
 * Markdown link targets under the gate in llms.txt. Matched as link targets
 * rather than as any occurrence of the string, so a public page that merely
 * mentions `/admin/` in its description does not fail the build.
 */
export function gatedLinksInLlmsTxt(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = match[1] as string;
    const path = target.startsWith("http") ? new URL(target).pathname : target;
    if (path.startsWith(GATED_PREFIX)) found.push(target);
  }
  return found;
}

function checkSource(): number {
  // A missing or empty admin tree means this check protects nothing, which is
  // indistinguishable from a rename that also moved the pages out from under the
  // /admin/* path gate. Fail closed and make a human confirm the move instead.
  if (!existsSync(ADMIN_DIR)) {
    console.error(
      `admin gating: ${relative(DOCS_ROOT, ADMIN_DIR)} does not exist.\n` +
        "If the admin section moved, update this script AND the /admin/* path gate to the new location.",
    );
    return 1;
  }

  const found = pages(ADMIN_DIR);
  if (found.length === 0) {
    console.error(
      `admin gating: no pages found under ${relative(DOCS_ROOT, ADMIN_DIR)}.\n` +
        "If the admin pages moved, update this script AND the /admin/* path gate to the new location.",
    );
    return 1;
  }

  const offenders: string[] = [];
  for (const page of found) {
    const optedOut = optsOutOfPagefind(readFileSync(page, "utf-8"));
    const rel = relative(DOCS_ROOT, page);
    if (optedOut === null) offenders.push(`${rel}: no frontmatter block`);
    else if (!optedOut) offenders.push(`${rel}: missing top-level 'pagefind: false'`);
  }

  if (offenders.length > 0) {
    console.error(
      `admin gating: ${offenders.length} of ${found.length} admin pages would be indexed by Pagefind:\n` +
        offenders.map((o) => `  ${o}`).join("\n") +
        "\n\nAdd 'pagefind: false' as a TOP-LEVEL frontmatter field of each page listed above.\n" +
        "Starlight reads the field only at the top level, so a nested one does not exclude the page.\n" +
        "Admin pages are gated on /admin/*, but the search index is served from /pagefind/*,\n" +
        "so an indexed admin page publishes its full text past that gate.",
    );
    return 1;
  }

  console.log(`admin gating: ${found.length} admin pages declare 'pagefind: false'`);
  return 0;
}

function checkBuilt(): number {
  const offenders: string[] = [];

  // No fragment directory means the search index was not built, so this check
  // would pass by inspecting nothing -- the exact failure mode it exists to
  // replace. Fail closed; a deliberate removal of site search should update
  // this script in the same commit.
  if (!existsSync(FRAGMENT_DIR)) {
    console.error(
      `admin gating: ${relative(DOCS_ROOT, FRAGMENT_DIR)} does not exist, so nothing was checked.\n` +
        "Run this after `astro build`. If site search was removed on purpose, update this script.",
    );
    return 1;
  }

  const fragments = readdirSync(FRAGMENT_DIR).filter((name) => name.endsWith(".pf_fragment"));
  if (fragments.length === 0) {
    console.error(`admin gating: no fragments in ${relative(DOCS_ROOT, FRAGMENT_DIR)}, so nothing was checked.`);
    return 1;
  }

  for (const name of fragments.sort()) {
    const url = fragmentUrl(readFileSync(join(FRAGMENT_DIR, name)));
    if (url === null) {
      offenders.push(`pagefind/fragment/${name}: unreadable, so its URL could not be checked`);
    } else if (url.startsWith(GATED_PREFIX)) {
      offenders.push(`pagefind/fragment/${name}: indexed ${url}`);
    }
  }

  for (const name of readdirSync(DIST).filter((n) => n.startsWith("sitemap") && n.endsWith(".xml"))) {
    for (const loc of gatedUrlsInSitemap(readFileSync(join(DIST, name), "utf-8"))) {
      offenders.push(`${name}: advertises ${loc}`);
    }
  }

  // llms.txt is generated from the content collection with an admin filter, and
  // unlike the index and the sitemap it is optional: absent is not a leak.
  const llms = join(DIST, "llms.txt");
  if (existsSync(llms)) {
    for (const link of gatedLinksInLlmsTxt(readFileSync(llms, "utf-8"))) {
      offenders.push(`llms.txt: links ${link}`);
    }
  }

  if (offenders.length > 0) {
    console.error(
      `admin gating: ${offenders.length} published reference(s) to ${GATED_PREFIX} outside the gate:\n` +
        offenders.map((o) => `  ${o}`).join("\n") +
        "\n\nThese documents are served from paths the /admin/* gate does not cover.\n" +
        "Exclude the page from Pagefind with a top-level 'pagefind: false', from the sitemap\n" +
        "with the filter in astro.config.mjs, and from llms.txt with the filter in src/pages/llms.txt.ts.",
    );
    return 1;
  }

  console.log(
    `admin gating: ${fragments.length} indexed pages, none under ${GATED_PREFIX}; ` +
      "no gated URL in the sitemap or llms.txt",
  );
  return 0;
}

if (import.meta.main) {
  const built = process.argv.includes("--built");
  process.exit(built ? checkBuilt() : checkSource());
}
