# memoscript

Single-file CLI for frictionless thought capture with Memos.

## Overview

memoscript is a zero-dependency Bun/TypeScript CLI for Memos, a self-hosted note service. Optimized for the 90% use case: capturing fleeting thoughts instantly without organizational overhead. The entire implementation fits in one file with a positional-first design where `memoscript "thought #tag"` creates a memo in under 2 seconds.

Key characteristics:

- Single-file implementation (memoscript.ts)
- Zero external dependencies (Bun native APIs only)
- Positional-first interface (content without subcommands)
- Dual-mode design (CLI and programmatic library)
- JSON output for composability

## Prerequisites

- [Bun runtime](https://bun.sh) installed
- Running Memos instance (self-hosted)
- Access token from your Memos instance (Settings > Access Tokens)

## Installation

Clone or download the memoscript directory:

```bash
cd /path/to/memoscript
chmod +x memoscript.ts
```

Optional: Create a symlink or alias for convenient access:

```bash
# Symlink (if ~/.local/bin is in PATH)
ln -s "$(pwd)/memoscript.ts" ~/.local/bin/memoscript

# Or add an alias to your shell config (~/.zshrc or ~/.bashrc)
alias m="memoscript"
```

## Setup

Run the interactive setup wizard:

```bash
memoscript init
```

This will:
1. Prompt for your Memos server URL (e.g., https://memos.example.com)
2. Prompt for your access token
3. Validate credentials with a test API call
4. Create `~/.config/memoscript/.env` with secure permissions (0600)

### Manual Configuration

Alternatively, create `~/.config/memoscript/.env` manually:

```bash
MEMOS_URL=https://memos.example.com
MEMOS_TOKEN=your_access_token_here
```

### Environment Variable Overrides

Configuration priority order (highest to lowest):

1. `MEMOS_URL` and `MEMOS_TOKEN` environment variables
2. `CLAUDE_MEMOS_URL` and `CLAUDE_MEMOS_TOKEN` environment variables (for PAI runtime)
3. `~/.config/memoscript/.env` config file

Example:

```bash
# Override config file for a single command
MEMOS_URL=https://staging.memos.dev memoscript list

# Or export for the session
export MEMOS_URL=https://staging.memos.dev
export MEMOS_TOKEN=staging_token_here
```

## Usage

### Create a Memo (Default Command)

The most common operation requires no subcommand:

```bash
# Quick thought capture
memoscript "quick thought about architecture"

# With inline tags (Memos parses #tags automatically)
memoscript "Learned about CAP theorem today #distributed #learning"

# With explicit visibility
memoscript "Private reflection" --visibility PRIVATE
memoscript "Public announcement" -v PUBLIC
```

Explicit create command (same result):

```bash
memoscript create "same as default behavior"
```

### Read from Stdin

Pipe multiline content or file contents:

```bash
# Explicit stdin flag
echo "Piped content" | memoscript -

# File contents
cat meeting-notes.md | memoscript -

# With flags
cat document.md | memoscript - --visibility PUBLIC
```

### List Memos

```bash
# Recent memos (default: 20, state: NORMAL)
memoscript list

# Limit results
memoscript list --limit 50
memoscript list -l 10

# Filter by tag
memoscript list --tag work
memoscript list -t learning

# Filter by state
memoscript list --state ARCHIVED
memoscript list -s NORMAL

# Custom filter expression (CEL syntax)
memoscript list --filter "content.contains('architecture')"
memoscript list -f "create_time > '2026-01-01T00:00:00Z'"

# Combine filters
memoscript list --tag work --limit 10 --state NORMAL

# Pagination
memoscript list --page eyJvZmZzZXQiOjIwfQ==

# Custom ordering
memoscript list --order "create_time DESC"
```

### Get a Memo

```bash
# By numeric ID
memoscript get 42

# By full resource name
memoscript get memos/42
```

### Update a Memo

```bash
# Update content
memoscript update 42 "revised thought about architecture"

# Update visibility only
memoscript update 42 --visibility PUBLIC
memoscript update 42 -v PRIVATE

# Update state
memoscript update 42 --state ARCHIVED
memoscript update 42 -s NORMAL

# Pin or unpin
memoscript update 42 --pin
memoscript update 42 --unpin

# Combine updates
memoscript update 42 "new content" --visibility PUBLIC --pin
```

### Delete a Memo

```bash
# Delete with confirmation prompt
memoscript delete 42
# > Delete memo memos/42? [y/N]

# Force delete (skip confirmation)
memoscript delete 42 --force
```

### Reserved Word Handling

If your content starts with a reserved command word (`init`, `list`, `get`, `update`, `delete`, `create`), use the `--` separator:

```bash
# Create a memo that starts with "list"
memoscript -- "list items for tomorrow"

# Or use explicit create
memoscript create "list items for tomorrow"
```

### Output Control

```bash
# Suppress output (quiet mode)
memoscript "silent memo" --quiet
memoscript "silent memo" -q

# Force JSON output (default for list/get, optional for create/update/delete)
memoscript create "explicit json" --json
```

## Library Usage

memoscript can be imported as a library for programmatic use. The `import.meta.main` guard prevents CLI execution when imported.

### Import Functions

```typescript
import {
  createMemo,
  listMemos,
  getMemo,
  updateMemo,
  deleteMemo
} from "./memoscript.ts";

import type {
  Memo,
  Visibility,
  State,
  Config,
  ListMemosResponse,
  MemoProperty,
  Attachment,
  MemoRelation,
  Reaction
} from "./memoscript.ts";

import { MemoscriptError } from "./memoscript.ts";
```

### Programmatic Example

```typescript
// Create a memo
const memo = await createMemo("Programmatic thought #api", {
  visibility: "PRIVATE"
});
console.log(`Created: ${memo.name}`);

// List recent memos with tag filter
const recent = await listMemos({
  tag: "api",
  limit: 10
});
console.log(`Found ${recent.memos.length} memos`);

// Get specific memo
const existing = await getMemo(42);
console.log(existing.content);

// Update memo
const updated = await updateMemo(42, {
  content: "Updated content",
  visibility: "PUBLIC"
});

// Delete memo
await deleteMemo(42, { force: true });

// Error handling
try {
  await createMemo("content");
} catch (error) {
  if (error instanceof MemoscriptError) {
    console.error(`${error.code}: ${error.message}`);
    if (error.hint) console.error(error.hint);
  }
}
```

## Configuration Reference

### Config Priority Table

| Source                   | Priority | Variables                          |
|--------------------------|----------|------------------------------------|
| Environment variables    | 1        | `MEMOS_URL`, `MEMOS_TOKEN`         |
| CLAUDE_ env variables    | 2        | `CLAUDE_MEMOS_URL`, `CLAUDE_MEMOS_TOKEN` |
| Config file              | 3        | `~/.config/memoscript/.env`        |

### Config Location Override

```bash
# Use a custom config directory
MEMOSCRIPT_CONFIG_DIR=/custom/path memoscript list
```

## Error Handling

memoscript uses structured error codes for actionable diagnostics:

| Error Code           | Meaning                                    | Exit Code |
|----------------------|--------------------------------------------|-----------|
| `ERR_NO_CONFIG`      | Configuration file not found               | 1         |
| `ERR_INVALID_CONFIG` | Missing or empty URL/token in config       | 1         |
| `ERR_API_AUTH`       | Authentication failed (401/403)            | 1         |
| `ERR_API_NOT_FOUND`  | Memo not found (404)                       | 1         |
| `ERR_API_SERVER`     | Server error (5xx)                         | 1         |
| `ERR_NETWORK`        | Cannot reach Memos server                  | 1         |
| `ERR_NO_CONTENT`     | No content provided to create command      | 1         |
| `ERR_NO_ARGS`        | No arguments provided to CLI               | 1         |
| `ERR_NO_UPDATES`     | No update fields provided to update command | 1         |
| `ERR_MISSING_ID`     | Missing memo ID for get/update/delete      | 1         |

All errors output to stderr with actionable hints:

```
Error [ERR_API_AUTH]: Authentication failed (HTTP 401): Invalid token
Hint: Check your token in ~/.config/memoscript/.env
Hint: Generate a new token in Memos Settings > Access Tokens
```

## Development

### Run Tests

```bash
bun test
```

### Verify Exports

Ensure library exports work correctly:

```bash
bun verify-exports.ts
```

### Type Checking

```bash
bun run tsc --noEmit
```

## Design Philosophy

memoscript optimizes for the 90% use case: capturing fleeting thoughts with zero organizational overhead. Key principles:

1. **Positional-first**: Content without subcommand (the common path)
2. **Zero dependencies**: Bun native APIs only
3. **Single file**: Entire implementation in one module
4. **JSON by default**: Composable with jq, grep, and other CLI tools
5. **Dual interface**: CLI and library in the same file
6. **Error transparency**: Structured codes with actionable hints

Comparison to alternatives:

| Tool      | Capture Latency | Cognitive Overhead       | Organization        |
|-----------|-----------------|--------------------------|---------------------|
| Obsidian  | ~15s            | Folder? Template? Links? | Manual, upfront     |
| memoscript| ~2s             | Content only             | Automatic (tags)    |

## API Reference

For detailed API documentation, see the exported TypeScript types:

```typescript
// Core operations
createMemo(content: string, options?: { visibility?: Visibility }): Promise<Memo>
listMemos(options?: ListMemosOptions): Promise<ListMemosResponse>
getMemo(id: number | string): Promise<Memo>
updateMemo(id: number | string, updates: UpdateOptions): Promise<Memo>
deleteMemo(id: number | string, options?: { force?: boolean }): Promise<void>

// Types
type Visibility = "PRIVATE" | "PROTECTED" | "PUBLIC"
type State = "NORMAL" | "ARCHIVED"
```

## License

MIT
