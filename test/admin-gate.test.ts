/**
 * Tests for the admin documentation gate (nemarOrg/nemar-cli#1336 phase 0, issue #1338).
 *
 * These call the two Pages Functions DIRECTLY, with a real `Bun.serve` standing
 * in for the platform API and a canned `next()` standing in for the static
 * asset. Nothing about the gate's own decisions is faked: every status, header
 * and cookie asserted below is produced by the real handler.
 *
 * WHY NOT DRIVE IT THROUGH `wrangler pages dev`. That was the first attempt and
 * it measures the wrong thing. Locally, wrangler serves a static asset without
 * invoking the Function when one exists at the path, so a request for a real
 * admin page never reached the middleware and every assertion "passed" by never
 * running. Deployed Pages is the other way round. Splitting the question fixes
 * both halves: this file proves the logic deterministically, and
 * `scripts/probe-admin-gate.ts` proves the routing against a deployed host,
 * which is the only place that question has a real answer.
 *
 * THE TWO CLASSES OF DEFECT THIS FILE EXISTS TO CATCH, both found by review
 * after the first version of the gate was written:
 *
 * 1. **Path spelling.** The gate was scoped to `/admin/*` in `_routes.json`,
 *    which Pages matches against the RAW pathname, while the asset server
 *    percent-decodes before looking up a file. So `/admin%2Fcommands/` invoked
 *    no Function and was then served as `/admin/commands/`. The gate is now
 *    site-wide and normalizes the path itself; the `normalizeRequestPath` cases
 *    below are that bypass, pinned.
 * 2. **Trusting any 2xx.** The middleware branched on 403 and 401 and treated
 *    everything else that was `ok` as an admin verdict, following redirects on
 *    the way. A 204, a 302 to something cheerful, or a maintenance page served
 *    as 200 all opened the gate. Only `200` plus `ok: true` does now.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import { onRequest as callback, safeNext } from "../functions/__docs-auth/callback";
import { isGatedPath, normalizeRequestPath, onRequest as gate, readCookies } from "../functions/_middleware";

const APP_BASE = "https://app.nemar.test";
const COOKIE = "__Host-nemar_docs_session";
const GATED = "https://docs.nemar.test/admin/operations/zarr-serving/";
const PUBLIC_URL = "https://docs.nemar.test/platform/api/";

let api: Server;
let apiBase: string;

/** The verdicts and malformed answers the middleware has to tell apart. */
beforeAll(() => {
	api = Bun.serve({
		port: 0,
		async fetch(req) {
			const url = new URL(req.url);
			if (url.pathname === "/auth/docs/verify") {
				const presented = req.headers.get("X-Docs-Session");
				switch (presented) {
					case "live-admin":
						return Response.json({ ok: true, username: "admin", role: "admin" });
					case "live-member":
						return Response.json({ ok: false, error: "not_authorized" }, { status: 403 });
					case "ok-false":
						// A 200 that says no. The original gate served the page for this.
						return Response.json({ ok: false });
					case "no-content":
						return new Response(null, { status: 204 });
					case "not-json":
						return new Response("<html>maintenance</html>", {
							status: 200,
							headers: { "content-type": "text/html" },
						});
					case "redirected":
						return new Response(null, {
							status: 302,
							headers: { location: `${apiBase}/auth/docs/cheerful` },
						});
					case "server-error":
						return new Response("boom", { status: 500 });
					default:
						return Response.json({ ok: false, error: "invalid_session" }, { status: 401 });
				}
			}
			// Where the redirect above points. Answers 200 so a followed redirect would
			// look like success.
			if (url.pathname === "/auth/docs/cheerful") return Response.json({ ok: true });
			if (url.pathname === "/auth/docs/exchange" && req.method === "POST") {
				const body = (await req.json()) as { code?: string };
				switch (body.code) {
					case "live-code":
						return Response.json({ session: "live-admin", max_age_seconds: 28800 });
					case "cookie-injection":
						return Response.json({ session: "abc; Domain=nemar.org", max_age_seconds: 60 });
					case "maxage-injection":
						return Response.json({ session: "abc", max_age_seconds: "1; Domain=nemar.org" });
					case "huge-maxage":
						return Response.json({ session: "abc", max_age_seconds: 99999999 });
					case "null-body":
						return Response.json(null);
					case "not-json":
						return new Response("nope", { status: 200 });
					default:
						return Response.json({ error: "invalid_grant" }, { status: 400 });
				}
			}
			return new Response("not found", { status: 404 });
		},
	});
	apiBase = `http://127.0.0.1:${api.port}`;
});

afterAll(() => {
	api.stop(true);
});

function env(overrides: Record<string, string> = {}) {
	return { NEMAR_API_BASE: apiBase, NEMAR_APP_BASE: APP_BASE, ...overrides };
}

