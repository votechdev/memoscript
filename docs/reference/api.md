# Memoscript Library API Reference

Memoscript exports all CRUD operations and supporting utilities as ES module functions. When imported as a library, the CLI does not execute -- an `import.meta.main` guard at the bottom of the module prevents the `main()` function from running on import.

```ts
import { createMemo, listMemos, getMemo, updateMemo, deleteMemo } from "memoscript";
```

---

## Functions

### `createMemo`

Creates a new memo on the configured Memos server.

```ts
function createMemo(content: string, options?: { visibility?: Visibility }): Promise<Memo>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | `string` | Yes | Markdown text body of the memo. Tags are parsed from `#tag` syntax within the content. |
| `options.visibility` | `Visibility` | No | Access level. Defaults to the server's configured default. |

**Returns:** `Promise<Memo>` -- The created memo object.

```ts
const memo = await createMemo("Remember to review PR #42 #work", { visibility: "PRIVATE" });
console.log(memo.name); // "memos/7"
```

---

### `listMemos`

Retrieves a paginated list of memos, with optional filtering and ordering.

```ts
function listMemos(options?: {
  tag?: string;
  state?: State;
  limit?: number;
  pageToken?: string;
  orderBy?: string;
  filter?: string;
}): Promise<ListMemosResponse>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `options.tag` | `string` | No | Filter to memos containing this tag. Appended to any custom `filter` with `&&`. |
| `options.state` | `State` | No | Filter by memo state (`"NORMAL"` or `"ARCHIVED"`). |
| `options.limit` | `number` | No | Maximum number of memos to return (maps to `pageSize` in the API). |
| `options.pageToken` | `string` | No | Pagination cursor returned from a previous `ListMemosResponse.nextPageToken`. |
| `options.orderBy` | `string` | No | Sort expression passed directly to the Memos API (e.g. `"create_time desc"`). |
| `options.filter` | `string` | No | Raw CEL filter expression. Combined with `tag` filter when both are provided. |

**Returns:** `Promise<ListMemosResponse>` -- Contains `memos` array and `nextPageToken` for pagination.

```ts
const { memos, nextPageToken } = await listMemos({ tag: "work", limit: 10, state: "NORMAL" });

// Paginate
if (nextPageToken) {
  const page2 = await listMemos({ pageToken: nextPageToken });
}
```

---

### `getMemo`

Retrieves a single memo by its numeric ID or resource name.

```ts
function getMemo(id: number | string): Promise<Memo>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `number \| string` | Yes | Numeric ID (e.g. `42`) or resource name (e.g. `"memos/42"`). Both forms are accepted. |

**Returns:** `Promise<Memo>` -- The requested memo object.

**Throws:** `MemoscriptError` with code `ERR_API_NOT_FOUND` if the memo does not exist.

```ts
const memo = await getMemo(42);
const same = await getMemo("memos/42"); // equivalent
```

---

### `updateMemo`

Partially updates a memo. Only the fields present in `updates` are sent to the server via an update mask.

```ts
function updateMemo(
  id: number | string,
  updates: { content?: string; visibility?: Visibility; state?: State; pinned?: boolean }
): Promise<Memo>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `number \| string` | Yes | Numeric ID or resource name of the memo to update. |
| `updates.content` | `string` | No | New markdown body. |
| `updates.visibility` | `Visibility` | No | New access level. |
| `updates.state` | `State` | No | Set to `"ARCHIVED"` to archive or `"NORMAL"` to restore. |
| `updates.pinned` | `boolean` | No | Pin or unpin the memo. |

At least one field in `updates` must be provided. Passing an empty object throws `MemoscriptError` with code `ERR_NO_UPDATES`.

**Returns:** `Promise<Memo>` -- The updated memo object.

```ts
const memo = await updateMemo(42, { content: "Updated text", pinned: true });
```

---

### `deleteMemo`

Permanently deletes a memo.

```ts
function deleteMemo(id: number | string, options?: { force?: boolean }): Promise<void>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `number \| string` | Yes | Numeric ID or resource name. |
| `options.force` | `boolean` | No | When `true`, appends `?force=true` to the API request. The CLI uses this to skip the interactive confirmation prompt. |

**Returns:** `Promise<void>`

```ts
await deleteMemo(42, { force: true });
```

---

### `loadConfig`

Reads the Memos server URL and access token from the environment. Configuration is resolved in priority order:

1. `MEMOS_URL` / `MEMOS_TOKEN` environment variables
2. `CLAUDE_MEMOS_URL` / `CLAUDE_MEMOS_TOKEN` environment variables (PAI runtime context)
3. Config file at `$MEMOSCRIPT_CONFIG_DIR/.env` (default: `~/.config/memoscript/.env`)

```ts
function loadConfig(): Config
```

Takes no parameters.

**Returns:** `Config` -- Object with `url` and `token` fields. The URL has any trailing slash stripped.

**Throws:** `MemoscriptError` with code `ERR_NO_CONFIG` if no configuration source is found, or `ERR_INVALID_CONFIG` if values are empty.

```ts
const { url, token } = loadConfig();
```

---

### `normalizeId`

Converts a numeric ID or string into the canonical `memos/{id}` resource name format. If the input already starts with `"memos/"`, it is returned unchanged.

```ts
function normalizeId(input: string | number): string
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input` | `string \| number` | Yes | Numeric ID or resource name. |

**Returns:** `string` -- Resource name in `"memos/{id}"` format.

