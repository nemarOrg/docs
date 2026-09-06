---
title: "Debugging and Bug Reports"
description: "The global --debug flag and NEMAR_DEBUG=1: what the diagnostic log contains, what it redacts, where it lands, and how to attach it to a bug report."
---

Add `--debug` to any command, or set `NEMAR_DEBUG=1` in your environment, to have the CLI write a diagnostic log for that run.
It exists so a failing command can be handed over as one file instead of a back-and-forth over what version you ran, what your platform is, and which step failed.

```bash
nemar dataset upload ./my-dataset --debug

# or, for a command you cannot easily re-run with a flag added
NEMAR_DEBUG=1 nemar dataset upload ./my-dataset
```

## What the log contains

- **Environment.** CLI version, operating system and architecture, the Bun (or Node) runtime version, your active account (username, API URL, role, whether sandbox training is complete — never your API key), and the versions of the external tools NEMAR uses (git, git-annex, `gh`, `aws`, Deno).
- **Every NEMAR API request the run made.** Method, URL, status code, duration, request and response headers, and request and response bodies, in order.
- **The failing step,** when the command is one of the dataset-upload steps that reports one; other commands show `(none recorded)` rather than a guess.
- **The exit code** the command finished with.

This only covers calls to the NEMAR API itself, not every network call the CLI makes; a version check against the npm registry or an OpenNeuro import, for instance, is not recorded.

## What is redacted

Redaction happens as each request is recorded, before anything is held in memory, so a plaintext secret is never briefly present in the log. Masked, wherever they appear in a header, a body, or a URL:

- The `Authorization`, `Cookie`, and `X-Api-Key` headers.
- API keys, passwords, tokens, session tokens, SSH keys, and private keys.
- AWS access key IDs and secret access keys.
- The signature, security token, and credential query parameters on a presigned S3 URL (for example, inside an `upload_url` field).
- Email addresses, masked to their first character plus the domain (`j***@example.org`).

A secret passed as a command-line flag — `-k <key>`, `--key=<key>`, `--password <value>` — is stripped from the log's command line and from the log's filename, in every spelling the CLI accepts for that flag.

Bodies are truncated to 2 KB after redaction.
If a request body defeats redaction (for example, one nested far deeper than any real NEMAR API response), that entry is replaced with a note saying so rather than failing the command it belongs to; `--debug` is never allowed to change whether a command succeeds or what it prints beyond the log itself.

## Where the log lands

```text
<config dir>/logs/nemar-<ISO timestamp>-<command>.log
```

`<config dir>` is `~/.config/nemar` by default (see [Configuration](/cli/reference/configuration/)), so on most systems the file is under `~/.config/nemar/logs/`.
Only the **10 most recent** log files are kept; older ones are deleted automatically as new ones are written.

## The failure hint

Any command that exits non-zero prints one line naming the log file it just wrote:

```text
Debug log: /Users/you/.config/nemar/logs/nemar-2026-09-05T18-30-00-000Z-dataset-upload.log
```

If `--debug` was not on for that run, the line instead suggests re-running with `--debug` added. If `--debug` was on but the log could not be written (for example, an unwritable config directory), the CLI says so and asks you to attach the `[debug]` lines it printed to the terminal instead:

```text
Debug log could not be written (EACCES: permission denied); attach the [debug] lines above to the issue
```

This hint is suppressed under `--json` (along with every other status line) and for a `--help`, `--version`, or usage error, since those are not the kind of failure a log helps with.
With `--json`, or if you cannot find the printed path, the newest file under `<config dir>/logs/` is the one to attach.

## Filing a bug report

Open a bug report at [github.com/nemarOrg/nemar-cli/issues/new?template=bug_report.yml](https://github.com/nemarOrg/nemar-cli/issues/new?template=bug_report.yml). The form asks for the CLI version, your operating system, steps to reproduce, and the debug log itself, and requires you to confirm you reviewed the log for anything you would not want to share beyond what NEMAR already redacts (a local file path, for instance).

## `nemar doctor --report`

If you just want the environment section, without re-running a failing command or capturing any network trace, run:

```bash
nemar doctor --report
```

This prints the same environment block the debug log embeds — CLI and runtime versions, your active account (no API key), and external tool versions — as plain text you can paste directly into an issue.
