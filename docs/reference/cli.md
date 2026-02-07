# CLI Reference

`memoscript` is a command-line interface for the Memos server. It provides CRUD operations on memos, stdin piping, and an interactive setup wizard.

## Synopsis

```
memoscript <content>              # Create a memo (default behavior)
memoscript <command> [options]    # Run a named command
memoscript -                      # Read content from stdin
echo "text" | memoscript          # Piped input (TTY detection)
```

## Commands

### init

Interactive setup wizard. Prompts for a Memos server URL and access token, validates the credentials against the server, and writes the configuration to `~/.config/memoscript/.env` with `0600` permissions.

```bash
memoscript init
```

The `MEMOSCRIPT_CONFIG_DIR` environment variable overrides the default config directory.

### create

Explicitly create a memo. All positional arguments after `create` are joined as the memo content.

```bash
memoscript create "meeting notes from standup #work"
memoscript create "private thought" -v PRIVATE
```

### Default (no command)

When the first argument is not a reserved command name (`init`, `list`, `get`, `update`, `delete`, `create`), all positional arguments are treated as memo content.

```bash
memoscript "quick thought #idea"
memoscript remember to buy milk
```

### list

List memos with optional filters. Returns a JSON object containing a `memos` array and a `nextPageToken` string.

```bash
memoscript list
memoscript list --tag idea --limit 5
memoscript list --state ARCHIVED
memoscript list --filter "visibilities == ['PUBLIC']" --order "create_time desc"
memoscript list --page <token>
```

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--limit` | `-l` | `20` | Maximum number of memos to return (page size) |
| `--state` | `-s` | `NORMAL` | Filter by state: `NORMAL` or `ARCHIVED` |
| `--tag` | `-t` | -- | Filter by tag name (without `#`) |
| `--filter` | `-f` | -- | Custom CEL filter expression |
| `--page` | -- | -- | Page token for pagination (from `nextPageToken`) |
| `--order` | -- | -- | Order expression (e.g., `create_time desc`) |

The `--tag` and `--filter` flags can be combined. When both are present, they are joined with `&&`.

### get

Retrieve a single memo by ID. Accepts a numeric ID or the `memos/N` resource name format.

```bash
memoscript get 42
memoscript get memos/42
memoscript get 42 --quiet
```

### update

Update an existing memo. Accepts a numeric ID or `memos/N` format, followed by optional new content and flags. At least one update field (content, visibility, state, or pinned) is required.

```bash
memoscript update 42 "revised content"
memoscript update 42 --visibility PUBLIC
memoscript update 42 --state ARCHIVED
memoscript update 42 --pin
memoscript update 42 --unpin
memoscript update 42 "new text" --visibility PRIVATE --pin
```

| Option | Short | Description |
|--------|-------|-------------|
| `--visibility` | `-v` | Set visibility: `PRIVATE`, `PROTECTED`, or `PUBLIC` |
| `--state` | `-s` | Set state: `NORMAL` or `ARCHIVED` |
| `--pin` | -- | Pin the memo |
| `--unpin` | -- | Unpin the memo |

### delete

Delete a memo by ID. Prompts for confirmation unless `--force` is provided.

```bash
memoscript delete 42
memoscript delete 42 --force
memoscript delete memos/42 --force --quiet
```

Without `--force`, the CLI displays `Delete memo memos/<id>? [y/N]` and waits for input. Only `y` or `yes` (case-insensitive) confirms deletion.

## Stdin Input

Content can be piped into memoscript in two ways:

**Explicit stdin marker (`-`)**

```bash
echo "piped memo" | memoscript -
cat notes.md | memoscript - -v PRIVATE
```

**Implicit TTY detection**

When invoked with no arguments and stdin is not a TTY (i.e., input is piped), memoscript reads stdin automatically.

```bash
echo "auto-detected pipe" | memoscript
```

Both modes trim the input and reject empty content.

## Escaping Reserved Words

If memo content begins with a reserved command name, use the `--` separator to prevent it from being interpreted as a command.

```bash
memoscript -- delete old files from server
memoscript -- list of groceries for the week
```

Without `--`, the word `delete` or `list` would be parsed as a command.

## Global Flags

| Flag | Short | Type | Default | Applicable commands |
|------|-------|------|---------|---------------------|
| `--help` | `-h` | boolean | `false` | All (exits immediately) |
| `--quiet` | `-q` | boolean | `false` | All output commands |
| `--json` | -- | boolean | `true` | All output commands |
| `--visibility` | `-v` | string | -- | `create`, default, stdin, `update` |

`--help` / `-h` prints the built-in usage text and exits. It is recognized only as the first argument.

`--quiet` / `-q` suppresses all output. The operation still executes; only `console.log` output is silenced.

`--json` is the default output format. All command output is JSON printed with two-space indentation. The flag is accepted but has no behavioral effect since JSON is already the default.

## Flag Reference

Complete list of all flags, their short forms, types, defaults, and the commands that accept them.

| Flag | Short | Type | Default | Commands |
|------|-------|------|---------|----------|
| `--visibility` | `-v` | `PRIVATE\|PROTECTED\|PUBLIC` | -- | `create`, default, stdin, `update` |
| `--state` | `-s` | `NORMAL\|ARCHIVED` | `NORMAL` (list) | `list`, `update` |
| `--tag` | `-t` | string | -- | `list` |
| `--filter` | `-f` | string | -- | `list` |
| `--limit` | `-l` | integer | `20` | `list` |
| `--page` | -- | string | -- | `list` |
| `--order` | -- | string | -- | `list` |
| `--pin` | -- | boolean | -- | `update` |
| `--unpin` | -- | boolean | -- | `update` |
| `--force` | -- | boolean | `false` | `delete` |
| `--quiet` | `-q` | boolean | `false` | All |
| `--json` | -- | boolean | `true` | All |
| `--help` | `-h` | boolean | `false` | All (first arg only) |

## Configuration

Configuration is resolved in the following priority order:

1. Environment variables `MEMOS_URL` and `MEMOS_TOKEN`
2. `CLAUDE_`-prefixed variants (`CLAUDE_MEMOS_URL`, `CLAUDE_MEMOS_TOKEN`)
3. Config file at `$MEMOSCRIPT_CONFIG_DIR/.env` or `~/.config/memoscript/.env`

The config file uses `KEY=VALUE` format. Surrounding quotes on values are stripped. Lines starting with `#` are comments.

## Output

All commands produce JSON output to stdout with two-space indentation. Errors are written to stderr in the format:

```
Error [ERR_CODE]: Message
Hint: Suggested fix
```

Exit codes: `0` on success, `1` on application errors (`MemoscriptError`), `2` on unexpected fatal errors.

## Examples

```bash
# Setup
memoscript init

# Quick capture
memoscript "lunch with @alice tomorrow #calendar"

# Pipe a file as a memo
cat ~/notes/draft.md | memoscript - -v PRIVATE

# List recent public memos
memoscript list --filter "visibilities == ['PUBLIC']" --limit 10

# Archive a memo
memoscript update 87 --state ARCHIVED

# Pin a memo and change visibility
memoscript update 87 --pin --visibility PUBLIC

# Delete without confirmation
memoscript delete 87 --force

# Silent creation (scripting)
memoscript "automated log entry" --quiet
```
