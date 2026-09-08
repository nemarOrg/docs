---
title: "Command Reference"
description: "Overview of the nemar CLI's top-level commands, options, and shortcuts."
---

Overview of all available NEMAR CLI commands.

## Main Help

```bash
Usage: nemar [options] [command]

CLI for NEMAR (Neuroelectromagnetic Data Archive and Tools Resource)

NEMAR is a curated repository for neurophysiology data in BIDS format.
This CLI provides tools for uploading, downloading, and managing datasets.

Options:
  -v, --version       Output the current version
  --no-color          Disable colored output
  --verbose           Enable verbose output
  --help-all          Show detailed help with examples and descriptions
  --debug             Write a diagnostic log for this run (see NEMAR_DEBUG=1);
                      attach it to a bug report
  -h, --help          display help for command

Commands:
  admin               Admin commands (requires admin privileges)
  auth                Authentication management
  completion          Print a shell completion script, or refresh cached
                      dynamic candidates
  dataset             Dataset management
  doctor [options]    Check that required tools (git, git-annex, gh, aws, deno)
                      are installed
  help [command]      display help for command
  login [options]     Sign in with your browser (shortcut for 'auth login')
  logout [options]    Remove the active account (shortcut for 'auth logout')
  register [options]  Create or continue your account (alias for signup)
  sandbox [options]   Complete sandbox training before uploading datasets
  signup [options]    Create or continue your account (shortcut for 'auth
                      signup')
  switch [username]   Switch between accounts (shortcut for 'auth switch')
  whoami [options]    Show current user (shortcut for 'auth status')

Examples:
  $ nemar auth login              # Sign in with your browser
  $ nemar dataset validate ./my-dataset
  $ nemar dataset upload ./my-dataset -n "My EEG Dataset"
  $ nemar dataset download nm000104

Documentation:
  https://docs.nemar.org

Support:
  https://github.com/nemarOrg/nemar-cli/issues
```

Add `--help-all` to any command for the full description, environment variables, and examples,
not just the usage line (`nemar auth login --help-all`).
Add `--debug` (or set `NEMAR_DEBUG=1`) to write a diagnostic log for the run, credentials redacted;
see [Debugging and Bug Reports](/cli/reference/debugging/).

## Command Groups

| Command | Description |
|---------|-------------|
| [auth](/cli/commands/auth/) | Authentication and account management |
| [dataset](/cli/commands/dataset/) | Dataset management operations |
| [sandbox](/cli/commands/sandbox/) | Sandbox training (required before uploading) |
| [admin](/admin/commands/) | Administrative operations (admin only) |

## Root Shortcuts

`login`, `logout`, `signup`, `register`, `whoami`, and `switch` are shortcuts for the matching `auth` subcommand
(`nemar login` is `nemar auth login`, and so on), so you don't have to type `auth` for the commands you reach for most often.

## Other Root Commands

| Command | Description |
|---------|-------------|
| `nemar completion` | Print a shell completion script, or refresh cached dynamic candidates (`--task`, `--modality`, `--license`, `--bids-version`) |
| `nemar doctor` | Check that the required external tools (git, git-annex, gh, aws, deno) are installed |
