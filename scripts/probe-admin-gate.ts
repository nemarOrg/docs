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

/** Pages that must keep working for everyone. A gate that also breaks the
 *  public site is not a success. */
const PUBLIC_PAGES = ["/", "/platform/api/", "/cli/commands/", "/platform/hosts-and-routes/"];

const UA = "nemar-admin-gate-probe/1.0 (+https://github.com/nemarOrg/docs)";

let failures = 0;
function check(ok: boolean, name: string, detail: string): void {
	if (!ok) failures++;
	console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
}

async function get(path: string): Promise<Response> {
	return fetch(`${base}${path}`, { redirect: "manual", headers: { "User-Agent": UA } });
}

console.log(`probing ${base}\n`);

for (const path of GATED_PAGES) {
	const res = await get(path);
	// 302 to the handoff is the expected refusal. 404 is also a refusal (it is
	// what a signed-in non-admin gets), and anything 2xx means the page was
	// served to nobody in particular, which is the failure this whole phase is
	// about.
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

// The search index is the bypass a path-scoped gate cannot close by itself, so
// it is checked here too. Fragments are gzip with a `pagefind_dcd` marker before
// the JSON, so a plain text search over them returns nothing even when the
// content IS present -- decompress, or this check silently passes.
{
	const entry = await get("/pagefind/pagefind-entry.json");
	if (entry.status !== 200) {
		check(true, "search index is absent", `status=${entry.status}, nothing to leak`);
	} else {
		const meta = (await entry.json()) as { languages?: Record<string, { hash?: string }> };
		const hashes = Object.values(meta.languages ?? {})
			.map((l) => l.hash)
			.filter((h): h is string => !!h);
		check(hashes.length > 0, "search index is readable for probing", `languages=${hashes.length}`);

		let adminHits = 0;
		for (const hash of hashes) {
			const idx = await get(`/pagefind/pagefind.${hash}.pf_meta`);
			if (!idx.ok) continue;
			const raw = new Uint8Array(await idx.arrayBuffer());
			let text: string;
			try {
				text = new TextDecoder().decode(Bun.gunzipSync(raw));
			} catch {
				text = new TextDecoder().decode(raw);
			}
			if (text.includes("/admin/")) adminHits++;
		}
		check(adminHits === 0, "no admin URL in the search index metadata", `hits=${adminHits}`);
	}
}

console.log(`\n${failures === 0 ? "all checks passed" : `${failures} check(s) FAILED`}`);
if (failures > 0) process.exit(1);
