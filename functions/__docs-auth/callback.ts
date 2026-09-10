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

/** See the note on the same constant in `functions/_middleware.ts`: the `__Host-`
 *  prefix is what makes "valid on this host and nowhere else" a rule the browser
 *  enforces, rather than a property this code merely intends. */
const DOCS_SESSION_COOKIE = "__Host-nemar_docs_session";
const DEFAULT_API_BASE = "https://api.nemar.org";
const DEFAULT_APP_BASE = "https://app.nemar.org";

/** The only prefix a `next` value may point at, which is also the only prefix
 *  the gate protects. */
const GATED_PREFIX = "/admin/";

/** A docs session lasts a working day; anything longer from the API is clamped
 *  rather than trusted, and a missing or unusable value falls back to it. */
const DEFAULT_COOKIE_MAX_AGE_SECONDS = 8 * 60 * 60;
const MAX_COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60;

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
	// A path this long is either a mistake or someone probing what this endpoint
	// will reflect back into a header.
	if (raw.length > MAX_NEXT_LENGTH) return GATED_PREFIX;
	// Checked in BOTH the literal and the once-decoded form. `%2F%2Fevil.example`
	// is a protocol-relative URL wearing an encoding, and only the decoded view
	// sees that; requiring both to pass also refuses a value whose two views
	// disagree, rather than picking one and hoping the browser agrees.
	let decoded: string;
	try {
		decoded = decodeURIComponent(raw);
	} catch {
		// A malformed escape is not a path anything can reason about, and
		// `decodeURIComponent` throwing is the only signal of it.
		return GATED_PREFIX;
	}
	return isPlainGatedPath(raw) && isPlainGatedPath(decoded)
		? raw
		: GATED_PREFIX;
}

/** Cap on a `next` this Function will re-emit into a `Location` header. */
const MAX_NEXT_LENGTH = 512;

function isPlainGatedPath(value: string): boolean {
	// A newline or control character could split a header on a downstream proxy
	// less careful than this runtime. A character-code loop rather than a regex,
	// because a control-character class in a regex is what Biome's
	// `noControlCharactersInRegex` exists to flag, and literal control bytes in
	// source are invisible in a diff.
	for (let i = 0; i < value.length; i += 1) {
		const code = value.charCodeAt(i);
		if (code <= 0x1f || code === 0x7f) return false;
	}
	// Backslashes are path separators to the WHATWG URL parser for special
	// schemes, so `/\\evil.example` resolves as a HOST rather than a path.
	if (value.includes("\\")) return false;
	// Protocol-relative (`//host`) and absolute (`https://host`) both fail this
	// prefix check before any scheme is inspected, so there is no scheme-casing
	// bug available to it either.
	if (!value.startsWith(GATED_PREFIX)) return false;
	// `/admin/../platform/` stays on this origin, so it is not an open redirect,
	// but it leaves the tree this handoff exists to reach.
	const pathOnly = value.split(/[?#]/, 1)[0] ?? "";
	return !pathOnly.split("/").includes("..");
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
			// Never follow a redirect: a 302 that lands on something answering 200
			// would otherwise arrive here as a successful exchange.
			redirect: "manual",
			headers: {
				"content-type": "application/json",
				"User-Agent": request.headers.get("User-Agent") ?? "nemar-docs-gate",
			},
			body: JSON.stringify({ code }),
		});
	} catch {
		return failure(appBase);
	}
	if (exchanged.status !== 200) return failure(appBase);

	// Parsed defensively, and every field validated before it reaches a header.
	// This is a trusted caller today, so this is defence in depth -- but the two
	// values below are interpolated into `Set-Cookie`, and a `session` of
	// `abc; Domain=nemar.org` would silently widen the credential to every
	// `*.nemar.org` host, which is the one property the whole design rests on.
	let body: unknown;
	try {
		body = await exchanged.json();
	} catch {
		return failure(appBase);
	}
	if (!body || typeof body !== "object") return failure(appBase);
	const { session, max_age_seconds: maxAgeRaw } = body as {
		session?: unknown;
		max_age_seconds?: unknown;
	};
	// Cookie-value characters only: no `;`, no whitespace, nothing that could end
	// the value and start an attribute.
	if (typeof session !== "string" || !/^[A-Za-z0-9._~-]+$/.test(session)) {
		return failure(appBase);
	}
	const maxAge =
		typeof maxAgeRaw === "number" &&
		Number.isInteger(maxAgeRaw) &&
		maxAgeRaw > 0
			? Math.min(maxAgeRaw, MAX_COOKIE_MAX_AGE_SECONDS)
			: DEFAULT_COOKIE_MAX_AGE_SECONDS;

	// No `Domain` attribute, and a `__Host-` name so the browser refuses one: this
	// credential is valid here and nowhere else, which is what lets the platform's
	// own session stay scoped to the app host.
	const response = new Response(null, {
		status: 302,
		headers: { location: next },
	});
	response.headers.append(
		"Set-Cookie",
		`${DOCS_SESSION_COOKIE}=${session}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`,
	);
	response.headers.set("Cache-Control", "no-store");
	response.headers.set("X-Robots-Tag", "noindex");
	return response;
}
