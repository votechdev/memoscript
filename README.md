# memoscript

Single-file CLI for frictionless thought capture with Memos.

## Overview

memoscript is a zero-dependency Bun/TypeScript CLI for [Memos](https://www.usememos.com/), a self-hosted note service. It is built for developers and power users who want to capture fleeting thoughts instantly without organizational overhead. The entire implementation lives in one file with a positional-first design -- `memoscript "thought #tag"` creates a memo in under 2 seconds, no subcommand required.

## Quickstart

```bash
# 1. Install Bun (https://bun.sh) and clone the repo
curl -fsSL https://bun.sh/install | bash
git clone https://github.com/your-org/memoscript.git && cd memoscript

# 2. Run interactive setup (configures server URL and access token)
bun memoscript.ts init

# 3. Capture your first thought
bun memoscript.ts "first thought #hello"
```

## Features

- **Positional-first interface** -- content as the first argument, no subcommand needed
- **Zero external dependencies** -- built entirely on Bun native APIs
- **Single-file implementation** -- one module, nothing to wire together
- **Dual-mode design** -- works as both a CLI tool and an importable TypeScript library
- **JSON output by default** -- composable with jq, grep, and other Unix tools
- **Structured error codes** -- every failure includes an actionable hint

## Documentation

### Tutorials

- [Getting Started Tutorial](docs/tutorials/getting-started.md)

### Reference

- [CLI Reference](docs/reference/cli.md)
- [Library API Reference](docs/reference/api.md)
- [Configuration](docs/reference/configuration.md)
- [Error Codes](docs/reference/errors.md)

### Explanation

- [Architecture](docs/explanation/architecture.md)

### How-to Guides

- [Pipe Content](docs/how-to/pipe-content.md)
- [Use as Library](docs/how-to/use-as-library.md)
- [Filter and Search](docs/how-to/filter-and-search.md)

## Development

```bash
bun test                  # Run test suite
bun verify-exports.ts     # Verify library exports
bun run tsc --noEmit      # Type-check without emitting
```

## License

MIT
