# memoscript -- Memos CLI Specification

**Version:** 1.0.0
**Date:** 2026-02-05
**Status:** SPEC (WHAT/WHY before HOW)

---

## 1. Problem Statement

### The Fundamental Need: Frictionless Thought Capture

The human brain generates thoughts faster than any organizational system can file them.
Obsidian solves note *management* but introduces organizational overhead: which vault,
which folder, which template, what frontmatter, what links. That friction kills the
90% use case -- quick capture of a fleeting thought.

Memos (self-hosted) solves the storage problem with a flat, timestamped, tag-based model.
But its web UI still requires context-switching: open browser, navigate, click, type.

**memoscript** eliminates the last mile of friction: type a thought, hit enter, done.

### First Principles Decomposition

```
Thought capture latency = time_to_invoke + time_to_type + time_to_confirm
```

- **time_to_invoke**: Must be zero-config after setup. No flags, no subcommand for CREATE.
- **time_to_type**: The content itself. Irreducible.
- **time_to_confirm**: JSON response to stdout. Pipe to /dev/null if you don't care.

The fundamental constraint: **CREATE is 90% of usage.** The CLI design must optimize
for this reality, not for symmetry across CRUD operations.

### Why Not Obsidian?

| Dimension          | Obsidian                          | memoscript                     |
|--------------------|-----------------------------------|--------------------------------|
| Capture latency    | ~15s (open, navigate, create)     | ~2s (type, enter)              |
| Cognitive overhead | Folder? Template? Tags? Links?    | Content only. Tags inline.     |
| Organization       | Manual, upfront                   | Automatic (timestamps + tags)  |
| Retrieval          | File search, graph                | Filter by tag, date, content   |
| PAI Integration    | File I/O, complex                 | Function call, trivial         |

---

## 2. Architecture Overview

### Tier 1 CLI (llcli-style)

memoscript is a **single-file Tier 1 CLI** following the llcli pattern:

```
~/.claude/Bin/memoscript/
  memoscript.ts          # Complete implementation (~400 lines)
  package.json           # Bun + TypeScript
  tsconfig.json          # Strict mode
  .env.example           # Configuration template
  README.md              # Documentation
  QUICKSTART.md          # Common patterns
```

