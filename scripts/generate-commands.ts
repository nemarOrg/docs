#!/usr/bin/env bun
/**
 * Generate command-reference pages from the live nemar CLI `--help`.
 *
 * Recurses the real command tree by parsing each command's "Commands:" section,
 * so nested groups (dataset publish, admin doi/ci/s3/notice/...) are discovered
 * automatically and the pages never drift from the implementation.
 *
 * Public groups -> commands/<group>.mdx ; admin -> admin/commands.mdx (gated).
 *
 * Usage: bun run scripts/generate-commands.ts
 */
import { execSync } from "child_process";
import { rmSync, writeFileSync } from "fs";
import { join } from "path";

const CLI = "/Users/yahya/Documents/git/nemar/nemar-cli/src/index.ts";
const DOCS = join(import.meta.dir, "..", "src", "content", "docs");

// Top-level groups to document. Root-level alias shortcuts (login, signup,
// whoami, switch, register, logout) intentionally omitted; they duplicate auth.
const GROUPS: { path: string; out: string; title: string; intro: string }[] = [
  { path: "auth", out: "cli/commands/auth.mdx", title: "auth", intro: "Authentication and account management." },
  { path: "dataset", out: "cli/commands/dataset.mdx", title: "dataset", intro: "Dataset management operations." },
  { path: "sandbox", out: "cli/commands/sandbox.mdx", title: "sandbox", intro: "Sandbox training (required before uploading)." },
  { path: "admin", out: "admin/commands.mdx", title: "admin", intro: "Administrative operations (requires admin privileges)." },
];

const ANSI = /\x1b\[[0-9;]*m/g;

// Each `bun run` cold-starts the CLI (~1-2s); memoize so the walk + emit passes
// don't pay for the same `--help` twice.
const cache = new Map<string, string>();

function help(path: string): string {
  if (cache.has(path)) return cache.get(path)!;
  let text: string;
  try {
    // `</dev/null` so an accidental prompt gets EOF instead of hanging.
    const out = execSync(`bun run ${CLI} ${path} --help --no-color </dev/null 2>&1`, {
      encoding: "utf-8",
      timeout: 30000,
    });
    text = out.replace(ANSI, "").trimEnd();
  } catch (e) {
    const err = e as { stdout?: string };
    text = (err.stdout ?? "").replace(ANSI, "").trimEnd();
  }
  cache.set(path, text);
  return text;
}

/** Parse the child command names listed under the "Commands:" block. */
function children(helpText: string): string[] {
  const lines = helpText.split("\n");
  const start = lines.findIndex((l) => /^Commands:/.test(l.trim()));
  if (start === -1) return [];
  const names: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    // A blank line ends the Commands block — Commander prints a blank line then
    // a footer ("  Run with --help-all ...") that is ALSO 2-space indented, so we
    // must stop here rather than read "Run" as a command.
    if (line.trim() === "") break;
    // Command entries are indented exactly 2 spaces; wrapped description
    // continuation lines are indented to the description column (deeper).
    if (/^ {2}\S/.test(line)) {
      const tok = line.trim().split(/\s+/)[0];
      // Real subcommand names are lowercase (login, setup-ssh, doi:create...).
      // Lowercase-only also rejects the "Run" footer token.
      if (tok && tok !== "help" && /^[a-z][a-z0-9:-]*$/.test(tok)) names.push(tok);
    } else if (!/^ {3,}/.test(line)) {
      break; // a dedented non-continuation line ends the block
    }
  }
  return names;
}

type Node = { path: string; depth: number };

function walk(rootPath: string): Node[] {
  const nodes: Node[] = [];
  const seen = new Set<string>();
  const visit = (path: string, depth: number) => {
    if (seen.has(path) || depth > 4) return; // guard against parser slips
    seen.add(path);
    nodes.push({ path, depth });
    for (const child of children(help(path))) {
      visit(`${path} ${child}`, depth + 1);
    }
  };
  visit(rootPath, 0);
  return nodes;
}

for (const group of GROUPS) {
  const nodes = walk(group.path);
  let doc = `---\ntitle: "${group.title}"\n---\n\n`;
  doc += `${group.intro}\n\n`;
  doc += `:::note\nThis page is generated from \`nemar ${group.path} --help\`. Run \`generate-commands.ts\` to refresh it.\n:::\n\n`;
  for (const node of nodes) {
    const heading = "#".repeat(Math.min(node.depth + 2, 6));
    doc += `${heading} ${node.path}\n\n`;
    doc += "```text\n" + help(node.path) + "\n```\n\n";
  }
  const outPath = join(DOCS, group.out);
  // Remove the migrated .md twin so the route doesn't collide with the new .mdx.
  try {
    rmSync(outPath.replace(/\.mdx$/, ".md"));
  } catch {}
  writeFileSync(outPath, doc);
  console.log(`  ${group.path}: ${nodes.length} commands -> ${group.out}`);
}

console.log("\nCommand reference regenerated.");
