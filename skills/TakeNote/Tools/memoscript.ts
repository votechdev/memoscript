#!/usr/bin/env bun

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";

export type Visibility = "PRIVATE" | "PROTECTED" | "PUBLIC";
export type State = "NORMAL" | "ARCHIVED";

export interface Memo {
  readonly name: string;
  readonly state: State;
  readonly creator: string;
  readonly createTime: string;
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

export interface MemoProperty {
  readonly hasLink: boolean;
  readonly hasTaskList: boolean;
  readonly hasCode: boolean;
  readonly hasIncompleteTasks: boolean;
}

export interface Attachment {
  readonly name: string;
  readonly filename: string;
  readonly type: string;
  readonly size: number;
  readonly createTime: string;
}

export interface MemoRelation {
  readonly memo: string;
  readonly relatedMemo: string;
  readonly type: "REFERENCE" | "COMMENT";
}

export interface Reaction {
  readonly name: string;
  readonly creator: string;
  readonly contentId: string;
  readonly reactionType: string;
  readonly createTime: string;
}

export interface ListMemosResponse {
  readonly memos: readonly Memo[];
  readonly nextPageToken: string;
}

export interface Config {
  readonly url: string;
  readonly token: string;
}

export class MemoscriptError extends Error {
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

function parseEnvFile(content: string): Record<string, string | undefined> {
  const config: Record<string, string | undefined> = {};
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip blank lines and comments
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Split on first '=' only
    const equalIndex = trimmed.indexOf("=");
    if (equalIndex === -1) continue;

    const key = trimmed.substring(0, equalIndex).trim();
    let value = trimmed.substring(equalIndex + 1).trim();

    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.substring(1, value.length - 1);
    }

    config[key] = value;
  }

  return config;
}

export function loadConfig(): Config {
  // Priority 1: Direct env vars
  let url = process.env.MEMOS_URL;
  let token = process.env.MEMOS_TOKEN;

  // Priority 2: CLAUDE_ prefixed env vars (PAI runtime context)
  if (!url) url = process.env.CLAUDE_MEMOS_URL;
  if (!token) token = process.env.CLAUDE_MEMOS_TOKEN;

  // Priority 3: Config file
  const configDir = process.env.MEMOSCRIPT_CONFIG_DIR || `${process.env.HOME || homedir()}/.config/memoscript`;
  const configPath = `${configDir}/.env`;

  if (!url || !token) {
    if (!existsSync(configPath)) {
      throw new MemoscriptError(
        "Configuration not found",
        "ERR_NO_CONFIG",
        "Run memoscript init to configure"
      );
    }

    // Parse config file
    const content = readFileSync(configPath, "utf-8");
    const fileConfig = parseEnvFile(content);

    // Apply file values only if not already set by env vars
    if (!url) url = fileConfig.MEMOS_URL;
    if (!token) token = fileConfig.MEMOS_TOKEN;
  }

  // Validate required values
  if (!url || !token || url.trim() === "" || token.trim() === "") {
    throw new MemoscriptError(
      "Invalid configuration: missing url or token",
      "ERR_INVALID_CONFIG",
      "Run memoscript init to configure"
    );
  }

  // Strip trailing slash from URL
  const cleanUrl = url.trim().replace(/\/$/, "");

  return {
    url: cleanUrl,
    token: token.trim(),
  };
}

export function normalizeId(input: string | number): string {
  const id = String(input);
  return id.startsWith("memos/") ? id : `memos/${id}`;
}

async function handleApiError(response: Response): Promise<never> {
  const status = response.status;
  let detail = '';
  try {
    const body = await response.json() as { message?: string; error?: string };
    detail = body.message || body.error || JSON.stringify(body);
  } catch {
    detail = response.statusText;
  }

  if (status === 401 || status === 403) {
    throw new MemoscriptError(
      `Authentication failed (HTTP ${status}): ${detail}`,
      "ERR_API_AUTH",
      "Check your token in ~/.config/memoscript/.env\nGenerate a new token in Memos Settings > Access Tokens"
    );
  }
  if (status === 404) {
    throw new MemoscriptError(
      `Not found (HTTP 404): ${detail}`,
      "ERR_API_NOT_FOUND",
      "Verify the memo ID exists"
    );
  }
  if (status >= 500) {
    throw new MemoscriptError(
      `Server error (HTTP ${status}): ${detail}`,
      "ERR_API_SERVER",
      "Check Memos server logs"
    );
  }
  throw new MemoscriptError(
    `API error (HTTP ${status}): ${detail}`,
    "ERR_API_ERROR"
  );
}

