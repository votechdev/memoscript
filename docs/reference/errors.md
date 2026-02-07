# Error Codes Reference

Memoscript uses structured errors with machine-readable codes, human-readable messages, and optional recovery hints. All errors exit with code 1 unless otherwise noted. Unhandled exceptions print `Fatal: <message>` and exit with code 2.

**Output format** (written to stderr):
```
Error [ERR_CODE]: Description of what went wrong
Hint: Suggested recovery action
```

---

## Configuration Errors

### ERR_NO_CONFIG
No config file at `~/.config/memoscript/.env` and no `MEMOS_URL`/`MEMOS_TOKEN` environment variables set.
```
Error [ERR_NO_CONFIG]: Configuration not found
Hint: Run memoscript init to configure
```
**Recovery:** Run `memoscript init` or export both `MEMOS_URL` and `MEMOS_TOKEN` environment variables.

### ERR_INVALID_CONFIG
Config file or env vars exist but `MEMOS_URL` or `MEMOS_TOKEN` is missing or empty.
```
Error [ERR_INVALID_CONFIG]: Invalid configuration: missing url or token
Hint: Run memoscript init to configure
```
**Recovery:** Re-run `memoscript init` or verify both values are non-empty in `~/.config/memoscript/.env`.

---

## API Errors

### ERR_API_AUTH
Memos server returned HTTP 401 or 403. The access token is invalid, expired, or lacks required permissions.
```
Error [ERR_API_AUTH]: Authentication failed (HTTP 401): Unauthorized
Hint: Check your token in ~/.config/memoscript/.env
Generate a new token in Memos Settings > Access Tokens
```
**Recovery:** Generate a new token in Memos under Settings > Access Tokens, then update via `memoscript init`.

### ERR_API_NOT_FOUND
Memos server returned HTTP 404. The requested memo ID does not exist.
```
Error [ERR_API_NOT_FOUND]: Not found (HTTP 404): memo not found
Hint: Verify the memo ID exists
```
**Recovery:** Confirm the ID with `memoscript list`. The memo may have been deleted by another client.

### ERR_API_SERVER
Memos server returned HTTP 5xx. The server encountered an internal error.
```
Error [ERR_API_SERVER]: Server error (HTTP 500): Internal Server Error
Hint: Check Memos server logs
```
**Recovery:** Inspect the Memos server logs. Verify the database is reachable and retry after the issue is resolved.

### ERR_API_ERROR
Non-success HTTP status not covered above (e.g., 400, 409, 422). No hint is provided.
```
Error [ERR_API_ERROR]: API error (HTTP 400): invalid field mask
```
**Recovery:** Check request parameters -- typically a client-side issue such as an invalid visibility value or malformed filter.

### ERR_NETWORK
The `fetch` call failed before receiving any HTTP response. The server is unreachable (DNS failure, connection refused, timeout).
```
Error [ERR_NETWORK]: Cannot reach Memos server at https://memos.example.com
Hint: Is the server running? Check: curl -s https://memos.example.com/api/v1/memos
```
**Recovery:** Verify the server URL, confirm the server is running, and check for firewall or DNS issues.

---

## Input Validation Errors

### ERR_NO_CONTENT
A create operation was attempted with no content -- via `create` command, default mode, `--` separator, or empty stdin pipe.
```
Error [ERR_NO_CONTENT]: No content provided
Hint: Usage: memoscript create <content>
```
The hint varies by invocation context (e.g., `echo 'content' | memoscript -` for stdin).

**Recovery:** Provide memo content as a positional argument or pipe it through stdin.

### ERR_NO_ARGS
CLI invoked with no arguments and stdin is a TTY (no piped input).
```
Error [ERR_NO_ARGS]: No arguments provided
Hint: Usage: memoscript [command] [args] ...
```
**Recovery:** Pass a command or memo content. Run `memoscript --help` for full usage.

### ERR_NO_UPDATES
The `update` command was called with an ID but no fields to change.
```
Error [ERR_NO_UPDATES]: No update fields provided
Hint: Provide at least one field to update: content, visibility, state, pinned
```
**Recovery:** Include at least one of: positional content, `--visibility`, `--state`, `--pin`, or `--unpin`.

### ERR_MISSING_ID
The `get`, `update`, or `delete` command was called without a memo ID argument.
```
Error [ERR_MISSING_ID]: Missing memo ID
Hint: Usage: memoscript get <id>
```
The hint reflects the specific command invoked (`get`, `update`, or `delete`) and its expected arguments.

**Recovery:** Supply the numeric memo ID as the second argument, e.g., `memoscript get 42`.

---

## Init Errors

### ERR_INIT_MISSING
During `memoscript init`, the user submitted an empty URL or token at the interactive prompt.
```
Error [ERR_INIT_MISSING]: URL and token are required
Hint: Both URL and token must be provided
```
**Recovery:** Re-run `memoscript init` and provide both values.

### ERR_INIT_AUTH
During `memoscript init`, the validation request to the Memos server returned a non-success status.
```
Error [ERR_INIT_AUTH]: Authentication failed: Unauthorized
Hint: Check your URL and token are correct
```
**Recovery:** Verify the server URL is reachable and the token is valid, then re-run `memoscript init`.
