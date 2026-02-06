#!/usr/bin/env bun

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";

type Visibility = "PRIVATE" | "PROTECTED" | "PUBLIC";
type State = "NORMAL" | "ARCHIVED";

interface Memo {
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

interface ListMemosResponse {
  readonly memos: readonly Memo[];
  readonly nextPageToken: string;
}

interface Config {
  readonly url: string;
  readonly token: string;
}

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
    const body = await response.json();
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

async function main(): Promise<void> {
  // TODO: implement CLI
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
