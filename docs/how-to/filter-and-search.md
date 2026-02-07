# How to filter and search memos

Every filtering, ordering, and pagination option for `memoscript list`.

## Filter by tag

```bash
memoscript list --tag work
memoscript list -t idea
```

## Filter by state

```bash
memoscript list --state ARCHIVED
```

Default state is `NORMAL`.

## Custom filter expressions

Use `--filter` / `-f` for CEL-syntax expressions:

```bash
memoscript list --filter "content.contains('keyword')"
memoscript list --filter "create_time > '2026-01-01T00:00:00Z'"
memoscript list --filter "create_time > '2026-01-01T00:00:00Z' && create_time < '2026-02-01T00:00:00Z'"
```

## Limit results

```bash
memoscript list --limit 10
memoscript list -l 5
```

Default page size is 20.

## Pagination

When results exceed the page size, the output includes `nextPageToken`. Pass
that token to fetch the next page:

```bash
memoscript list --limit 10 --page <token>
```

Continue until `nextPageToken` is empty.

## Custom ordering

```bash
memoscript list --order "create_time DESC"
memoscript list --order "update_time ASC"
```

## Combining filters

All flags compose. `--tag` with `--filter` wraps the custom filter in
parentheses and appends the tag condition with `&&`:

```bash
memoscript list --tag work --filter "content.contains('deploy')" -l 5 --order "create_time DESC"
```

Produces: `(content.contains('deploy')) && tag == 'work'`.

## Flags reference

| Flag        | Short | Default | Description                    |
|-------------|-------|---------|--------------------------------|
| `--tag`     | `-t`  |         | Filter by tag name             |
| `--state`   | `-s`  | NORMAL  | NORMAL or ARCHIVED             |
| `--filter`  | `-f`  |         | CEL filter expression          |
| `--limit`   | `-l`  | 20      | Maximum results per page       |
| `--page`    |       |         | Pagination token               |
| `--order`   |       |         | Sort expression                |
| `--quiet`   | `-q`  |         | Suppress output                |