const ASSET_BODY = "<h1>Zarr serving copy</h1>";

/** The static asset the gate serves once it has authorized the request. */
function asset(): Response {
	return new Response(ASSET_BODY, {
		status: 200,
		headers: {
			"content-type": "text/html",
			"cache-control": "public, max-age=0, must-revalidate",
		},
	});
}

function gateRequest(cookie?: string, url = GATED): Promise<Response> {
	return gate({
		request: new Request(url, cookie ? { headers: { Cookie: cookie } } : undefined),
		env: env(),
		next: async () => asset(),
	});
}

// --------------------------------------------------------------------------
// Path normalization: the bypass
// --------------------------------------------------------------------------

describe("normalizeRequestPath", () => {
	test("leaves an ordinary path alone", () => {
		expect(normalizeRequestPath("/admin/commands/")).toBe("/admin/commands/");
		expect(normalizeRequestPath("/platform/api/")).toBe("/platform/api/");
	});

	// Each of these was served to anonymous callers by the first version of the
	// gate, because `_routes.json` matched the raw spelling and the asset server
	// decoded afterwards.
	for (const [raw, expected] of [
		["/admin%2Fcommands/", "/admin/commands/"],
		["/%61dmin/commands/", "/admin/commands/"],
		["/ADMIN/commands/", "/admin/commands/"],
		["//admin/commands/", "/admin/commands/"],
		["/./admin/commands/", "/admin/commands/"],
		["/platform/../admin/commands/", "/admin/commands/"],
		["/admin/../admin/commands/", "/admin/commands/"],
		["/admin%2f%2ecommands/", "/admin/.commands/"],
		["/admin%252Fcommands/", "/admin/commands/"],
		["/admin\\commands/", "/admin/commands/"],
	] as const) {
		test(`normalizes ${raw}`, () => {
			expect(normalizeRequestPath(raw)).toBe(expected);
		});
	}

	test("resolves a traversal that leaves the gated tree", () => {
		expect(normalizeRequestPath("/admin/../platform/api/")).toBe("/platform/api/");
	});

	test("does not throw on a malformed escape", () => {
		expect(normalizeRequestPath("/admin/%zz")).toBe("/admin/%zz");
	});
});

describe("isGatedPath", () => {
	for (const gated of ["/admin", "/admin/", "/admin/commands/", "/admin/operations/x"]) {
		test(`gates ${gated}`, () => expect(isGatedPath(gated)).toBe(true));
	}
	for (const open of ["/", "/platform/api/", "/administrators/", "/cli/commands/", "/pagefind/x"]) {
		test(`does not gate ${open}`, () => expect(isGatedPath(open)).toBe(false));
	}
});

describe("the gate refuses every spelling of a gated path", () => {
	for (const raw of [
		"/admin%2Fcommands/",
		"/%61dmin/commands/",
		"/ADMIN/commands/",
		"//admin/commands/",
		"/./admin/commands/",
		"/platform/../admin/commands/",
		"/admin%252Fcommands/",
		"/admin\\commands/",
		"/admin",
	]) {
		test(`refuses ${raw} anonymously`, async () => {
			const res = await gateRequest(undefined, `https://docs.nemar.test${raw}`);
			expect(res.status).toBe(302);
			expect(await res.text()).not.toContain(ASSET_BODY);
		});
	}

	test("the redirect names the NORMALIZED path, not the spelling that arrived", async () => {
		const res = await gateRequest(undefined, "https://docs.nemar.test/admin%2Fcommands/");
		expect(res.headers.get("location")).toContain(encodeURIComponent("/admin/commands/"));
	});
});

