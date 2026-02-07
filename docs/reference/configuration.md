# Configuration Reference

Memoscript requires two values to operate: the URL of a Memos server and an access token. These can be provided through environment variables or a config file. This page documents every configuration source, their precedence, and the validation rules applied at load time.

## Configuration Priority

When `loadConfig()` runs, it resolves each value (`url` and `token`) independently through three tiers. The first tier that provides a non-empty value wins for that field.

| Priority | Source | Variables | Use case |
|----------|--------|-----------|----------|
| 1 (highest) | Environment variables | `MEMOS_URL`, `MEMOS_TOKEN` | Session overrides, CI/CD pipelines |
| 2 | PAI environment variables | `CLAUDE_MEMOS_URL`, `CLAUDE_MEMOS_TOKEN` | Injected by the PAI runtime |
| 3 (lowest) | Config file | `MEMOS_URL`, `MEMOS_TOKEN` in `.env` | Persistent local configuration |

If no value is found for either field after all three tiers, memoscript exits with `ERR_NO_CONFIG` and the hint `Run memoscript init to configure`.

## Config File

### Location

The default config file path is:

```
~/.config/memoscript/.env
```

Override the directory by setting `MEMOSCRIPT_CONFIG_DIR`:

```bash
export MEMOSCRIPT_CONFIG_DIR=/path/to/custom/dir
# memoscript will read /path/to/custom/dir/.env
```

### Format

The file uses `KEY=VALUE` syntax. Blank lines and lines starting with `#` are ignored. Values may optionally be wrapped in single or double quotes, which are stripped during parsing. Only the first `=` on a line is treated as the delimiter.

```dotenv
# Memos server configuration
MEMOS_URL=https://memos.example.com
MEMOS_TOKEN=your-access-token

# Quoted values are also accepted
MEMOS_URL="https://memos.example.com"
MEMOS_TOKEN='your-access-token'
```

## The `init` Command

```bash
memoscript init
```

The `init` command walks through interactive setup:

1. Prompts for the Memos server URL.
2. Prompts for an access token.
3. Validates the credentials by making a test API call (`GET /api/v1/memos?pageSize=1`).
4. Creates the config directory (`~/.config/memoscript/`, or `$MEMOSCRIPT_CONFIG_DIR`) if it does not exist.
5. Writes the `.env` file with permissions set to `0600` (owner read/write only).

If the test API call fails, the command aborts without writing any file.

## Manual Configuration

To configure memoscript without the interactive prompt, create the file by hand:

```bash
mkdir -p ~/.config/memoscript
cat > ~/.config/memoscript/.env << 'EOF'
MEMOS_URL=https://memos.example.com
MEMOS_TOKEN=your-access-token
EOF
chmod 600 ~/.config/memoscript/.env
```

Set file permissions to `600` to prevent other users from reading the token.

## Session Overrides

Export environment variables to override the config file for the current shell session. This is useful for testing against a different server or token without modifying the persisted config.

```bash
export MEMOS_URL=https://staging.memos.example.com
export MEMOS_TOKEN=staging-token
memoscript list
```

These variables take priority 1, so they override both the PAI variables and the config file.

To limit the override to a single invocation:

```bash
MEMOS_URL=https://other.host MEMOS_TOKEN=xyz memoscript list
```

## Validation Rules

After resolving the URL and token from the priority chain, memoscript applies these rules before any API call:

- **Both required** -- If either `url` or `token` is missing or empty after trimming, memoscript exits with `ERR_INVALID_CONFIG`.
- **URL trailing slash stripped** -- A trailing `/` on the URL is removed (e.g., `https://memos.example.com/` becomes `https://memos.example.com`).
- **Token trimmed** -- Leading and trailing whitespace is removed from the token.
- **URL trimmed** -- Leading and trailing whitespace is removed from the URL.

## Environment Variables Summary

| Variable | Purpose |
|----------|---------|
| `MEMOS_URL` | Memos server URL (priority 1) |
| `MEMOS_TOKEN` | Memos access token (priority 1) |
| `CLAUDE_MEMOS_URL` | Memos server URL via PAI runtime (priority 2) |
| `CLAUDE_MEMOS_TOKEN` | Memos access token via PAI runtime (priority 2) |
| `MEMOSCRIPT_CONFIG_DIR` | Override the config directory (default: `~/.config/memoscript`) |
