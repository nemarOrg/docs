/**
 * The gate on the admin documentation (nemarOrg/nemar-cli#1336 phase 0, issue #1338).
 *
 * WHAT THIS REPLACED. Nothing. This section was described as edge-gated by
 * Cloudflare Access, and it was not: the Access app on this Pages project covers
 * PREVIEW deployments only, so every page under `/admin/` answered 200 to anyone
 * on production. The material there is procedures rather than credentials, and
 * this repo is public, so no secret leaked; what existed was a false safety
 * claim that invited someone to write one. This file is that claim made true.
 *
 * WHY IT IS SITE-WIDE RATHER THAN `functions/admin/_middleware.ts`. It was
 * scoped to `/admin/` first, and that was bypassable. Pages decides whether to
 * invoke a Function by matching `_routes.json` against the RAW pathname, while
 * the asset server percent-decodes the pathname before looking up a file. So
 * `GET /admin%2Fcommands/` did not match an `/admin/*` rule, no Function ran,
 * and the asset server then decoded it to `/admin/commands/` and served the
 * gated page to anyone. `/%61dmin/commands/` is the same trick with a different
 * character.
 *
 * The lesson generalizes past that one input: an access control fronted by an
 * allowlist of path SPELLINGS is fail-open by construction, because it can only
 * ever enumerate the encodings someone has thought of. So this middleware runs
 * for every request and decides for itself, from a normalized path, and
 * `_routes.json` now excludes only prefixes that cannot resolve to an admin
 * page. If you narrow it again, you reopen this.
 *
 * WHY IT IS NOT CLOUDFLARE ACCESS. The gate is NEMAR's own ORCID-backed
 * session, so `users.role` in the platform database stays the single source of
 * truth for who is an admin. An Access policy would need a separately
 * maintained list of emails, which is a second copy of that answer, and a
 * second copy is the thing that drifts.
 *
 * WHY A HANDOFF EXISTS. The platform's web session cookie is scoped
 * `Domain=app.nemar.org` on purpose, so it never rides along with byte-range
 * fetches to the data host or search requests to the API host. A cookie scoped
 * to one host cannot authenticate another, so this host gets a credential of its
 * own: the website's authorize page proves an admin session and sends the
 * visitor back to `/__docs-auth/callback` with a code that dies in a minute.
 *
 * THIS FAILS CLOSED. Only an explicit `200` carrying `ok: true` is an admin
 * verdict; everything else refuses, including a redirect, a 204, a body that is
 * not JSON, and a 200 whose body says otherwise. An access control that opens
 * when its authority answers something it did not expect is not one.
 *
 * The search index is handled separately and has to be: `/pagefind/*` is not
 * under `/admin/`, so this middleware never gates it. Admin pages carry
 * `pagefind: false`, enforced against the BUILT index by the build.
 */

/** Cookie this host sets for itself.
 *
 *  `__Host-` is load-bearing, not decoration. Browsers refuse to accept a
 *  `__Host-` cookie that carries a `Domain` attribute or a path other than `/`,
 *  which is what makes "valid on this host and nowhere else" a rule the browser
 *  enforces rather than a comment. Without the prefix, any page on a sibling
 *  `*.nemar.org` host could set `nemar_docs_session=junk; Domain=nemar.org`;
 *  that cookie is sent here, RFC 6265 orders it ahead of ours, `verify` refuses
 *  it, and the 401 branch cannot delete it because a host-only clear does not
 *  match a domain-scoped cookie -- so the admin docs became permanently
 *  unreachable for that browser. */
const DOCS_SESSION_COOKIE = "__Host-nemar_docs_session";

/** Header the API expects the session value in. A header rather than a `Cookie`,
 *  because that call is server-to-server: nothing about it is a browser cookie
 *  exchange. */
const DOCS_SESSION_HEADER = "X-Docs-Session";

const DEFAULT_API_BASE = "https://api.nemar.org";
const DEFAULT_APP_BASE = "https://app.nemar.org";

/** Where the website's handoff page lives. */
const AUTHORIZE_PATH = "/auth/docs/authorize";

/** The gated tree, as a normalized path. */
const GATED_PREFIX = "/admin/";

