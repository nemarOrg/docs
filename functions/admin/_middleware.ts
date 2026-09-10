/**
 * The gate on `/admin/*` (nemarOrg/nemar-cli#1336 phase 0, issue #1338).
 *
 * WHAT THIS REPLACED. Nothing. This section was described as edge-gated by
 * Cloudflare Access, and it was not: the Access app on this Pages project
 * covers PREVIEW deployments only, so every page under `/admin/` answered 200
 * to anyone on production and sat in the public sitemap. The material there is
 * procedures rather than credentials, and this repo is public, so no secret
 * leaked; what existed was a false safety claim that invited someone to write
 * one. This file is that claim made true.
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
 * to one host cannot authenticate another, so this host gets a credential of
 * its own: the website's authorize page proves an admin session and sends the
 * visitor back to `/__docs-auth/callback` with a code that dies in a minute.
 *
 * THIS FAILS CLOSED. If the API is unreachable, or answers anything this file
 * does not recognize, the page is refused. An access control that opens when
 * its authority is unreachable is not one, and the cost of the opposite choice
 * is bounded and obvious: during an API outage the operations runbooks are
 * unreadable here, and they are still readable in the repository they live in.
 *
 * The search index is handled separately and has to be: `/pagefind/*` is not
 * under `/admin/`, so this middleware never sees it. Admin pages carry
 * `pagefind: false`, enforced by `scripts/check-admin-gating.ts` in the build.
 */

/** Cookie this host sets for itself. Deliberately NOT the platform's
 *  `nemar_session`: two host-scoped cookies sharing one name is a debugging
 *  trap, and a distinct name makes a mix-up visible in a request dump. */
const DOCS_SESSION_COOKIE = "nemar_docs_session";

/** Header the API expects the session value in. A header rather than a cookie
 *  because this is a server-to-server call, not a browser cookie exchange. */
const DOCS_SESSION_HEADER = "X-Docs-Session";

const DEFAULT_API_BASE = "https://api.nemar.org";
const DEFAULT_APP_BASE = "https://app.nemar.org";

/** Where the website's handoff page lives. */
const AUTHORIZE_PATH = "/auth/docs/authorize";

interface Env {
	/** Overridable so a preview deployment can be pointed at staging. Defaults
	 *  to production, because identity is production: there is no separate
	 *  account database to sign in against. */
	readonly NEMAR_API_BASE?: string;
	readonly NEMAR_APP_BASE?: string;
}

interface MiddlewareContext {
	readonly request: Request;
	readonly env: Env;
	next(): Promise<Response>;
}

function readCookie(header: string | null, name: string): string | null {
	if (!header) return null;
	for (const part of header.split(";")) {
		const eq = part.indexOf("=");
		if (eq < 0) continue;
		if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
	}
	return null;
}

/** 404, matching the website's `adminGate`, which answers 404 rather than 403
 *  so the existence of the admin surface is not disclosed to someone who may
 *  not know it is there. Reaching this means a real signed-in account that is
 *  not an admin, so the answer is "there is nothing here", not "you may not". */
function notFound(): Response {
	return new Response(
		"<!doctype html><meta charset=utf-8><title>Not found</title><h1>404</h1>\n",
		{
			status: 404,
			headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" },
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

export async function onRequest(context: MiddlewareContext): Promise<Response> {
	const { request, env } = context;
	const url = new URL(request.url);
	const appBase = env.NEMAR_APP_BASE ?? DEFAULT_APP_BASE;
	const apiBase = env.NEMAR_API_BASE ?? DEFAULT_API_BASE;

	// `next` is the path the visitor asked for, and it can only ever be an
	// `/admin/*` path because that is the only place this middleware runs. So
	// there is nothing attacker-controlled to validate here; the website
	// validates it again on arrival anyway, since it is the side that turns it
	// into a redirect.
	const signIn = () =>
		Response.redirect(
			`${appBase}${AUTHORIZE_PATH}?next=${encodeURIComponent(url.pathname + url.search)}`,
			302,
		);

	const session = readCookie(request.headers.get("Cookie"), DOCS_SESSION_COOKIE);
	if (!session) return signIn();

	let verdict: Response;
	try {
		verdict = await fetch(`${apiBase}/auth/docs/verify`, {
			headers: {
				[DOCS_SESSION_HEADER]: session,
				// Forwarded so the platform records which browser is reading, since
				// the connecting address it sees is this edge rather than the person.
				"User-Agent": request.headers.get("User-Agent") ?? "nemar-docs-gate",
			},
		});
	} catch {
		return unavailable();
	}

	if (verdict.status === 403) return notFound();
	if (verdict.status === 401) {
		// Expired, revoked, or a value this host should stop presenting. Clear it
		// on the way out so the next request starts the handshake clean rather
		// than spending a round trip re-learning the same refusal.
		const redirect = new Response(null, {
			status: 302,
			headers: {
				location: `${appBase}${AUTHORIZE_PATH}?next=${encodeURIComponent(url.pathname + url.search)}`,
			},
		});
		redirect.headers.append(
			"Set-Cookie",
			`${DOCS_SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
		);
		return redirect;
	}
	if (!verdict.ok) return unavailable();

	// Authorized. Serve the static asset, then mark the response so it is never
	// stored in a shared cache and never indexed: this body is only correct for
	// the one request that carried a valid session.
	const response = await context.next();
	const out = new Response(response.body, response);
	out.headers.set("Cache-Control", "private, no-store");
	out.headers.set("X-Robots-Tag", "noindex, nofollow");
	return out;
}
