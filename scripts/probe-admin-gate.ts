/**
 * Probe a DEPLOYED docs host to confirm the `/admin/*` gate is actually in
 * force (nemarOrg/nemar-cli#1336 phase 0, issue #1338).
 *
 * WHY THIS EXISTS SEPARATELY FROM `test/admin-gate.test.ts`. That file proves
 * the middleware's decisions; it cannot prove that Cloudflare invokes the
 * middleware at all for a path that also exists as a static asset. Those are
 * different questions and they have different answers in different places:
 * `wrangler pages dev` serves the asset WITHOUT invoking the Function, while
 * deployed Pages invokes the Function first and falls back to the asset only
 * when no Function matches. So the routing half can only be verified against a
 * real deployment, which is what this does.
 *
 * WHAT THIS FILE IS FOR, AND WHAT IT MUST NOT CONTAIN. Only things that are
 * HTTP-observable from outside, by an anonymous client. It used to also fetch
 * `/pagefind/pagefind.<hash>.pf_meta` and assert the bytes did not contain
 * `/admin/`; that check could never fail. A `pf_meta` holds a format version
 * and a list of chunk hashes -- no page URLs and no page text -- so it passed
 * with the index fully populated and every admin page in it. Page URLs live in
 * `pagefind/fragment/*`, and enumerating those over HTTP means guessing their
 * content-hashed filenames, which is why the index assertion belongs where the
 * files are on disk: `scripts/check-admin-gating.ts --built`, run from
 * `bun run build`. Do not re-add a search-index check here.
 *
 * It needs no credentials, because the thing worth checking is what an
 * ANONYMOUS visitor gets. Run it after any deploy that touches the gate, the
 * routes file, or the admin section:
 *
 *   bun run scripts/probe-admin-gate.ts                      # docs.nemar.org
 *   bun run scripts/probe-admin-gate.ts https://<preview-url>
 */

const base = (process.argv[2] ?? "https://docs.nemar.org").replace(/\/+$/, "");

/** Every page that must be gated. Kept explicit rather than crawled: a crawl
 *  would only find pages that are linked, and an unlinked page is exactly the
 *  one that would be missed. */
const GATED_PAGES = [
	"/admin/",
	"/admin/commands/",
	"/admin/github-app-setup/",
	"/admin/disaster-recovery/",
	"/admin/disaster-recovery/disaster-recovery/",
	"/admin/disaster-recovery/future-fail-safes/",
	"/admin/disaster-recovery/restoration-guide/",
	"/admin/disaster-recovery/user-roles/",
	"/admin/operations/access-policies/",
	"/admin/operations/account-kinds/",
	"/admin/operations/account-tiers/",
	"/admin/operations/manifest-summary-backfill/",
	"/admin/operations/zarr-serving/",
];

/**
 * Spellings of a gated path that ARE NOT the canonical one. Every entry here was
 * served anonymously by the first version of this gate, so this list is a
 * regression test, not a hypothetical: the middleware then ran only for paths
 * `public/_routes.json` matched as raw text, while the asset server
 * percent-decodes before it looks up a file, so `/admin%2Fcommands/` invoked no
 * Function and was then served as `/admin/commands/`. Trimming this list back to
 * "the real paths" re-opens a hole that was already exploited once.
 *
 * `/admin` without a trailing slash is in the list for the neighbouring reason:
 * it is a path with no asset of its own, so what answers it is whatever runs
 * before the asset lookup.
 */
const BYPASS_SPELLINGS = [
	"/admin%2Fcommands/", // encoded separator: decoded by the asset server, not by a raw path match
	"/%61dmin/commands/", // encoded letter: same trick one character earlier
	"/ADMIN/commands/", // case: Cloudflare's asset lookup is not case-sensitive
	"//admin/commands/", // empty leading segment
	"/admin%252Fcommands/", // double-encoded separator: survives one decode pass
	"/admin", // no trailing slash, so no asset behind it either way
];

/** Pages that must keep working for everyone. A gate that also breaks the
 *  public site is not a success. */
const PUBLIC_PAGES = ["/", "/platform/api/", "/cli/commands/", "/platform/hosts-and-routes/"];

const UA = "nemar-admin-gate-probe/1.0 (+https://github.com/nemarOrg/docs)";

let failures = 0;
function check(ok: boolean, name: string, detail: string): void {
	if (!ok) failures++;
	console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
}

/**
 * The path is concatenated onto the base and parsed as one absolute URL, which
 * keeps every spelling above intact: the URL parser does not decode `%2F` or
 * `%61`, does not lower-case a path, and does not collapse `//`. It is NOT
 * `new URL(path, base)`, which reads a leading `//` as protocol-relative and
 * would send `//admin/commands/` to a host named `admin`. `assertVerbatim`
 * turns that reasoning into something that can fail rather than a comment that
 * can rot: a probe that silently normalizes its own request is a probe that
 * reports on a path nobody asked about.
 */
async function get(path: string): Promise<Response> {
	return fetch(`${base}${path}`, { redirect: "manual", headers: { "User-Agent": UA } });
}

function assertVerbatim(path: string): void {
	const sent = new URL(`${base}${path}`).pathname;
	if (sent !== path) {
		check(false, `probe sends the path verbatim: ${path}`, `client rewrote it to ${sent}`);
	}
}

console.log(`probing ${base}\n`);

for (const path of [...GATED_PAGES, ...BYPASS_SPELLINGS]) {
	assertVerbatim(path);

	const res = await get(path);
	// 302 to the handoff is the expected refusal. 404 is also a refusal (it is
	// what a signed-in non-admin gets), and anything 2xx means the page was
	// served to nobody in particular, which is the failure this whole phase is
	// about. Any OTHER 3xx is a failure too, and a telling one: a 301 or 308 to
	// the canonical path means the asset server answered before the gate did.
	const refused = res.status === 302 || res.status === 404;
	const location = res.headers.get("location") ?? "";
	check(refused, `gated anonymously: ${path}`, `status=${res.status}${location ? ` -> ${location}` : ""}`);

	if (res.status === 302) {
		check(
			location.includes("/auth/docs/authorize"),
			`refusal points at the sign-in handoff: ${path}`,
			`location=${location}`,
		);
	}
}

for (const path of PUBLIC_PAGES) {
	const res = await get(path);
	check(res.status === 200, `public page still serves: ${path}`, `status=${res.status}`);
}

console.log(`\n${failures === 0 ? "all checks passed" : `${failures} check(s) FAILED`}`);
if (failures > 0) process.exit(1);