export async function apiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
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
    throw new MemoscriptError(
      `Cannot reach Memos server at ${config.url}`,
      "ERR_NETWORK",
      `Is the server running? Check: curl -s ${config.url}/api/v1/memos`
    );
  }

  if (!response.ok) {
    await handleApiError(response);
  }

  // DELETE returns empty body
  if (response.status === 204 || method === "DELETE") {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// Helper to extract numeric ID from resource name
function extractId(nameOrId: string | number): string {
  const name = normalizeId(nameOrId);
  return name.replace('memos/', '');
}

// ========================================
// CRUD Operations
// ========================================

export async function createMemo(content: string, options?: { visibility?: Visibility }): Promise<Memo> {
  const body: { content: string; visibility?: Visibility } = { content };
  if (options?.visibility) {
    body.visibility = options.visibility;
  }
  return apiRequest<Memo>("POST", "/memos", body);
}

export async function listMemos(options?: {
  limit?: number;
  tag?: string;
  state?: State;
  filter?: string;
  pageToken?: string;
  orderBy?: string;
}): Promise<ListMemosResponse> {
  const params = new URLSearchParams();

  if (options?.limit) {
    params.set("pageSize", String(options.limit));
  }

  if (options?.state) {
    params.set("state", options.state);
  }

  // Build filter expression
  let filterExpr = options?.filter || "";
  if (options?.tag) {
    const tagFilter = `tag == '${options.tag}'`;
    filterExpr = filterExpr ? `(${filterExpr}) && ${tagFilter}` : tagFilter;
  }
  if (filterExpr) {
    params.set("filter", filterExpr);
  }

  if (options?.pageToken) {
    params.set("pageToken", options.pageToken);
  }

  if (options?.orderBy) {
    params.set("orderBy", options.orderBy);
  }

  const query = params.toString();
  const path = query ? `/memos?${query}` : "/memos";
  return apiRequest<ListMemosResponse>("GET", path);
}

export async function getMemo(id: number | string): Promise<Memo> {
  const numericId = extractId(id);
  return apiRequest<Memo>("GET", `/memos/${numericId}`);
}

export async function updateMemo(
  id: number | string,
  updates: { content?: string; visibility?: Visibility; state?: State; pinned?: boolean }
): Promise<Memo> {
  const numericId = extractId(id);
  const name = normalizeId(id);

  // Build memo object with provided fields
  const memo: Record<string, unknown> = { name };
  const updateFields: string[] = [];

  if (updates.content !== undefined) {
    memo.content = updates.content;
    updateFields.push("content");
  }
  if (updates.visibility !== undefined) {
    memo.visibility = updates.visibility;
    updateFields.push("visibility");
  }
  if (updates.state !== undefined) {
    memo.state = updates.state;
    updateFields.push("state");
  }
  if (updates.pinned !== undefined) {
    memo.pinned = updates.pinned;
    updateFields.push("pinned");
  }

  if (updateFields.length === 0) {
    throw new MemoscriptError(
      "No update fields provided",
      "ERR_NO_UPDATES",
      "Provide at least one field to update: content, visibility, state, pinned"
    );
  }

  const updateMask = updateFields.join(",");
  return apiRequest<Memo>("PATCH", `/memos/${numericId}?updateMask=${updateMask}`, memo);
}

export async function deleteMemo(id: number | string, options?: { force?: boolean }): Promise<void> {
  const numericId = extractId(id);
  const query = options?.force ? "?force=true" : "";
  await apiRequest<void>("DELETE", `/memos/${numericId}${query}`);
}

// ========================================
// Init Command
// ========================================

async function initCommand(): Promise<void> {
  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  };

  try {
    console.log("Memoscript Configuration\n");

    const url = await question("Memos server URL (e.g., https://memos.example.com): ");
    const token = await question("Access token: ");

    if (!url || !token) {
      throw new MemoscriptError(
        "URL and token are required",
        "ERR_INIT_MISSING",
        "Both URL and token must be provided"
      );
    }

    // Validate with test API call
    console.log("\nValidating credentials...");
    const cleanUrl = url.trim().replace(/\/$/, "");
    const testResponse = await fetch(`${cleanUrl}/api/v1/memos?pageSize=1`, {
      headers: {
        "Authorization": `Bearer ${token.trim()}`,
        "Content-Type": "application/json",
      },
    });

    if (!testResponse.ok) {
      let detail = "";
      try {
        const body = await testResponse.json() as { message?: string; error?: string };
        detail = body.message || body.error || JSON.stringify(body);
      } catch {
        detail = testResponse.statusText;
      }
      throw new MemoscriptError(
        `Authentication failed: ${detail}`,
        "ERR_INIT_AUTH",
        "Check your URL and token are correct"
      );
    }

    // Create config directory
    const { mkdirSync, writeFileSync, chmodSync } = await import("fs");
    const configDir = process.env.MEMOSCRIPT_CONFIG_DIR || `${process.env.HOME || homedir()}/.config/memoscript`;
    mkdirSync(configDir, { recursive: true });

    // Write config file
    const configPath = `${configDir}/.env`;
    const configContent = `MEMOS_URL=${cleanUrl}\nMEMOS_TOKEN=${token.trim()}\n`;
    writeFileSync(configPath, configContent, { mode: 0o600 });
    chmodSync(configPath, 0o600);

    console.log(`\n✓ Configuration saved to ${configPath}`);
    console.log("\nSuggested alias:");
    console.log('  alias m="memoscript"');
  } finally {
    rl.close();
  }
}