```ts
normalizeId(42);          // "memos/42"
normalizeId("memos/42");  // "memos/42"
normalizeId("7");         // "memos/7"
```

---

### `apiRequest`

Low-level generic function for making authenticated requests to the Memos v1 API. All CRUD functions delegate to this. Callers can use it directly for endpoints not covered by the higher-level functions.

```ts
function apiRequest<T>(method: string, path: string, body?: unknown): Promise<T>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `method` | `string` | Yes | HTTP method (`"GET"`, `"POST"`, `"PATCH"`, `"DELETE"`). |
| `path` | `string` | Yes | API path appended to `{config.url}/api/v1`. Must include the leading slash. |
| `body` | `unknown` | No | Request body, serialized to JSON. Omit for GET and DELETE requests. |

**Returns:** `Promise<T>` -- Parsed JSON response body. Returns `undefined` for DELETE requests and 204 responses.

**Throws:** `MemoscriptError` with one of the following codes on failure:

| Code | Condition |
|------|-----------|
| `ERR_NETWORK` | Server is unreachable. |
| `ERR_API_AUTH` | HTTP 401 or 403. |
| `ERR_API_NOT_FOUND` | HTTP 404. |
| `ERR_API_SERVER` | HTTP 5xx. |
| `ERR_API_ERROR` | Any other non-OK status. |

```ts
// Fetch a resource not wrapped by a dedicated function
const resource = await apiRequest<{ name: string }>("GET", "/resources/5");
```

---

## Types

### `Visibility`

```ts
type Visibility = "PRIVATE" | "PROTECTED" | "PUBLIC";
```

### `State`

```ts
type State = "NORMAL" | "ARCHIVED";
```

### `Memo`

```ts
interface Memo {
  readonly name: string;            // Resource name, e.g. "memos/42"
  readonly state: State;
  readonly creator: string;         // Resource name of the creator
  readonly createTime: string;      // ISO 8601 timestamp
  readonly updateTime: string;      // ISO 8601 timestamp
  readonly displayTime: string;     // ISO 8601 timestamp
  readonly content: string;         // Markdown body
  readonly visibility: Visibility;
  readonly tags: readonly string[];
  readonly pinned: boolean;
  readonly snippet: string;         // Truncated preview of content
  readonly property: MemoProperty;
  readonly parent?: string;         // Parent resource name, if any
  readonly attachments: readonly Attachment[];
  readonly relations: readonly MemoRelation[];
  readonly reactions: readonly Reaction[];
}
```

### `MemoProperty`

```ts
interface MemoProperty {
  readonly hasLink: boolean;
  readonly hasTaskList: boolean;
  readonly hasCode: boolean;
  readonly hasIncompleteTasks: boolean;
}
```

### `Attachment`

```ts
interface Attachment {
  readonly name: string;
  readonly filename: string;
  readonly type: string;       // MIME type
  readonly size: number;       // Bytes
  readonly createTime: string; // ISO 8601 timestamp
}
```

### `MemoRelation`

```ts
interface MemoRelation {
  readonly memo: string;         // Source memo resource name
  readonly relatedMemo: string;  // Target memo resource name
  readonly type: "REFERENCE" | "COMMENT";
}
```

### `Reaction`

```ts
interface Reaction {
  readonly name: string;
  readonly creator: string;
  readonly contentId: string;
  readonly reactionType: string;
  readonly createTime: string; // ISO 8601 timestamp
}
```

### `ListMemosResponse`

```ts
interface ListMemosResponse {
  readonly memos: readonly Memo[];
  readonly nextPageToken: string; // Empty string when no more pages
}
```

### `Config`

```ts
interface Config {
  readonly url: string;   // Memos server base URL (no trailing slash)
  readonly token: string; // Bearer access token
}
```

---

## Error Class

### `MemoscriptError`

All library errors are thrown as `MemoscriptError` instances. Extends the built-in `Error` class.

```ts
class MemoscriptError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly hint?: string,
    readonly exitCode: number = 1
  );
}
```

| Property | Type | Description |
|----------|------|-------------|
| `message` | `string` | Human-readable error description. |
| `code` | `string` | Machine-readable error code (see table below). |
| `hint` | `string \| undefined` | Suggested resolution for the user. |
| `exitCode` | `number` | Process exit code used by the CLI. Defaults to `1`. |

**Error codes:**

| Code | Meaning |
|------|---------|
| `ERR_NO_CONFIG` | No configuration file or environment variables found. |
| `ERR_INVALID_CONFIG` | Configuration exists but URL or token is empty. |
| `ERR_NETWORK` | Could not connect to the Memos server. |
| `ERR_API_AUTH` | HTTP 401/403 -- invalid or expired token. |
| `ERR_API_NOT_FOUND` | HTTP 404 -- requested resource does not exist. |
| `ERR_API_SERVER` | HTTP 5xx -- server-side error. |
| `ERR_API_ERROR` | Any other non-OK HTTP response. |
| `ERR_NO_UPDATES` | `updateMemo` called with no fields to update. |
| `ERR_NO_CONTENT` | Create operation received empty content. |
| `ERR_NO_ARGS` | CLI invoked with no arguments. |
| `ERR_MISSING_ID` | CLI command requires an ID but none was provided. |

```ts
import { MemoscriptError } from "memoscript";

try {
  await getMemo(999);
} catch (err) {
  if (err instanceof MemoscriptError && err.code === "ERR_API_NOT_FOUND") {
    console.log("Memo not found:", err.hint);
  }
}
```
