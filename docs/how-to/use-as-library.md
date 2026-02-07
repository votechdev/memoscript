# How to use memoscript as a library

Memoscript exports its CRUD functions and types for direct use from TypeScript.

## Import

```typescript
import {
  createMemo, listMemos, getMemo, updateMemo, deleteMemo, MemoscriptError,
} from "./memoscript.ts";
```

The `import.meta.main` guard prevents the CLI from executing on import.

## Create

```typescript
const memo = await createMemo("Ship the feature #release", { visibility: "PUBLIC" });
```

The `visibility` option is optional.

## List

```typescript
const { memos, nextPageToken } = await listMemos({
  limit: 10, tag: "release", state: "NORMAL",
  filter: "content.contains('ship')", orderBy: "create_time DESC",
});
```

All fields optional. Pass `pageToken` to fetch the next page.

## Get

```typescript
const memo = await getMemo(42);         // numeric ID
const same = await getMemo("memos/42"); // resource name works too
```

## Update

```typescript
await updateMemo(42, { content: "Revised", visibility: "PRIVATE", pinned: true });
```

Provide only the fields you want to change.

## Delete

```typescript
await deleteMemo(42);
await deleteMemo(42, { force: true });
```

## Error handling

All functions throw `MemoscriptError` with structured fields:

```typescript
try {
  await getMemo(9999);
} catch (err) {
  if (err instanceof MemoscriptError) {
    err.code;    // "ERR_API_NOT_FOUND"
    err.message; // "Not found (HTTP 404): ..."
    err.hint;    // "Verify the memo ID exists"
  }
}
```

## Types

```typescript
import type {
  Memo, ListMemosResponse, Config,
  Visibility,  // "PRIVATE" | "PROTECTED" | "PUBLIC"
  State,       // "NORMAL" | "ARCHIVED"
  MemoProperty, Attachment, MemoRelation, Reaction,
} from "./memoscript.ts";
```
