# NEMAR Documentation Research Notes

## Docs platform evaluation (2026-06-05)

**Context:** Choosing where to host NEMAR docs after pulling them out of `nemar-cli`. The
maintainer initially favored Mintlify with admin docs behind a password.

### Mintlify
- Auth methods: Dashboard (all plans), Password / OAuth / JWT (Enterprise, contact-sales only).
- Partial gating (`public: true` frontmatter, `groups`) is a config feature, not the paywall;
  the paywall is the auth *method*.
- OSS program (mintlify.com/oss-program): 10,250 AI credits/mo + custom domain + branding +
  analytics + API playground, permanently free for non-commercial OSS. Does NOT include
  authentication/SSO/gated pages.
- Hosted SaaS; cannot self-host. Off the NEMAR Cloudflare stack.
- Verdict: the requested "admin behind a login" is its most expensive tier; rejected.

### Astro Starlight (chosen)
- Bun/TypeScript, no Python. Matches `ww2.nemar.org` (Astro).
- Free Pagefind search; `starlight-links-validator` for build-time link checks.
- Self-hosts on Cloudflare (Workers Static Assets) on the SCCN account.
- Admin gating via Cloudflare Access (edge), decoupled from any docs vendor.

See `.context/decisions/0001-docs-platform-starlight.md` for the recorded decision.

## Command reference generation
- `nemar … --help` is offline and side-effect-free; `--no-color` strips ANSI.
- Commander prints subcommands under a `Commands:` block (2-space indent); the footer
  `  Run with --help-all …` is ALSO 2-space indented, so the parser must stop at the blank
  line before it and only accept lowercase command names (otherwise "Run" is read as a
  command and recursion explodes). See `scripts/generate-commands.ts`.