**Rationale for Tier 1:**
- 5 commands (create, list, get, update, delete) -- well within Tier 1 range
- No subcommands or complex nesting needed
- Zero external dependencies (Bun's native fetch is sufficient)
- Manual arg parsing keeps the binary small and startup instant

### Data Flow

```
                    CLI invocation                    PAI skill import
                         |                                 |
                         v                                 v
                  parseArguments()                  createMemo(content)
                         |                                 |
                         +---------> loadConfig() <--------+
                                         |
                                    MEMOS_URL + MEMOS_TOKEN
                                         |
                                         v
                                   apiRequest()
                                    /    |    \
                                   /     |     \
                              POST    GET/LIST  PATCH/DELETE
                               |        |          |
                               v        v          v
                         Memos API (self-hosted instance)
                               |        |          |
                               v        v          v
                           formatOutput()
                               |
                          JSON to stdout
```

### Dual Interface Design

memoscript serves two masters simultaneously:

1. **CLI Interface** -- Human types commands in terminal
2. **PAI Integration** -- Claude skills import and call functions directly

Both paths converge at the same core functions. The CLI is a thin shell
over the same functions PAI uses. This is not a layered architecture --
it is a single module with two entry points.

---

## 3. Configuration Strategy

### Decision: Environment File with Fallback to Env Vars

**Config file:** `~/.config/memoscript/.env`

```bash
MEMOS_URL=https://memos.example.com
MEMOS_TOKEN=your_access_token_here
```

**Env var override:** `MEMOS_URL` and `MEMOS_TOKEN` environment variables
take precedence over the file. This enables:
- Per-session overrides without editing config
- CI/CD and automation contexts
- Docker/container usage

**Why not `~/.claude/.env`?**
memoscript is a standalone tool that happens to integrate with PAI. Its config
should live in its own namespace (`~/.config/memoscript/`) following XDG conventions.
PAI skills call the exported functions which read from the same config path.

**PAI Context:** In addition to the standard config, `memoscript` will check for `CLAUDE_MEMOS_URL` and `CLAUDE_MEMOS_TOKEN` which may be provided by the PAI runtime environment (e.g., from `~/.claude/settings.local.json`), allowing for zero-config operation within Claude.

**Why not a JSON/TOML config file?**
A `.env` file is the simplest format that works. Two key-value pairs don't need
schema validation or nested structure. The `dotenv` pattern is universally understood.

### Config Loading Algorithm

```
1. Check MEMOS_URL env var
2. Check MEMOS_TOKEN env var
3. If either missing, read ~/.config/memoscript/.env
4. Merge: env vars override file values
5. Validate: both URL and TOKEN must be non-empty
6. Crash with actionable error if invalid
```

### Init Command

```bash
memoscript init
```

Interactive setup that:
1. Prompts for Memos instance URL
2. Prompts for access token
3. Validates by making a test API call (GET /api/v1/memos?pageSize=1)
4. Writes `~/.config/memoscript/.env` with `0600` permissions.
5. Provides a suggested shell alias or symlink command for the user to add to their `.zshrc` or `.bashrc`.
6. Confirms success.

This runs exactly once. After that, zero-config invocation.

---

## 4. CLI Interface Design

### Design Decision: Positional-First, Subcommands for Everything Else

The fundamental insight: CREATE is the default action. If you give memoscript
text and no command, it creates a memo. Everything else uses explicit subcommands.

```
memoscript <content>              # CREATE (default -- the 90% case)
memoscript create <content>       # CREATE (explicit, same result)
memoscript list [options]         # LIST with filters
memoscript get <id>               # GET single memo
memoscript update <id> <content>  # UPDATE memo content
memoscript delete <id>            # DELETE memo
memoscript init                   # One-time setup
memoscript --help                 # Help text
```

**Handling Collisions:**
The CLI maintains a list of reserved subcommands (`init`, `list`, `get`, `update`, `delete`, `create`). If the first argument matches one of these, it is treated as a command.

*   To create a memo starting with a reserved word: `memoscript create "list items for tomorrow"`
*   Alternatively, use the `--` separator: `memoscript -- "list items for tomorrow"`

**Why positional content as default?**

Compare the cognitive load:

```bash
# Our design -- zero overhead
memoscript "Meeting with Sarah: discuss Q3 roadmap #work #meeting"

# Alternative: explicit subcommand (unnecessary friction for 90% case)
memoscript create "Meeting with Sarah: discuss Q3 roadmap #work #meeting"

# Alternative: flag-based (worst -- flags for content is absurd)
memoscript --create --content "Meeting with Sarah..."
```

The first form wins because it maps directly to the mental model:
"I have a thought, I want to save it." No intermediary concepts.

### Command Reference

#### CREATE (Default)

```bash
# Positional (preferred -- zero friction)
memoscript "Quick thought about architecture"

# With inline tags (Memos parses #tags from content)
memoscript "Learned about CAP theorem today #distributed #learning"

# Explicit visibility
memoscript "Private reflection" --visibility private

# Pipe from stdin (for long-form or multiline)
echo "Multi-line\nthought" | memoscript -

# From file
cat notes.md | memoscript -
```

**Stdin Behavior:**
- `memoscript -`: Explicitly reads from stdin.
- `memoscript` (no args): If stdin is a pipe, reads from it. If stdin is a TTY, displays help.

**Tag Parsing:**
Memos parses `#tags` server-side from the content string. The CLI does not need to extract tags manually unless required for local display logic; it sends the raw content string to the API.

**Flags:**
| Flag                  | Short | Default   | Description                          |
|-----------------------|-------|-----------|--------------------------------------|
| `--visibility <vis>`  | `-v`  | (server)  | PRIVATE, PROTECTED, or PUBLIC        |
| `--json`              |       | false     | Force JSON output (for piping)       |
| `--quiet`             | `-q`  | false     | Suppress output (just create)        |

**API Mapping:**
```
POST /api/v1/memos
Body: { "content": "<text>", "visibility": "<VIS>" }
Headers: Authorization: Bearer <token>
```

#### LIST

```bash
# Recent memos (default: 20)
memoscript list

# With limit
memoscript list --limit 50

# Filter by tag
memoscript list --tag work

# Filter by date range
memoscript list --filter "create_time > '2026-01-01T00:00:00Z'"

# Search content
memoscript list --filter "content.contains('architecture')"

# Archived memos
memoscript list --state archived

# Combine filters
memoscript list --tag work --limit 10 --state normal
```

**Flags:**
| Flag               | Short | Default  | Description                              |
|--------------------|-------|----------|------------------------------------------|
| `--limit <n>`      | `-l`  | 20       | Max results per page                     |
| `--tag <tag>`      | `-t`  | (none)   | Filter by tag (sugar for --filter)       |
| `--state <state>`  | `-s`  | NORMAL   | NORMAL or ARCHIVED                       |
| `--filter <expr>`  | `-f`  | (none)   | Raw CEL filter expression                |
| `--page <token>`   |       | (none)   | Pagination token for next page           |
| `--order <field>`  |       | (none)   | Order by field (e.g., create_time)       |
| `--json`           |       | true     | JSON output (default for list)           |

**API Mapping:**
```
GET /api/v1/memos?pageSize=<limit>&state=<STATE>&filter=<expr>&pageToken=<token>&orderBy=<field>
```

**Tag filter sugar:** `--tag work` translates to `--filter "tag == 'work'"`
before sending to the API. This avoids users needing to know CEL syntax
for the most common filter operation.

#### GET

```bash
# Get by memo ID (numeric)
memoscript get 42

# Get by full resource name
memoscript get memos/42
```

**API Mapping:**
```
GET /api/v1/memos/<id>
```

#### UPDATE

```bash
# Update content
memoscript update 42 "Revised thought about architecture"

# Update visibility only
memoscript update 42 --visibility public

# Update content and visibility
memoscript update 42 "New content" --visibility private

# Archive a memo
memoscript update 42 --state archived

# Pin a memo
memoscript update 42 --pin
```

**Flags:**
| Flag                 | Short | Description                              |
|----------------------|-------|------------------------------------------|
| `--visibility <vis>` | `-v`  | Change visibility                        |
| `--state <state>`    | `-s`  | Change state (NORMAL, ARCHIVED)          |
| `--pin`              |       | Pin the memo                             |
| `--unpin`            |       | Unpin the memo                           |

**API Mapping:**
```
PATCH /api/v1/memos/<id>
Body: { "memo": { "name": "memos/<id>", ...fields }, "updateMask": "content,visibility" }
```

The `updateMask` is computed dynamically from the keys provided in the update request. For example, if only `--visibility` is passed, the mask is `visibility`. This ensures that other fields (like content or state) are not accidentally overwritten with empty values.

#### DELETE

```bash
# Delete (soft delete -- moves to trash)
memoscript delete 42

# Force delete (permanent, skips trash)
memoscript delete 42 --force

# Delete requires confirmation unless --force
memoscript delete 42
# > Delete memo 42? This moves it to trash. [y/N]
```

**API Mapping:**
```
DELETE /api/v1/memos/<id>?force=<bool>
```

---

## 5. PAI Integration Pattern

### Design Decision: Named Exports from the Same File

The CLI file (`memoscript.ts`) exports its core functions for direct import
by PAI skills. No separate library. No wrapper module. The CLI IS the library.

```typescript
// ─── PAI-Importable Functions ───────────────────────────────────

export async function createMemo(
  content: string,
  options?: { visibility?: Visibility }
): Promise<Memo> { ... }

export async function listMemos(
  options?: {
    limit?: number;
    tag?: string;
    state?: State;
    filter?: string;
    pageToken?: string;
    orderBy?: string;
  }
): Promise<ListMemosResponse> { ... }

export async function getMemo(
  id: number | string
): Promise<Memo> { ... }

export async function updateMemo(
  id: number | string,
  updates: {
    content?: string;
    visibility?: Visibility;
    state?: State;
    pinned?: boolean;
  }
): Promise<Memo> { ... }

export async function deleteMemo(
  id: number | string,
  options?: { force?: boolean }
): Promise<void> { ... }
```

### Why This Pattern?

1. **Zero indirection.** A PAI skill calls `createMemo("thought")` directly.
   No HTTP client, no subprocess, no serialization boundary.

2. **Same validation.** The exported functions run the same config loading,
   error handling, and API calls as the CLI path.

3. **Type safety preserved.** TypeScript types flow from the function signatures
   through PAI skill code. No `any`, no string parsing.

4. **CQS compliance.** `listMemos` and `getMemo` are pure queries (no side effects).
   `createMemo`, `updateMemo`, `deleteMemo` are commands that return the result
   of their mutation for confirmation.

### PAI Skill Usage Example

```typescript
// In a PAI skill workflow
import { createMemo, listMemos } from "~/.claude/Bin/memoscript/memoscript.ts";

// Capture a thought from a workflow
await createMemo("Extracted insight: users prefer flat hierarchy #research #ux");

// Retrieve recent memos for analysis
const recent = await listMemos({ limit: 10, tag: "research" });
```

### Guard Against Double Execution

The CLI's `main()` function only runs when the file is executed directly,
not when imported:

```typescript
// At the bottom of memoscript.ts
if (import.meta.main) {
  main().catch(handleError);
}
```

`import.meta.main` is a Bun-native flag that is `true` only when the file
is the entry point. This prevents the CLI's argument parsing from running
when PAI imports the module for its exported functions.

---

## 6. Error Handling Strategy

### Philosophy: Bugs Crash, I/O Errors Explain

Following the CLAUDE.md mandate:
- **Bugs** (programmer errors): crash loudly with `throw` and stack trace
- **I/O errors** (network, config, API): handle explicitly with actionable messages

### Error Classification

```typescript
class MemoscriptError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly hint?: string,
    readonly exitCode: number = 1
  ) {
    super(message);
    this.name = "MemoscriptError";
  }
}
```

| Error Code              | Category | Example                                    | Exit Code |
|-------------------------|----------|--------------------------------------------|-----------|
| `ERR_NO_CONFIG`         | Config   | Missing ~/.config/memoscript/.env           | 1         |
| `ERR_INVALID_CONFIG`    | Config   | URL or TOKEN empty/malformed               | 1         |
| `ERR_NETWORK`           | I/O      | Connection refused, timeout, DNS failure   | 1         |
| `ERR_API_AUTH`          | I/O      | 401/403 from Memos server                  | 1         |
| `ERR_API_NOT_FOUND`     | I/O      | 404 -- memo ID doesn't exist               | 1         |
| `ERR_API_SERVER`        | I/O      | 500+ from Memos server                     | 1         |
| `ERR_INVALID_INPUT`     | Bug      | Null content passed to createMemo           | 2         |
| `ERR_UNKNOWN_COMMAND`   | Bug      | Unrecognized subcommand                     | 2         |

### Error Output Contract

All errors go to **stderr**. Never stdout. This preserves JSON piping:

```bash
# This works even when errors occur
memoscript list 2>/dev/null | jq '.memos[0]'
```

Error format for humans:

```
Error [ERR_API_AUTH]: Authentication failed (HTTP 401)
Hint: Check your token in ~/.config/memoscript/.env
Hint: Generate a new token in Memos Settings > Access Tokens
```

### API Error Handling Flow

```typescript
async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const config = loadConfig();
  const url = `${config.url}/api/v1${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    // Network-level failure (DNS, connection refused, timeout)
    throw new MemoscriptError(
      `Cannot reach Memos server at ${config.url}`,
      "ERR_NETWORK",
      `Is the server running? Check: curl -s ${config.url}/api/v1/memos`
    );
  }

  if (!response.ok) {
    return handleApiError(response);
  }

  // DELETE returns empty body
  if (response.status === 204 || method === "DELETE") {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
```

### PAI Integration Error Behavior

When called from PAI skills (imported functions), errors throw
`MemoscriptError` which the calling skill can catch and handle.
The `process.exit()` path only runs from the CLI entry point.

```typescript
// CLI path: exits with code
main().catch((error) => {
  if (error instanceof MemoscriptError) {
    console.error(`Error [${error.code}]: ${error.message}`);
    if (error.hint) console.error(`Hint: ${error.hint}`);
    process.exit(error.exitCode);
  }
  // Unknown errors are bugs -- crash with full trace
  console.error("Fatal:", error);
  process.exit(2);
});

// PAI path: errors propagate naturally
// The skill's try/catch handles MemoscriptError
```

---

## 7. Response Format

### Design Decision: JSON by Default, Human-Readable on Request

**Default output: JSON to stdout.** This follows CLI-First Architecture:
deterministic, composable, parseable by `jq`, `grep`, and other tools.

### CREATE Response

```json
{
  "name": "memos/42",
  "content": "Meeting with Sarah: discuss Q3 roadmap #work #meeting",
  "visibility": "PRIVATE",
  "state": "NORMAL",
  "creator": "users/1",
  "createTime": "2026-02-05T19:30:00Z",
  "tags": ["work", "meeting"],
  "pinned": false
}
```

Quiet mode (`--quiet`): No output. Exit code 0 = success.

### LIST Response

```json
{
  "memos": [
    {
      "name": "memos/42",
      "content": "Meeting with Sarah...",
      "visibility": "PRIVATE",
      "createTime": "2026-02-05T19:30:00Z",
      "tags": ["work", "meeting"],
      "snippet": "Meeting with Sarah: discuss Q3 roadmap"
    }
  ],
  "nextPageToken": "eyJvZmZzZXQiOjIwfQ=="
}
```

### GET Response

Full Memo object (same structure as CREATE response, all fields populated).

### UPDATE Response

Updated Memo object reflecting the changes.

### DELETE Response

```json
{ "deleted": true, "name": "memos/42" }
```

### Output Control Flags

| Flag      | Behavior                                              |
|-----------|-------------------------------------------------------|
| `--json`  | Force JSON output (default for list/get)              |
| `--quiet` | Suppress all stdout output (exit code only)           |

**No `--human` or `--table` format in v1.** JSON + jq is more powerful and
composable than any bespoke formatting. Avoid premature formatting complexity.

---

## 8. Simplicity Validation

### Cognitive Load Comparison

**Creating a note in Obsidian:**
1. Open Obsidian (or switch to it)
2. Decide which vault
3. Decide which folder
4. Create new note (Cmd+N)
5. Type a title
6. Optionally add frontmatter
7. Type content
8. Optionally add tags
9. Optionally add links

**Creating a memo with memoscript:**
1. Type `memoscript "thought #tag"`

Steps reduced from 9 to 1. Cognitive decisions reduced from 4+ to 0.

### Complexity Budget

The entire tool must fit in a single file under 500 lines. If it exceeds this,
scope is creeping. Constraints:

- **One file.** `memoscript.ts` contains everything.
- **Zero dependencies.** Bun's native `fetch`, `fs`, and `process` only.
- **Five commands.** create, list, get, update, delete. No more in v1.
- **Two config values.** URL and TOKEN. Nothing else to configure.
- **One output format.** JSON. No tables, no YAML, no markdown.

### What We Deliberately Exclude (v1)

| Feature                | Why Excluded                                          |
|------------------------|-------------------------------------------------------|
| Attachment uploads     | Separate concern. Content capture must stay instant.  |
| Memo relations         | Power feature. Not needed for thought capture.        |
| Reactions              | Social feature. Irrelevant for personal capture.      |
| Comments               | Treat memos as atomic. Comments add hierarchy.        |
| Location               | Nice-to-have. Adds complexity without capture value.  |
| Multiple accounts      | One instance, one user. Simplicity.                   |
| Output formatting      | jq does this better than we ever will.                |
| Interactive mode        | Breaks composability. Use the API directly.           |
| Watch/streaming        | Over-engineering. Poll with `list` if needed.         |

Every exclusion is a feature. Each one preserves the sub-2-second capture loop.

---

## 9. API Contract Summary

### Base Configuration

```
Base URL:    {MEMOS_URL}/api/v1
Auth:        Authorization: Bearer {MEMOS_TOKEN}
Content:     application/json
```

### Endpoints

| Operation | Method | Path                   | Body                                             |
|-----------|--------|------------------------|--------------------------------------------------|
| CREATE    | POST   | /memos                 | `{ "content": "...", "visibility": "..." }`      |
| LIST      | GET    | /memos                 | Query: pageSize, state, filter, pageToken, orderBy |
| GET       | GET    | /memos/{id}            | --                                               |
| UPDATE    | PATCH  | /memos/{id}            | `{ "memo": {...}, "updateMask": "..." }`         |
| DELETE    | DELETE | /memos/{id}            | Query: force                                     |

### Resource Naming Convention

Memos uses gRPC resource names: `memos/42` not just `42`.
The CLI accepts both forms and normalizes internally:

```typescript
function normalizeId(input: string | number): string {
  const id = String(input);
  return id.startsWith("memos/") ? id : `memos/${id}`;
}
```

### Visibility Enum

| Value       | Meaning                              |
|-------------|--------------------------------------|
| `PRIVATE`   | Only visible to creator              |
| `PROTECTED` | Visible to logged-in users           |
| `PUBLIC`    | Visible to everyone                  |

### State Enum

| Value      | Meaning                               |
|------------|---------------------------------------|
| `NORMAL`   | Active memo                           |
| `ARCHIVED` | Archived (hidden from default list)   |

---

## 10. Implementation Plan

### Phase 1: Core (the 90% case)

1. Project scaffold (package.json, tsconfig.json, .env.example)
2. Config loading with env var fallback
3. API client (apiRequest with error handling)
4. `createMemo()` function + CLI default command
5. `init` command for first-time setup
6. Smoke test: create a memo from CLI

**Acceptance:** `memoscript "hello world"` creates a memo and prints JSON.

### Phase 2: Read Operations

7. `getMemo()` function + CLI `get` command
8. `listMemos()` function + CLI `list` command with all filter flags
9. Tag filter sugar (--tag -> filter expression)

**Acceptance:** `memoscript list --tag work --limit 5` returns filtered JSON.

### Phase 3: Mutation Operations

10. `updateMemo()` function + CLI `update` command with updateMask computation
11. `deleteMemo()` function + CLI `delete` command with confirmation prompt

**Acceptance:** Full CRUD cycle works end-to-end.

### Phase 4: Polish

12. `--help` text following llcli pattern
13. `--quiet` and `--json` output control
14. Stdin support (`memoscript -` reads from pipe)
15. PAI export verification (import.meta.main guard, type exports)

**Acceptance:** All 8 ISC criteria pass.

### Parallelization Opportunities

- [P] Phase 1 steps 1-3 can be built simultaneously (scaffold, config, API client)
- [P] Phase 2 steps 7-8 are independent (get vs list)
- [P] Phase 4 steps 12-15 are all independent polish tasks

---

## 11. Type Definitions

```typescript
// ─── Enums ──────────────────────────────────────────────────────

type Visibility = "PRIVATE" | "PROTECTED" | "PUBLIC";
type State = "NORMAL" | "ARCHIVED";

// ─── Core Types ─────────────────────────────────────────────────

interface Memo {
  readonly name: string;              // "memos/42"
  readonly state: State;
  readonly creator: string;           // "users/1"
  readonly createTime: string;        // ISO 8601
  readonly updateTime: string;
  readonly displayTime: string;
  readonly content: string;
  readonly visibility: Visibility;
  readonly tags: readonly string[];
  readonly pinned: boolean;
  readonly snippet: string;
  readonly property: MemoProperty;
  readonly parent?: string;
  readonly attachments: readonly Attachment[];
  readonly relations: readonly MemoRelation[];
  readonly reactions: readonly Reaction[];
}

interface MemoProperty {
  readonly hasLink: boolean;
  readonly hasTaskList: boolean;
  readonly hasCode: boolean;
  readonly hasIncompleteTasks: boolean;
}

interface Attachment {
  readonly name: string;
  readonly filename: string;
  readonly type: string;
  readonly size: number;
  readonly createTime: string;
}

interface MemoRelation {
  readonly memo: string;
  readonly relatedMemo: string;
  readonly type: "REFERENCE" | "COMMENT";
}

interface Reaction {
  readonly name: string;
  readonly creator: string;
  readonly contentId: string;
  readonly reactionType: string;
  readonly createTime: string;
}

// ─── Request/Response Types ─────────────────────────────────────

interface ListMemosResponse {
  readonly memos: readonly Memo[];
  readonly nextPageToken: string;
}

// ─── Config ─────────────────────────────────────────────────────

interface Config {
  readonly url: string;    // Base URL (no trailing slash)
  readonly token: string;  // Bearer token
}
```

---

## 12. File Layout

```
~/.claude/Bin/memoscript/
  memoscript.ts       # Single-file implementation
  package.json        # { "name": "memoscript", "type": "module", "bin": { "memoscript": "memoscript.ts" } }
  tsconfig.json       # Strict mode, ESM, Bun target
  .env.example        # MEMOS_URL=\nMEMOS_TOKEN=
  README.md           # Philosophy + usage + examples
  QUICKSTART.md       # 5 most common operations
  SPEC.md             # This document (moved here after creation)
```

**Binary setup:**
```bash
chmod +x ~/.claude/Bin/memoscript/memoscript.ts
# Shebang: #!/usr/bin/env bun
```

Invocation assumes `~/.claude/Bin/memoscript/` is in PATH or aliased:
```bash
alias memoscript='bun ~/.claude/Bin/memoscript/memoscript.ts'
```

---

## 13. Security Considerations

1. **Token storage:** File permissions on `~/.config/memoscript/.env` must be
   `0600` (owner read/write only). The `init` command sets this automatically.

2. **No token in CLI args:** The token is never passed as a command-line argument
   (visible in `ps` output). Always from config file or env var.

3. **HTTPS validation:** Bun's native fetch validates TLS certificates by default.
   No option to disable. Self-signed certs require system-level trust.

4. **No credential logging:** Error messages never include the token value.
   API errors show the URL and status code, not the Authorization header.

---

## 14. Testing Strategy

```bash
# Smoke test: config loading
memoscript list 2>&1 | head -1
# Expected: JSON array or config error

# Smoke test: create
memoscript "test memo from memoscript #test"
# Expected: JSON with name, content, createTime

# Smoke test: roundtrip
ID=$(memoscript "roundtrip test #test" | jq -r '.name' | cut -d/ -f2)
memoscript get $ID | jq '.content'
# Expected: "roundtrip test #test"

# Smoke test: update
memoscript update $ID "updated content"
memoscript get $ID | jq '.content'
# Expected: "updated content"

# Smoke test: delete
memoscript delete $ID --force
memoscript get $ID 2>&1
# Expected: ERR_API_NOT_FOUND

# Smoke test: list with filter
memoscript list --tag test --limit 5
# Expected: JSON with filtered results
```

Formal Vitest tests are a Phase 5 concern. The smoke tests above validate
the contract. Premature test infrastructure adds complexity without value
at this scale (~400 lines of implementation code).
