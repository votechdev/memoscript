# Architecture

This document explains the design decisions behind memoscript and the tradeoffs
they involve. It is not a guide to using the tool or a reference for its API.
The goal here is to answer "why is it built this way?"

## Single-file design

The entire implementation lives in `memoscript.ts` -- roughly 720 lines covering
types, configuration, error handling, API communication, CRUD operations, and the
CLI entry point.

The primary benefit is deployment simplicity. There is no build step, no module
resolution, no bundler configuration. A user runs `git clone` and the tool works.
A single file means a single thing to understand, a single thing to `chmod +x`,
and a single thing to symlink into `PATH`.

The tradeoff is a large file. At 720 lines this is manageable -- an experienced
reader can hold the full structure in their head. If memoscript grew to handle
attachments, webhooks, or multi-server sync, this decision would need revisiting.

**Why not split into modules?** Splitting would introduce import resolution,
force a decision about directory structure, and complicate the "clone and run"
story. The cognitive cost of navigating five 140-line files exceeds that of
reading one 720-line file with clear section comments, because each file
boundary adds indirection without adding abstraction.

## Positional-first CLI

Most CLI tools require a subcommand: `tool create "content"`. Memoscript does
not. The default behavior when no recognized command is given is to create a
memo: `memoscript "quick thought"`.

This optimizes for the 90% use case. Every extra word between the user's intent
and the created memo is friction. Removing the subcommand saves one word per
invocation, which compounds across hundreds of daily captures.

The cost is ambiguity. What happens when the user types `memoscript list`?
Memoscript resolves this with a reserved word set (`init`, `list`, `get`,
`update`, `delete`, `create`). If the first argument matches, it is treated as
a command. The `--` separator disambiguates when needed:
`memoscript -- "list items for tomorrow"`. This follows POSIX convention.

**Why not commander.js or yargs?** Memoscript has six commands and a handful of
flags. A manual `parseFlags` function handles this in roughly 40 lines. Pulling
in commander.js would add a dependency, increase startup time, and provide
abstractions for complexity that does not exist here.

## Dual CLI/library mode

The file ends with an `import.meta.main` guard. Bun sets this to `true` when
the file is executed directly and `false` when imported by another module. This
enables the same file to serve terminal users who run `memoscript "thought"` and
programmatic consumers who `import { createMemo } from "./memoscript.ts"`.

All CRUD functions and types are exported. The CLI is just one consumer of these
exports. An AI agent, a test suite, or a custom script can call the same
functions without shelling out to a subprocess. This avoids duplicating logic
between a CLI layer and a library package.

## Multi-priority config cascade

Configuration resolves through three tiers:

1. **Direct environment variables** (`MEMOS_URL`, `MEMOS_TOKEN`) -- highest
2. **CLAUDE-prefixed variables** (`CLAUDE_MEMOS_URL`, `CLAUDE_MEMOS_TOKEN`)
3. **Config file** (`~/.config/memoscript/.env`) -- lowest

Each tier serves a distinct use case. Direct env vars support one-off overrides
and CI. The `CLAUDE_` prefix tier exists for PAI runtime contexts, where an
orchestrating agent injects configuration without colliding with the user's own
env vars. The config file provides persistent defaults for interactive use. It
is written with `0600` permissions because it contains an API token.

Config is loaded fresh on every API request rather than cached at startup. This
keeps `apiRequest` stateless and means env var changes take effect immediately.

**Why not dotenv?** Memoscript's config file contains exactly two key-value
pairs. A 30-line `parseEnvFile` function handles this without a dependency. If
the config format grew to need multiline values or variable interpolation, this
decision would change.

## Structured error handling

Every error is a `MemoscriptError` carrying a human-readable message, a
machine-readable code (e.g., `ERR_API_AUTH`), and an optional hint suggesting
corrective action.

The machine-readable code enables scripting. A wrapper can match on
`ERR_NO_CONFIG` to trigger setup without parsing English messages. The hint
makes every error actionable: rather than "Authentication failed", the user
sees "Check your token in ~/.config/memoscript/.env" and "Generate a new
token in Memos Settings > Access Tokens".

All errors write to stderr. Successful output writes to stdout. This ensures
that piping output through `jq` never mixes error text into JSON.

## Zero dependencies

`package.json` lists one dev dependency (`bun-types`) and zero runtime
dependencies. HTTP requests, file I/O, .env parsing, and flag parsing all use
Bun built-ins or manual implementations.

Startup is fast because there is no `node_modules` tree to resolve. There is
no supply chain attack surface beyond Bun itself. There is no version matrix
to maintain and no breaking changes from upstream packages to absorb.

The cost is manual implementations. Each is under 50 lines because the
requirements are narrow: memoscript does not need retry logic, request
interceptors, or cookie management.

**Why not axios or got?** These add interceptors, retries, timeouts, and
progress events. Memoscript sends simple authenticated JSON requests to a
single server. The `apiRequest` function handles this in 30 lines. The
abstraction surface of axios would dwarf the actual usage.

## API request abstraction

All HTTP communication flows through `apiRequest`. It loads config, constructs
the URL, sets headers, makes the request, and delegates errors to
`handleApiError`. Every CRUD operation is a one-liner calling `apiRequest` with
a method, path, and optional body.

This creates a single chokepoint for cross-cutting concerns: authentication,
error mapping, URL construction. The function reloads config on every call
rather than accepting a config parameter, which keeps CRUD signatures clean
and ensures environment changes propagate immediately. The cost -- one file
read per request -- is negligible for a tool that makes one or two requests
per invocation.

## Summary of tradeoffs

| Decision | Benefit | Cost | Breaks down when... |
|---|---|---|---|
| Single file | Zero build step, clone-and-run | Large file | >1500 lines |
| Positional-first | Minimal capture friction | Reserved word ambiguity | >10 commands |
| Dual mode | One codebase, two interfaces | Bun-specific guard | Porting to Node |
| Config cascade | Supports human, agent, CI | Three places to check | Config debugging |
| Structured errors | Machine + human readable | Verbose error definitions | Hundreds of error types |
| Zero dependencies | No supply chain risk | Manual parsing code | Complex requirements |
| Stateless apiRequest | Simple mental model | Config reload per call | High-throughput batch use |

Each decision is optimized for a CLI tool that makes one to five API calls per
invocation, runs on a single user's machine, and prioritizes speed of capture
over feature breadth. A different set of constraints -- a multi-tenant server,
a GUI application, a tool with fifty commands -- would justify different choices.