describe("public paths are untouched", () => {
	test("a public page is served without contacting the API", async () => {
		const res = await gateRequest(undefined, PUBLIC_URL);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe(ASSET_BODY);
	});

	test("a public page keeps its own caching answer and is not marked noindex", async () => {
		const res = await gateRequest(undefined, PUBLIC_URL);
		expect(res.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
		expect(res.headers.get("x-robots-tag")).toBeNull();
	});

	test("a path that merely starts with the same letters is not gated", async () => {
		const res = await gateRequest(undefined, "https://docs.nemar.test/administrators/");
		expect(res.status).toBe(200);
	});
});

// --------------------------------------------------------------------------
// Verdict handling: only 200 plus ok:true opens the gate
// --------------------------------------------------------------------------

describe("the gate on a gated path", () => {
	test("an anonymous request is redirected to the website's handoff", async () => {
		const res = await gateRequest();
		expect(res.status).toBe(302);
		expect(res.headers.get("location") ?? "").toStartWith(`${APP_BASE}/auth/docs/authorize`);
	});

	test("the sign-in redirect is never cached", async () => {
		// A bare 302 with no cache header is heuristically cacheable, and this one is
		// only correct for a visitor who has no session.
		const res = await gateRequest();
		expect(res.headers.get("cache-control")).toBe("no-store");
	});

	test("the query string of the original request survives", async () => {
		const res = await gateRequest(undefined, `${GATED}?highlight=lock`);
		expect(res.headers.get("location")).toContain(encodeURIComponent("?highlight=lock"));
	});

	test("a live admin session is served the asset", async () => {
		const res = await gateRequest(`${COOKIE}=live-admin`);
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("Zarr serving copy");
	});

	test("the served page is private and never indexed", async () => {
		const res = await gateRequest(`${COOKIE}=live-admin`);
		expect(res.headers.get("cache-control")).toBe("private, no-store");
		expect(res.headers.get("x-robots-tag")).toContain("noindex");
	});

	test("a signed-in non-admin gets 404, not 403", async () => {
		const res = await gateRequest(`${COOKIE}=live-member`);
		expect(res.status).toBe(404);
	});

	test("the 404 is not cached either", async () => {
		// The same URL is a real page for the next visitor, who may be an admin.
		const res = await gateRequest(`${COOKIE}=live-member`);
		expect(res.headers.get("cache-control")).toBe("no-store");
	});

	test("a stale session is refused and the cookie cleared", async () => {
		const res = await gateRequest(`${COOKIE}=expired-or-forged`);
		expect(res.status).toBe(302);
		const setCookie = res.headers.get("set-cookie") ?? "";
		expect(setCookie).toContain(`${COOKIE}=;`);
		expect(setCookie).toContain("Max-Age=0");
	});

	// Each of these was a 200 with the asset body before the review.
	for (const [session, label] of [
		["ok-false", "a 200 whose body says ok: false"],
		["no-content", "a 204"],
		["not-json", "a 200 that is not JSON"],
		["redirected", "a 302 pointing at something that answers ok: true"],
		["server-error", "a 500"],
	] as const) {
		test(`fails CLOSED on ${label}`, async () => {
			const res = await gateRequest(`${COOKIE}=${session}`);
			expect(res.status).toBe(503);
			expect(await res.text()).not.toContain(ASSET_BODY);
		});
	}

	test("fails CLOSED when the API is unreachable", async () => {
		// Port 9 is discard: refused immediately, so this does not depend on a timeout.
		const res = await gate({
			request: new Request(GATED, { headers: { Cookie: `${COOKIE}=live-admin` } }),
			env: { NEMAR_API_BASE: "http://127.0.0.1:9", NEMAR_APP_BASE: APP_BASE },
			next: async () => asset(),
		});
		expect(res.status).toBe(503);
	});

	test("never serves the asset for any refusal", async () => {
		for (const cookie of [
			undefined,
			`${COOKIE}=live-member`,
			`${COOKIE}=bad`,
			`${COOKIE}=ok-false`,
			`${COOKIE}=no-content`,
		]) {
			const res = await gateRequest(cookie);
			expect(await res.text()).not.toContain(ASSET_BODY);
		}
	});
});

// --------------------------------------------------------------------------
// Cookies
// --------------------------------------------------------------------------

describe("readCookies", () => {
	test("returns every value of the name, in header order", () => {
		expect(readCookies(`a=1; ${COOKIE}=first; b=2; ${COOKIE}=second`, COOKIE)).toEqual([
			"first",
			"second",
		]);
	});

	test("matches the name exactly", () => {
		expect(readCookies(`not-${COOKIE}=x; ${COOKIE}_extra=y`, COOKIE)).toEqual([]);
	});

	test("skips an empty value", () => {
		expect(readCookies(`${COOKIE}=; ${COOKIE}=real`, COOKIE)).toEqual(["real"]);
	});
});

describe("a stale duplicate cookie does not lock an admin out", () => {
	test("a junk value ahead of a live one still authorizes", async () => {
		// The `__Host-` prefix stops a sibling host planting one at all; this covers
		// the browser that is still carrying a duplicate from before the rename.
		const res = await gateRequest(`${COOKIE}=stale-junk; ${COOKIE}=live-admin`);
		expect(res.status).toBe(200);
	});

	test("an infrastructure failure on one value is not reported as a refusal", async () => {
		const res = await gateRequest(`${COOKIE}=server-error; ${COOKIE}=bad`);
		expect(res.status).toBe(503);
	});
});

// --------------------------------------------------------------------------
// The callback
// --------------------------------------------------------------------------

describe("the callback that sets the docs cookie", () => {
	function callbackRequest(query: string): Promise<Response> {
		return callback({
			request: new Request(`https://docs.nemar.test/__docs-auth/callback?${query}`),
			env: env(),
		});
	}

	test("exchanges a live code and returns to the requested page", async () => {
		const res = await callbackRequest(
			`code=live-code&next=${encodeURIComponent("/admin/operations/zarr-serving/")}`,
		);
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/admin/operations/zarr-serving/");
	});

	test("sets a __Host- cookie with no Domain attribute", async () => {
		const res = await callbackRequest("code=live-code");
		const setCookie = res.headers.get("set-cookie") ?? "";
		expect(setCookie).toContain(`${COOKIE}=live-admin`);
		expect(setCookie).toContain("HttpOnly");
		expect(setCookie).toContain("Secure");
		expect(setCookie).toContain("SameSite=Lax");
		expect(setCookie).toContain("Path=/");
		expect(setCookie).not.toContain("Domain=");
	});

	// A misbehaving API must not be able to widen the credential past this host,
	// which is the one property the whole design rests on.
	test("refuses a session value that would inject a cookie attribute", async () => {
		const res = await callbackRequest("code=cookie-injection");
		expect(res.status).toBe(400);
		expect(res.headers.get("set-cookie")).toBeNull();
	});

	test("ignores a max-age that would inject an attribute", async () => {
		const res = await callbackRequest("code=maxage-injection");
		const setCookie = res.headers.get("set-cookie") ?? "";
		expect(setCookie).not.toContain("Domain=");
		expect(setCookie).toContain("Max-Age=28800");
	});

	test("clamps an absurd max-age", async () => {
		const res = await callbackRequest("code=huge-maxage");
		expect(res.headers.get("set-cookie")).toContain("Max-Age=86400");
	});

	test("answers 400 rather than throwing on a null body", async () => {
		const res = await callbackRequest("code=null-body");
		expect(res.status).toBe(400);
	});

	test("answers 400 rather than throwing on a non-JSON body", async () => {
		const res = await callbackRequest("code=not-json");
		expect(res.status).toBe(400);
	});

	test("answers 400 for a spent or unknown code rather than looping", async () => {
		const res = await callbackRequest("code=already-spent");
		expect(res.status).toBe(400);
		expect(res.headers.get("set-cookie")).toBeNull();
	});

	test("answers 400 when no code is presented", async () => {
		expect((await callbackRequest("next=/admin/")).status).toBe(400);
	});

	test("fails without setting a cookie when the API is unreachable", async () => {
		const res = await callback({
			request: new Request("https://docs.nemar.test/__docs-auth/callback?code=live-code"),
			env: { NEMAR_API_BASE: "http://127.0.0.1:9", NEMAR_APP_BASE: APP_BASE },
		});
		expect(res.status).toBe(400);
		expect(res.headers.get("set-cookie")).toBeNull();
	});
});

describe("safeNext", () => {
	// This value lands in a `Location` header, and an attacker can call the callback
	// directly without ever passing through the website, so the rule is duplicated
	// here on purpose: the website's own validator cannot be imported across repos.
	test("accepts a gated path", () => {
		expect(safeNext("/admin/operations/zarr-serving/")).toBe("/admin/operations/zarr-serving/");
	});

	test("falls back when absent", () => {
		expect(safeNext(null)).toBe("/admin/");
	});

	for (const hostile of [
		"//evil.example/admin/x",
		"https://evil.example/admin/x",
		"http://evil.example",
		"/\\evil.example",
		"\\\\evil.example",
		"/platform/api/",
		"/administrators/secret",
		"/ADMIN/x",
		"admin/x",
		"/admin/x\r\nSet-Cookie: a=b",
		"/admin/x\nLocation: https://evil.example",
	]) {
		test(`rejects ${JSON.stringify(hostile)}`, () => {
			expect(safeNext(hostile)).toBe("/admin/");
		});
	}

	// The cases only the decoded view catches.
	for (const encoded of [
		"%2F%2Fevil.example",
		"%2f%2fevil.example/admin/x",
		"/admin/..%2fplatform%2fapi",
		"/admin/%2e%2e/platform/",
		"/%61dmin/x",
		"/admin/x%00",
		"/admin/x%0d%0aSet-Cookie:%20a=b",
		"%5c%5cevil.example",
	]) {
		test(`rejects once decoded: ${encoded}`, () => {
			expect(safeNext(encoded)).toBe("/admin/");
		});
	}

	test("rejects a malformed escape rather than guessing", () => {
		expect(safeNext("/admin/%zz")).toBe("/admin/");
	});

	test("rejects a path that escapes the gated tree", () => {
		expect(safeNext("/admin/../platform/api/")).toBe("/admin/");
	});

	test("caps an absurdly long value", () => {
		expect(safeNext(`/admin/${"a".repeat(600)}`)).toBe("/admin/");
	});

	test("keeps a query string on an accepted path", () => {
		expect(safeNext("/admin/operations/zarr-serving/?highlight=..")).toBe(
			"/admin/operations/zarr-serving/?highlight=..",
		);
	});
});