interface Env {
	/** Overridable so a preview deployment can be pointed at staging. Defaults to
	 *  production, because identity is production: there is no separate account
	 *  database to sign in against. */
	readonly NEMAR_API_BASE?: string;
	readonly NEMAR_APP_BASE?: string;
}

interface MiddlewareContext {
	readonly request: Request;
	readonly env: Env;
	next(): Promise<Response>;
}

/**
 * Reduce a request path to the file it will actually resolve to, so the gate
 * cannot be dodged by spelling.
 *
 * Deliberately MORE aggressive than the asset server, which decodes once. Being
 * more aggressive can only ever gate more paths, never fewer, and no public page
 * has a name that decodes into `/admin/...`, so over-reach costs nothing while
 * under-reach is the bypass this exists to close.
 *
 * Bounded at three decode rounds: enough for the double and triple encodings a
 * prober reaches for (`%252e`, `%25%32%66`), and bounded so a pathological input
 * cannot spin here.
 */
export function normalizeRequestPath(rawPathname: string): string {
	let path = rawPathname;
	for (let round = 0; round < 3; round += 1) {
		let decoded: string;
		try {
			decoded = decodeURIComponent(path);
		} catch {
			// A malformed escape cannot be decoded further; what we have is what the
			// asset server will also fail to decode, so stop here rather than guess.
			break;
		}
		if (decoded === path) break;
		path = decoded;
	}
	// Backslashes are path separators to several URL parsers, so `/admin\x` and
	// `/admin/..\..` have to be seen as slashes before segments are resolved.
	path = path.replace(/\\/g, "/");

	const segments: string[] = [];
	for (const segment of path.split("/")) {
		// Empty segments collapse `//`, and `.` is inert.
		if (segment === "" || segment === ".") continue;
		if (segment === "..") {
			segments.pop();
			continue;
		}
		segments.push(segment);
	}
	const trailingSlash = path.endsWith("/") && segments.length > 0 ? "/" : "";
	// Lowercased for comparison only. Whether the asset store is case-sensitive is
	// not something this file should depend on: comparing case-insensitively gates
	// `/ADMIN/x` too, and gating a path that would have 404'd is harmless.
	return `/${segments.join("/")}${trailingSlash}`.toLowerCase();
}

/** True when a request resolves into the gated tree. */
export function isGatedPath(normalized: string): boolean {
	return (
		normalized === "/admin" ||
		normalized === "/admin/" ||
		normalized.startsWith(GATED_PREFIX)
	);
}

/**
 * Every value of the named cookie, in header order.
 *
 * All of them, not the first: with the `__Host-` prefix a sibling host can no
 * longer plant one, but a browser can still be carrying a stale duplicate from
 * before the rename, and refusing the whole request because the wrong one came
 * first would strand that person with no way to recover but clearing cookies.
 */
export function readCookies(header: string | null, name: string): string[] {
	if (!header) return [];
	const values: string[] = [];
	for (const part of header.split(";")) {
		const eq = part.indexOf("=");
		if (eq < 0) continue;
		if (part.slice(0, eq).trim() !== name) continue;
		const value = part.slice(eq + 1).trim();
		if (value) values.push(value);
	}
	return values;
}

/** 404, matching the website's `adminGate`, which answers 404 rather than 403 so
 *  the existence of the admin surface is not disclosed by a status code.
 *  Reaching this means a real signed-in account that is not an admin. */
function notFound(): Response {
	return new Response(
		"<!doctype html><meta charset=utf-8><title>Not found</title><h1>404</h1>\n",
		{
			status: 404,
			headers: {
				"content-type": "text/html; charset=utf-8",
				// Never cached: the same URL is a real page for the next visitor, who
				// may well be an admin.
				"cache-control": "no-store",
				"x-robots-tag": "noindex",
			},
		},
	);
}

function unavailable(): Response {
	return new Response(
		"<!doctype html><meta charset=utf-8><title>Unavailable</title>" +
			"<h1>Sign-in is unavailable</h1><p>The documentation sign-in service could not be " +
			"reached. Try again shortly.</p>\n",
		{
			status: 503,
			headers: {
				"content-type": "text/html; charset=utf-8",
				"cache-control": "no-store",
				"x-robots-tag": "noindex",
			},
		},
	);
}

