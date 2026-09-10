/**
 * Tests for the `/admin/*` gate (nemarOrg/nemar-cli#1336 phase 0, issue #1338).
 *
 * These call the two Pages Functions DIRECTLY, with a real `Bun.serve` standing
 * in for the platform API and a canned `next()` standing in for the static
 * asset. Nothing about the gate's own decisions is faked: every status, header
 * and cookie asserted below is produced by the real handler.
 *
 * WHY NOT DRIVE IT THROUGH `wrangler pages dev`. That was the first attempt and
 * it measures the wrong thing. Locally, wrangler serves a static asset without
 * invoking the Function when one exists at the path, so a request for a real
 * admin page never reached the middleware and every assertion below "passed"
 * by never running. Deployed Pages is the other way round -- "once you add
 * Functions on a Pages project, all requests by default will invoke your
 * Function", with assets as the fallback "if no Function is matched" -- so a
 * local run proves neither the logic nor the routing. Splitting them fixes
 * both halves: this file proves the logic deterministically, and
 * `scripts/probe-admin-gate.ts` proves the routing against a deployed host,
 * which is the only place that question has a real answer.
 *
 * `public/_routes.json` is what pins the routing down in production: it names
 * `/admin/*` and `/__docs-auth/*` as the only paths that invoke a Function, so
 * public pages stay pure static assets and the gated ones cannot be served
 * without the gate running first.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import { onRequest as callback, safeNext } from "../functions/__docs-auth/callback";
import { onRequest as gate } from "../functions/admin/_middleware";

const APP_BASE = "https://app.nemar.test";
const GATED = "https://docs.nemar.test/admin/operations/zarr-serving/";

let api: Server;
let apiBase: string;

/** The three verdicts the real `/auth/docs/verify` gives, plus the exchange. */
beforeAll(() => {
	api = Bun.serve({
		port: 0,
		async fetch(req) {
			const url = new URL(req.url);
			if (url.pathname === "/auth/docs/verify") {
				const presented = req.headers.get("X-Docs-Session");
				if (presented === "live-admin") {
					return Response.json({ ok: true, username: "admin", role: "admin" });
				}
				if (presented === "live-member") {
					return Response.json({ ok: false, error: "not_authorized" }, { status: 403 });
				}
				if (presented === "server-error") {
					return new Response("boom", { status: 500 });
				}
				return Response.json({ ok: false, error: "invalid_session" }, { status: 401 });
			}
			if (url.pathname === "/auth/docs/exchange" && req.method === "POST") {
				const body = (await req.json()) as { code?: string };
				if (body.code === "live-code") {
					return Response.json({ session: "live-admin", max_age_seconds: 28800 });
				}
				return Response.json({ error: "invalid_grant" }, { status: 400 });
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

/** The static asset the gate serves once it has authorized the request. */
function asset(): Response {
	return new Response("<h1>Zarr serving copy</h1>", {
		status: 200,
		headers: { "content-type": "text/html", "cache-control": "public, max-age=0, must-revalidate" },
	});
}

function gateRequest(cookie?: string, url = GATED): Promise<Response> {
	return gate({
		request: new Request(url, cookie ? { headers: { Cookie: cookie } } : undefined),
		env: env(),
		next: async () => asset(),
	});
}

describe("the gate on /admin/*", () => {
	test("an anonymous request is redirected to the website's handoff", async () => {
		const res = await gateRequest();
		expect(res.status).toBe(302);
		const location = res.headers.get("location") ?? "";
		expect(location.startsWith(`${APP_BASE}/auth/docs/authorize`)).toBe(true);
	});

	test("the redirect carries the page that was asked for", async () => {
		const res = await gateRequest();
		expect(res.headers.get("location")).toContain(
			encodeURIComponent("/admin/operations/zarr-serving/"),
		);
	});

	test("the query string of the original request survives the round trip", async () => {
		const res = await gateRequest(undefined, `${GATED}?highlight=lock`);
		expect(res.headers.get("location")).toContain(encodeURIComponent("?highlight=lock"));
	});

	test("a live admin session is served the asset", async () => {
		const res = await gateRequest("nemar_docs_session=live-admin");
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("Zarr serving copy");
	});

	test("the served page is private and never indexed", async () => {
		// The asset's own header says `public, max-age=0`; serving it behind a
		// session means that answer is wrong and has to be replaced, or a shared
		// cache could hand one admin's page to the next visitor.
		const res = await gateRequest("nemar_docs_session=live-admin");
		expect(res.headers.get("cache-control")).toBe("private, no-store");
		expect(res.headers.get("x-robots-tag")).toContain("noindex");
	});

	test("a signed-in non-admin gets 404, not 403", async () => {
		// Mirrors adminGate on the website: a status code must not tell someone
		// that a surface they cannot reach exists.
		const res = await gateRequest("nemar_docs_session=live-member");
		expect(res.status).toBe(404);
	});

	test("a stale or forged session is refused and the cookie cleared", async () => {
		const res = await gateRequest("nemar_docs_session=expired-or-forged");
		expect(res.status).toBe(302);
		const setCookie = res.headers.get("set-cookie") ?? "";
		expect(setCookie).toContain("nemar_docs_session=;");
		expect(setCookie).toContain("Max-Age=0");
	});

	test("the cookie is read out of a header that carries several", async () => {
		const res = await gateRequest("other=1; nemar_docs_session=live-admin; another=2");
		expect(res.status).toBe(200);
	});

	test("a cookie whose name merely ends with ours is not accepted", async () => {
		// `not_nemar_docs_session=live-admin` must not authenticate anything.
		const res = await gateRequest("not_nemar_docs_session=live-admin");
		expect(res.status).toBe(302);
	});

	test("it fails CLOSED when the API is unreachable", async () => {
		// Port 9 is discard: the connection is refused immediately, so this does
		// not depend on a timeout.
		const res = await gate({
			request: new Request(GATED, { headers: { Cookie: "nemar_docs_session=live-admin" } }),
			env: { NEMAR_API_BASE: "http://127.0.0.1:9", NEMAR_APP_BASE: APP_BASE },
			next: async () => asset(),
		});
		expect(res.status).toBe(503);
	});

	test("it fails CLOSED on an API error it does not recognize", async () => {
		const res = await gateRequest("nemar_docs_session=server-error");
		expect(res.status).toBe(503);
	});

	test("it never serves the asset for any refusal", async () => {
		// The one property that matters most: no refusal path may leak the body.
		for (const cookie of [undefined, "nemar_docs_session=live-member", "nemar_docs_session=bad"]) {
			const res = await gateRequest(cookie);
			expect(await res.text()).not.toContain("Zarr serving copy");
		}
	});
});

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

	test("sets a host-only, HttpOnly, Secure, SameSite=Lax cookie", async () => {
		const res = await callbackRequest("code=live-code");
		const setCookie = res.headers.get("set-cookie") ?? "";
		expect(setCookie).toContain("nemar_docs_session=live-admin");
		expect(setCookie).toContain("HttpOnly");
		expect(setCookie).toContain("Secure");
		expect(setCookie).toContain("SameSite=Lax");
		// No Domain attribute: this credential is valid on this host and nowhere
		// else, which is what lets the platform session stay scoped to the app.
		expect(setCookie).not.toContain("Domain=");
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
	// This value lands in a Location header, and an attacker can call the
	// callback directly without ever passing through the website, so the rule is
	// duplicated here on purpose: `safeDocsNext` in the website repo cannot be
	// imported across repositories.
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

	// The cases only the decoded view catches. A check on the literal string
	// alone accepts every one of these.
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
		expect(safeNext("/admin/100%")).toBe("/admin/");
	});

	test("rejects a path that escapes the gated tree", () => {
		expect(safeNext("/admin/../platform/api/")).toBe("/admin/");
	});

	test("caps an absurdly long value", () => {
		expect(safeNext(`/admin/${"a".repeat(600)}`)).toBe("/admin/");
	});

	test("keeps a query string on an accepted path", () => {
		// A `..` in a query is inert, so it must not cost a legitimate link.
		expect(safeNext("/admin/operations/zarr-serving/?highlight=..")).toBe(
			"/admin/operations/zarr-serving/?highlight=..",
		);
	});
});