function showHelp(): void {
  const help = `memoscript — Frictionless memo capture for Memos

Usage:
  memoscript <content>              Create a memo (default)
  memoscript <command> [options]    Run a command

Commands:
  create [text]     Create a memo
  list              List memos
  get <id>          Get a memo by ID
  update <id>       Update a memo
  delete <id>       Delete a memo
  init              Configure memoscript

Flags:
  --visibility, -v  PRIVATE|PROTECTED|PUBLIC
  --state, -s       NORMAL|ARCHIVED
  --tag, -t         Filter by tag
  --filter, -f      Custom filter expression
  --limit, -l       Page size limit
  --pin/--unpin     Pin or unpin a memo
  --force           Skip confirmation prompts
  --quiet, -q       Suppress output
  --json            JSON output (default)

Examples:
  memoscript "quick thought #idea"
  memoscript list --tag idea --limit 5
  memoscript get 42
  memoscript update 42 "new content"
  memoscript delete 42 --force
  echo "piped input" | memoscript -

Config: ~/.config/memoscript/.env`;

  console.log(help);
}

// ========================================
// CLI
// ========================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Parse flags and content
  const parseFlags = (startIndex: number) => {
    const flags: Record<string, string | boolean> = {};
    const contentParts: string[] = [];
    let i = startIndex;

    while (i < args.length) {
      const arg = args[i];

      if (arg === "--visibility" || arg === "-v") {
        flags.visibility = args[++i];
      } else if (arg === "--state" || arg === "-s") {
        flags.state = args[++i];
      } else if (arg === "--tag" || arg === "-t") {
        flags.tag = args[++i];
      } else if (arg === "--filter" || arg === "-f") {
        flags.filter = args[++i];
      } else if (arg === "--limit" || arg === "-l") {
        flags.limit = args[++i];
      } else if (arg === "--page") {
        flags.page = args[++i];
      } else if (arg === "--order") {
        flags.order = args[++i];
      } else if (arg === "--pin") {
        flags.pin = true;
      } else if (arg === "--unpin") {
        flags.unpin = true;
      } else if (arg === "--force") {
        flags.force = true;
      } else if (arg === "--quiet" || arg === "-q") {
        flags.quiet = true;
      } else if (arg === "--json") {
        flags.json = true;
      } else {
        contentParts.push(arg);
      }
      i++;
    }

    return { flags, content: contentParts.join(" ") };
  };

  const formatOutput = (data: unknown, flags: Record<string, string | boolean>) => {
    if (flags.quiet) return;
    console.log(JSON.stringify(data, null, 2));
  };

  // Handle stdin input: explicit "-" or piped input with no args
  if (args[0] === "-" || (args.length === 0 && process.stdin.isTTY === false)) {
    const startIndex = args[0] === "-" ? 1 : 0;
    const { flags } = parseFlags(startIndex);
    const stdinContent = (await Bun.stdin.text()).trim();

    if (!stdinContent) {
      throw new MemoscriptError(
        "No content provided from stdin",
        "ERR_NO_CONTENT",
        "Usage: echo 'content' | memoscript - OR cat file.md | memoscript"
      );
    }

    const options: { visibility?: Visibility } = {};
    if (flags.visibility) options.visibility = (flags.visibility as string).toUpperCase() as Visibility;

    const memo = await createMemo(stdinContent, options);
    formatOutput(memo, flags);
    return;
  }

  if (args.length === 0) {
    throw new MemoscriptError(
      "No arguments provided",
      "ERR_NO_ARGS",
      "Usage: memoscript [command] [args]\n\nCommands:\n  init         Configure memoscript\n  create       Create a memo\n  list         List memos\n  get <id>     Get a memo\n  update <id>  Update a memo\n  delete <id>  Delete a memo\n\nDefault: Any text without a command creates a memo"
    );
  }

  const RESERVED_COMMANDS = ["init", "list", "get", "update", "delete", "create"];
  const firstArg = args[0];

  // Help
  if (firstArg === "--help" || firstArg === "-h") {
    showHelp();
    return;
  }

  // Init command
  if (firstArg === "init") {
    await initCommand();
    return;
  }

  // List command
  if (firstArg === "list") {
    const { flags } = parseFlags(1);
    const options: Parameters<typeof listMemos>[0] = {
      limit: flags.limit ? parseInt(flags.limit as string, 10) : 20,
      state: flags.state ? (flags.state as string).toUpperCase() as State : "NORMAL",
    };

    if (flags.tag) options.tag = flags.tag as string;
    if (flags.filter) options.filter = flags.filter as string;
    if (flags.page) options.pageToken = flags.page as string;
    if (flags.order) options.orderBy = flags.order as string;

    const result = await listMemos(options);
    formatOutput(result, flags);
    return;
  }

  // Get command
  if (firstArg === "get") {
    if (args.length < 2) {
      throw new MemoscriptError(
        "Missing memo ID",
        "ERR_MISSING_ID",
        "Usage: memoscript get <id>"
      );
    }
    const { flags } = parseFlags(2);
    const memo = await getMemo(args[1]);
    formatOutput(memo, flags);
    return;
  }

  // Update command
  if (firstArg === "update") {
    if (args.length < 2) {
      throw new MemoscriptError(
        "Missing memo ID",
        "ERR_MISSING_ID",
        "Usage: memoscript update <id> [content] [--visibility/-v] [--state/-s] [--pin] [--unpin]"
      );
    }

    const id = args[1];
    const { flags, content } = parseFlags(2);

    const updates: Parameters<typeof updateMemo>[1] = {};
    if (content) updates.content = content;
    if (flags.visibility) updates.visibility = (flags.visibility as string).toUpperCase() as Visibility;
    if (flags.state) updates.state = (flags.state as string).toUpperCase() as State;
    if (flags.pin) updates.pinned = true;
    if (flags.unpin) updates.pinned = false;

    const result = await updateMemo(id, updates);
    formatOutput(result, flags);
    return;
  }

  // Delete command
  if (firstArg === "delete") {
    if (args.length < 2) {
      throw new MemoscriptError(
        "Missing memo ID",
        "ERR_MISSING_ID",
        "Usage: memoscript delete <id> [--force]"
      );
    }

    const id = args[1];
    const { flags } = parseFlags(2);

    if (!flags.force) {
      // Prompt for confirmation
      const readline = await import("readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const confirm = await new Promise<string>((resolve) => {
        rl.question(`Delete memo ${normalizeId(id)}? [y/N] `, (answer) => {
          rl.close();
          resolve(answer);
        });
      });

      if (confirm.toLowerCase() !== "y" && confirm.toLowerCase() !== "yes") {
        console.log("Cancelled");
        return;
      }
    }

    await deleteMemo(id, { force: !!flags.force });
    formatOutput({ deleted: true, name: normalizeId(id) }, flags);
    return;
  }

  // Create command (explicit or default)
  if (firstArg === "create") {
    const { flags, content } = parseFlags(1);

    if (!content) {
      throw new MemoscriptError(
        "No content provided",
        "ERR_NO_CONTENT",
        "Usage: memoscript create <content>"
      );
    }

    const options: Parameters<typeof createMemo>[1] = {};
    if (flags.visibility) options.visibility = (flags.visibility as string).toUpperCase() as Visibility;

    const memo = await createMemo(content, options);
    formatOutput(memo, flags);
    return;
  }

  // Handle '--' separator for reserved word collisions
  if (firstArg === "--") {
    const { flags, content } = parseFlags(1);

    if (!content) {
      throw new MemoscriptError(
        "No content provided",
        "ERR_NO_CONTENT",
        "Usage: memoscript -- <content>"
      );
    }

    const options: Parameters<typeof createMemo>[1] = {};
    if (flags.visibility) options.visibility = (flags.visibility as string).toUpperCase() as Visibility;

    const memo = await createMemo(content, options);
    formatOutput(memo, flags);
    return;
  }

  // Default: treat as memo content unless first arg is a reserved command
  if (!RESERVED_COMMANDS.includes(firstArg)) {
    const { flags, content } = parseFlags(0);

    if (!content) {
      throw new MemoscriptError(
        "No content provided",
        "ERR_NO_CONTENT",
        "Usage: memoscript <content>"
      );
    }

    const options: Parameters<typeof createMemo>[1] = {};
    if (flags.visibility) options.visibility = (flags.visibility as string).toUpperCase() as Visibility;

    const memo = await createMemo(content, options);
    formatOutput(memo, flags);
    return;
  }
}

if (import.meta.main) {
  main().catch((error) => {
    if (error instanceof MemoscriptError) {
      console.error(`Error [${error.code}]: ${error.message}`);
      if (error.hint) console.error(`Hint: ${error.hint}`);
      process.exit(error.exitCode);
    }
    console.error("Fatal:", error);
    process.exit(2);
  });
}