function signInRedirect(
	appBase: string,
	target: string,
	clearCookie: boolean,
): Response {
	const headers = new Headers({
		location: `${appBase}${AUTHORIZE_PATH}?next=${encodeURIComponent(target)}`,
		// A bare 302 with no cache header is heuristically cacheable, and this one
		// is per-visitor: it is only correct for someone who has no session yet.
		"cache-control": "no-store",
	});
	if (clearCookie) {
		// Cleared with the same attributes it was set with, or the browser keeps it
		// and every later request spends a round trip re-learning the same refusal.
		headers.append(
			"Set-Cookie",
			`${DOCS_SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
		);
	}
	return new Response(null, { status: 302, headers });
}

/** One session value's verdict from the platform. */
type Verdict = "admin" | "not-admin" | "invalid" | "unavailable";

async function verify(
	apiBase: string,
	session: string,
	userAgent: string,
): Promise<Verdict> {
	let response: Response;
	try {
		response = await fetch(`${apiBase}/auth/docs/verify`, {
			// Never follow a redirect: a 302 to something that answers 200 would
			// otherwise arrive here as a success. `fetch` follows by default, which is
			// the wrong default for an authority check.
			redirect: "manual",
			headers: {
				[DOCS_SESSION_HEADER]: session,
				// Forwarded so the platform records which browser is reading, since the
				// address it sees is this edge rather than the person.
				"User-Agent": userAgent,
			},
		});
	} catch {
		return "unavailable";
	}

	if (response.status === 403) return "not-admin";
	if (response.status === 401) return "invalid";
	// Only an exact 200 is a candidate. A 204, a 3xx, a 5xx and anything else are
	// all "this is not an answer I understand", which must never open the gate.
	if (response.status !== 200) return "unavailable";

	let body: unknown;
	try {
		body = await response.json();
	} catch {
		// A 200 that is not JSON is a maintenance page or an interstitial, not a
		// verdict.
		return "unavailable";
	}
	if (
		body &&
		typeof body === "object" &&
		(body as { ok?: unknown }).ok === true
	)
		return "admin";
	return "unavailable";
}

export async function onRequest(context: MiddlewareContext): Promise<Response> {
	const { request, env } = context;
	const url = new URL(request.url);
	const normalized = normalizeRequestPath(url.pathname);

	// Everything outside the gated tree is served exactly as before. This runs for
	// every request, so this branch is the common one and must stay cheap.
	if (!isGatedPath(normalized)) return context.next();

	const appBase = env.NEMAR_APP_BASE ?? DEFAULT_APP_BASE;
	const apiBase = env.NEMAR_API_BASE ?? DEFAULT_API_BASE;
	// The path the visitor asked for, normalized: what goes into `next` is then a
	// path this host will actually serve, rather than the spelling that arrived.
	const target = `${normalized}${url.search}`;
	const userAgent = request.headers.get("User-Agent") ?? "nemar-docs-gate";

	const sessions = readCookies(
		request.headers.get("Cookie"),
		DOCS_SESSION_COOKIE,
	);
	if (sessions.length === 0) return signInRedirect(appBase, target, false);

	let sawUnavailable = false;
	let sawNotAdmin = false;
	for (const session of sessions) {
		const verdict = await verify(apiBase, session, userAgent);
		if (verdict === "admin") {
			// Authorized. Serve the asset, then replace the caching answer it carries:
			// the asset's own `public, max-age=0` is wrong for a body that is only
			// correct for the one request that presented a valid session.
			const response = await context.next();
			const out = new Response(response.body, response);
			out.headers.set("Cache-Control", "private, no-store");
			out.headers.set("X-Robots-Tag", "noindex, nofollow");
			return out;
		}
		if (verdict === "unavailable") sawUnavailable = true;
		if (verdict === "not-admin") sawNotAdmin = true;
	}

	// Prefer the honest infrastructure answer over a verdict about the account:
	// if any check could not be completed, this is not "you may not read this".
	if (sawUnavailable) return unavailable();
	if (sawNotAdmin) return notFound();
	return signInRedirect(appBase, target, true);
}
