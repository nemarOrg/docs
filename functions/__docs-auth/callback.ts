/**
 * The docs half of the admin sign-in handoff
 * (nemarOrg/nemar-cli#1336 phase 0, issue #1338).
 *
 * The website has already proved that the visitor holds an admin session and
 * has sent them here with a one-time code. This route spends that code for a
 * session value and sets it as a cookie for THIS host, which is the one thing
 * the platform API cannot do for us: only a response from this origin can set a
 * cookie on it, which is the entire reason the handoff exists.
 *
 * The code travels in a URL, so it is single-use and lives sixty seconds. What
 * it buys never travels in a URL at all: it arrives in a response body and
 * leaves in a `Set-Cookie`.
 *
 * `/__docs-auth/` cannot collide with a documentation page because no content
 * route starts with a double underscore.
 */

const DOCS_SESSION_COOKIE = "nemar_docs_session";
const DEFAULT_API_BASE = "https://api.nemar.org";
const DEFAULT_APP_BASE = "https://app.nemar.org";

/** The only prefix a `next` value may point at, which is also the only prefix
 *  the gate protects. */
const GATED_PREFIX = "/admin/";

interface Env {
	readonly NEMAR_API_BASE?: string;
	readonly NEMAR_APP_BASE?: string;
}

interface FunctionContext {
	readonly request: Request;
	readonly env: Env;
}

/**
 * Reduce a caller-supplied `next` to a safe same-host path, or fall back.
 *
 * This value lands in a `Location` header, so it is an open-redirect boundary
 * even though the party that set it just proved they were an admin: the visitor
 * arrives with whatever was in the URL, and nothing here can tell an admin's
 * own click from a link someone sent them. Rejecting anything that is not a
 * plain `/admin/` path is both sufficient and the whole check, and it is
 * duplicated deliberately -- the website validates it too, on the side that
 * builds this URL.
 */
export function safeNext(raw: string | null): string {
	if (!raw) return GATED_PREFIX;
	// A newline or control character could split a header on a downstream proxy
	// less careful than this runtime. Spelled with `\uXXXX` escapes rather than the
	// literal bytes: literal control characters are invisible in a diff, a review
	// and most editors, so the next person cannot tell a correct class from a
	// mangled one, and some tooling rewrites them silently.
	if (/[\u0000-\u001f\u007f]/.test(raw)) return GATED_PREFIX;
	// Backslashes are treated as slashes by some URL parsers, so `/\evil.example`
	// can be read as a protocol-relative host.
	if (raw.includes("\\")) return GATED_PREFIX;
	// Protocol-relative (`//host`) and absolute (`https://host`) both leave this
	// host. A single leading slash followed by the gated prefix is the only
	// accepted shape.
	if (!raw.startsWith(GATED_PREFIX)) return GATED_PREFIX;
	return raw;
}

function failure(appBase: string): Response {
	// Deliberately NOT a redirect back to the authorize page. That would work for
	// the common case and loop forever for an uncommon one, and a loop is a worse
	// failure than a page with a link on it.
	return new Response(
		"<!doctype html><meta charset=utf-8><title>Sign-in did not complete</title>" +
			"<h1>That documentation sign-in link is no longer valid</h1>" +
			`<p><a href="${appBase}/auth/docs/authorize">Start again</a>.</p>\n`,
		{
			status: 400,
			headers: {
				"content-type": "text/html; charset=utf-8",
				"cache-control": "no-store",
				"x-robots-tag": "noindex",
			},
		},
	);
}

export async function onRequest(context: FunctionContext): Promise<Response> {
	const { request, env } = context;
	const url = new URL(request.url);
	const apiBase = env.NEMAR_API_BASE ?? DEFAULT_API_BASE;
	const appBase = env.NEMAR_APP_BASE ?? DEFAULT_APP_BASE;

	const code = url.searchParams.get("code");
	const next = safeNext(url.searchParams.get("next"));
	if (!code) return failure(appBase);

	let exchanged: Response;
	try {
		exchanged = await fetch(`${apiBase}/auth/docs/exchange`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"User-Agent": request.headers.get("User-Agent") ?? "nemar-docs-gate",
			},
			body: JSON.stringify({ code }),
		});
	} catch {
		return failure(appBase);
	}
	if (!exchanged.ok) return failure(appBase);

	const body = (await exchanged.json()) as {
		session?: string;
		max_age_seconds?: number;
	};
	if (!body.session) return failure(appBase);

	// No `Domain` attribute, so the cookie is host-only. That is the point of the
	// whole design: this credential is valid here and nowhere else, which is what
	// lets the platform's own session stay scoped to the app host.
	const maxAge = body.max_age_seconds ?? 8 * 60 * 60;
	const response = new Response(null, { status: 302, headers: { location: next } });
	response.headers.append(
		"Set-Cookie",
		`${DOCS_SESSION_COOKIE}=${body.session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`,
	);
	response.headers.set("Cache-Control", "no-store");
	response.headers.set("X-Robots-Tag", "noindex");
	return response;
}
