/**
 * TEMPORARY feasibility probe for nemarOrg/nemar-cli#1338.
 *
 * The admin gate needs request-time logic on this site, and this site is a
 * git-connected Cloudflare Pages project. Whether Pages Functions actually
 * execute here is not answerable from the repo: it depends on the project's
 * build settings, and adding a `functions/` directory can also make the Pages
 * build start reading `wrangler.jsonc`, which in this repo is a Workers-shaped
 * config with no `pages_build_output_dir`.
 *
 * So this exists to answer that with a preview deployment rather than a guess.
 * It is deleted in the same PR that adds the real gate.
 */
export function onRequest(): Response {
	return new Response("gate-probe-ok\n", {
		headers: { "content-type": "text/plain; charset=utf-8" },
	});
}
