# Getting Started with Memoscript

This tutorial walks you through installing memoscript, connecting it to your Memos instance, and capturing your first memo from the command line. By the end, you will have a working setup and know how to create, list, and retrieve memos.

## Prerequisites

Before you begin, make sure you have:

1. **Bun runtime** (v1.0 or later) -- install from [bun.sh](https://bun.sh) if you do not have it:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```
2. **A running Memos instance** -- self-hosted via Docker or another method. You need its base URL (e.g., `https://memos.example.com`).
3. **An access token** -- generate one in your Memos web UI under **Settings > Access Tokens**.

## Step 1: Install memoscript

Clone the repository and make the script executable:

```bash
git clone https://github.com/your-org/memoscript.git
cd memoscript
chmod +x memoscript.ts
```

Optionally, create a symlink so you can run `memoscript` from anywhere:

```bash
ln -s "$(pwd)/memoscript.ts" ~/.local/bin/memoscript
```

Verify the installation by printing the help text:

```bash
./memoscript.ts --help
```

You should see output that begins with:

```
memoscript -- Frictionless memo capture for Memos

Usage:
  memoscript <content>              Create a memo (default)
  memoscript <command> [options]    Run a command
```

## Step 2: Configure your connection

Run the interactive setup wizard:

```bash
./memoscript.ts init
```

The wizard prompts you for two values:

```
Memoscript Configuration

Memos server URL (e.g., https://memos.example.com): https://memos.example.com
Access token: your_token_here

Validating credentials...

Configuration saved to /home/you/.config/memoscript/.env
```

The wizard validates your credentials with a test API call before saving. If validation fails, double-check your URL and token.

The config file lives at `~/.config/memoscript/.env` with `0600` permissions (owner-read/write only).

## Step 3: Create your first memo

Capture a thought by passing it as a quoted string:

```bash
./memoscript.ts "my first thought #test"
```

Memoscript prints the created memo as JSON:

```json
{
  "name": "memos/1",
  "state": "NORMAL",
  "content": "my first thought #test",
  "visibility": "PRIVATE",
  "tags": ["test"],
  "pinned": false,
  "createTime": "2026-02-07T12:00:00Z",
  ...
}
```

Note the `"name"` field -- the number after `memos/` is the memo ID. You will use it in the next steps. Tags written inline with `#` are parsed automatically by Memos.

## Step 4: List your memos

View your recent memos:

```bash
./memoscript.ts list --limit 5
```

This returns a JSON object containing an array of memos:

```json
{
  "memos": [
    {
      "name": "memos/1",
      "content": "my first thought #test",
      "tags": ["test"],
      ...
    }
  ],
  "nextPageToken": ""
}
```

You can filter by tag to narrow results:

```bash
./memoscript.ts list --tag test
```

## Step 5: Get a specific memo

Retrieve a single memo by its numeric ID (the number from the `"name"` field):

```bash
./memoscript.ts get 1
```

This returns the full memo object:

```json
{
  "name": "memos/1",
  "state": "NORMAL",
  "content": "my first thought #test",
  "visibility": "PRIVATE",
  "tags": ["test"],
  "pinned": false,
  ...
}
```

You can also use the full resource name:

```bash
./memoscript.ts get memos/1
```

## Summary

You accomplished the following in this tutorial:

- Installed memoscript and verified it runs with `--help`
- Connected to your Memos instance with `memoscript init`
- Created a memo with inline tags using positional content
- Listed recent memos and filtered by tag
- Retrieved a specific memo by ID

All output is JSON by default, which means you can pipe it to tools like `jq` for further processing:

```bash
./memoscript.ts list --limit 3 | jq '.[].content'
```

For the full list of commands, flags, and options, see the [CLI Reference](../reference/cli.md).
