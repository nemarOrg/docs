/**
 * Tests for the build guard that keeps the admin section out of every document
 * served outside the gate (nemarOrg/nemar-cli#1336 phase 0, issue #1338).
 *
 * WHY THIS GUARD NEEDS TESTS OF ITS OWN. It is the second half of the gate, and
 * it protects something the middleware cannot see: `/pagefind/*`, the sitemap and
 * `llms.txt` are all outside `/admin/`, so no request for them ever reaches the
 * middleware, while the search index otherwise carries the full text of every
 * admin page. Review found the first version of this guard passing a page that
 * was still indexed, so the guard's own correctness is load-bearing rather than
 * incidental.
 *
 * Every case below is a shape that was, or would have been, a false pass.
 */

import { describe, expect, test } from "bun:test";
import {
	fragmentUrl,
	gatedLinksInLlmsTxt,
	gatedUrlsInSitemap,
	optsOutOfPagefind,
} from "../scripts/check-admin-gating";

describe("optsOutOfPagefind", () => {
	test("accepts a top-level field, which is the only place Starlight reads it", () => {
		expect(optsOutOfPagefind("---\ntitle: X\npagefind: false\n---\nbody\n")).toBe(true);
	});

	test("REFUSES a nested field", () => {
		// The false pass review found: the guard tested `line.trim()`, so a
		// `pagefind: false` at any depth satisfied it while Starlight ignored it and
		// the page kept its `data-pagefind-body`.
		const nested = `---
title: X
head:
  - tag: meta
    attrs:
      name: robots
      pagefind: false
---
body
`;
		expect(optsOutOfPagefind(nested)).toBe(false);
	});

	test("refuses one indented inside a block scalar", () => {
		const scalar = `---
title: X
description: |
  pagefind: false
---
body
`;
		expect(optsOutOfPagefind(scalar)).toBe(false);
	});

	test("refuses the quoted spelling, which Starlight's schema rejects anyway", () => {
		// `pagefind` is typed boolean, so `"false"` is a schema error rather than an
		// opt-out. Accepting it here would let a build-breaking page look protected.
		expect(optsOutOfPagefind('---\ntitle: X\npagefind: "false"\n---\n')).toBe(false);
	});

	test("refuses true, and a page with the key absent", () => {
		expect(optsOutOfPagefind("---\ntitle: X\npagefind: true\n---\n")).toBe(false);
		expect(optsOutOfPagefind("---\ntitle: X\n---\n")).toBe(false);
	});

	test("tolerates a trailing comment and trailing spaces", () => {
		expect(optsOutOfPagefind("---\npagefind: false # gated\n---\n")).toBe(true);
		expect(optsOutOfPagefind("---\npagefind: false   \n---\n")).toBe(true);
	});

	test("answers null when there is no frontmatter to read", () => {
		// Distinct from `false` on purpose: the caller reports a different problem.
		expect(optsOutOfPagefind("# just markdown\n")).toBeNull();
		expect(optsOutOfPagefind("---\ntitle: unterminated\n")).toBeNull();
	});
});

describe("fragmentUrl", () => {
	function fragment(json: string, withMarker = true): Uint8Array {
		const body = Bun.gzipSync(new TextEncoder().encode(json));
		if (!withMarker) return body;
		const marker = new TextEncoder().encode("pagefind_dcd");
		const out = new Uint8Array(marker.length + body.length);
		out.set(marker, 0);
		out.set(body, marker.length);
		return out;
	}

	test("reads the URL out of a real gzip fragment behind its marker", () => {
		// The shape that matters: a plain text search over these bytes finds
		// nothing, which is why a `grep` over dist/pagefind is a false pass.
		const bytes = fragment('{"url":"/admin/operations/zarr-serving/","content":"secret"}');
		expect(fragmentUrl(bytes)).toBe("/admin/operations/zarr-serving/");
		expect(new TextDecoder().decode(bytes)).not.toContain("/admin/");
	});

	test("reads one with no marker", () => {
		expect(fragmentUrl(fragment('{"url":"/platform/api/"}', false))).toBe("/platform/api/");
	});

	test("falls back to plain text if a future Pagefind stops compressing", () => {
		const plain = new TextEncoder().encode('pagefind_dcd{"url":"/cli/commands/"}');
		expect(fragmentUrl(plain)).toBe("/cli/commands/");
	});

	test("answers null for bytes it cannot read as a fragment", () => {
		// Null must never be taken for "no admin URL here" -- an unreadable
		// fragment is indistinguishable from one whose URL we failed to look at, so
		// the caller has to fail on it.
		expect(fragmentUrl(new Uint8Array([1, 2, 3, 4]))).toBeNull();
		expect(fragmentUrl(fragment('{"no_url":true}'))).toBeNull();
	});
});

describe("gatedUrlsInSitemap", () => {
	test("finds an absolute admin URL", () => {
		const xml =
			"<urlset><url><loc>https://docs.nemar.org/admin/commands/</loc></url>" +
			"<url><loc>https://docs.nemar.org/platform/api/</loc></url></urlset>";
		expect(gatedUrlsInSitemap(xml)).toEqual(["https://docs.nemar.org/admin/commands/"]);
	});

	test("finds a relative one, and tolerates whitespace in the element", () => {
		expect(gatedUrlsInSitemap("<loc>\n  /admin/\n</loc>")).toEqual(["/admin/"]);
	});

	test("does not fire on a public page whose path merely starts the same way", () => {
		expect(gatedUrlsInSitemap("<loc>https://docs.nemar.org/administrators/</loc>")).toEqual([]);
	});

	test("returns nothing for a sitemap with no admin URL", () => {
		expect(gatedUrlsInSitemap("<urlset><url><loc>/cli/</loc></url></urlset>")).toEqual([]);
	});
});

describe("gatedLinksInLlmsTxt", () => {
	test("finds an admin link target", () => {
		expect(gatedLinksInLlmsTxt("- [Admin](/admin/commands/): reference")).toEqual([
			"/admin/commands/",
		]);
	});

	test("ignores prose that merely mentions the prefix", () => {
		// A public page's description may legitimately say `/admin/`; only a link
		// target advertises a gated page.
		expect(gatedLinksInLlmsTxt("- [Hosts](/platform/hosts-and-routes/): covers /admin/ too")).toEqual(
			[],
		);
	});

	test("resolves an absolute target before comparing", () => {
		expect(gatedLinksInLlmsTxt("[x](https://docs.nemar.org/admin/x/)")).toEqual([
			"https://docs.nemar.org/admin/x/",
		]);
	});
});
