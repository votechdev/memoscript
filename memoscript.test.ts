#!/usr/bin/env bun
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Use a temp directory to avoid destroying real user config
const TEST_CONFIG_DIR = join(tmpdir(), "memoscript-test-config");
const TEST_CONFIG_FILE = join(TEST_CONFIG_DIR, ".env");

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clean up env vars
    delete process.env.MEMOS_URL;
    delete process.env.MEMOS_TOKEN;
    delete process.env.CLAUDE_MEMOS_URL;
    delete process.env.CLAUDE_MEMOS_TOKEN;

    // Point config to temp directory
    process.env.MEMOSCRIPT_CONFIG_DIR = TEST_CONFIG_DIR;

    // Clean up temp config directory
    if (existsSync(TEST_CONFIG_DIR)) {
      rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };

    // Clean up temp config directory
    if (existsSync(TEST_CONFIG_DIR)) {
      rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
    }
  });

  test("throws ERR_NO_CONFIG when config file missing and no env vars", async () => {
    const { loadConfig } = await import("./memoscript.ts");

    expect(() => loadConfig()).toThrow();

    try {
      loadConfig();
    } catch (error: any) {
      expect(error.code).toBe("ERR_NO_CONFIG");
      expect(error.hint).toBe("Run memoscript init to configure");
    }
  });

  test("loads config from file when file exists", async () => {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    writeFileSync(
      TEST_CONFIG_FILE,
      "MEMOS_URL=https://memos.example.com\nMEMOS_TOKEN=test-token-123"
    );

    const { loadConfig } = await import("./memoscript.ts");
    const config = loadConfig();

    expect(config.url).toBe("https://memos.example.com");
    expect(config.token).toBe("test-token-123");
  });

  test("strips trailing slash from URL", async () => {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    writeFileSync(
      TEST_CONFIG_FILE,
      "MEMOS_URL=https://memos.example.com/\nMEMOS_TOKEN=test-token"
    );

    const { loadConfig } = await import("./memoscript.ts");
    const config = loadConfig();

    expect(config.url).toBe("https://memos.example.com");
  });

  test("MEMOS_URL env var overrides file value", async () => {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    writeFileSync(
      TEST_CONFIG_FILE,
      "MEMOS_URL=https://file.example.com\nMEMOS_TOKEN=file-token"
    );

    process.env.MEMOS_URL = "https://env.example.com";

    const { loadConfig } = await import("./memoscript.ts");
    const config = loadConfig();

    expect(config.url).toBe("https://env.example.com");
    expect(config.token).toBe("file-token");
  });

  test("MEMOS_TOKEN env var overrides file value", async () => {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    writeFileSync(
      TEST_CONFIG_FILE,
      "MEMOS_URL=https://file.example.com\nMEMOS_TOKEN=file-token"
    );

    process.env.MEMOS_TOKEN = "env-token";

    const { loadConfig } = await import("./memoscript.ts");
    const config = loadConfig();

    expect(config.url).toBe("https://file.example.com");
    expect(config.token).toBe("env-token");
  });

  test("CLAUDE_MEMOS_URL overrides file but MEMOS_URL overrides both", async () => {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    writeFileSync(
      TEST_CONFIG_FILE,
      "MEMOS_URL=https://file.example.com\nMEMOS_TOKEN=file-token"
    );

    process.env.CLAUDE_MEMOS_URL = "https://claude.example.com";
    process.env.MEMOS_URL = "https://direct.example.com";

    const { loadConfig } = await import("./memoscript.ts");
    const config = loadConfig();

    expect(config.url).toBe("https://direct.example.com");
  });

  test("CLAUDE_MEMOS_TOKEN overrides file but MEMOS_TOKEN overrides both", async () => {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    writeFileSync(
      TEST_CONFIG_FILE,
      "MEMOS_URL=https://file.example.com\nMEMOS_TOKEN=file-token"
    );

    process.env.CLAUDE_MEMOS_TOKEN = "claude-token";
    process.env.MEMOS_TOKEN = "direct-token";

    const { loadConfig } = await import("./memoscript.ts");
    const config = loadConfig();

    expect(config.token).toBe("direct-token");
  });

  test("skips comment lines in config file", async () => {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    writeFileSync(
      TEST_CONFIG_FILE,
      "# This is a comment\nMEMOS_URL=https://memos.example.com\n# Another comment\nMEMOS_TOKEN=test-token"
    );

    const { loadConfig } = await import("./memoscript.ts");
    const config = loadConfig();

    expect(config.url).toBe("https://memos.example.com");
    expect(config.token).toBe("test-token");
  });

  test("skips blank lines in config file", async () => {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    writeFileSync(
      TEST_CONFIG_FILE,
      "\nMEMOS_URL=https://memos.example.com\n\n\nMEMOS_TOKEN=test-token\n"
    );

    const { loadConfig } = await import("./memoscript.ts");
    const config = loadConfig();

    expect(config.url).toBe("https://memos.example.com");
    expect(config.token).toBe("test-token");
  });

  test("handles values containing equals signs", async () => {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    writeFileSync(
      TEST_CONFIG_FILE,
      "MEMOS_URL=https://memos.example.com\nMEMOS_TOKEN=abc123=def456=ghi789"
    );

    const { loadConfig } = await import("./memoscript.ts");
    const config = loadConfig();

    expect(config.token).toBe("abc123=def456=ghi789");
  });

  test("strips surrounding quotes from values", async () => {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    writeFileSync(
      TEST_CONFIG_FILE,
      'MEMOS_URL="https://memos.example.com"\nMEMOS_TOKEN=\'test-token\''
    );

    const { loadConfig } = await import("./memoscript.ts");
    const config = loadConfig();

    expect(config.url).toBe("https://memos.example.com");
    expect(config.token).toBe("test-token");
  });

  test("trims whitespace from keys and values", async () => {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    writeFileSync(
      TEST_CONFIG_FILE,
      "  MEMOS_URL  =  https://memos.example.com  \n  MEMOS_TOKEN  =  test-token  "
    );

    const { loadConfig } = await import("./memoscript.ts");
    const config = loadConfig();

    expect(config.url).toBe("https://memos.example.com");
    expect(config.token).toBe("test-token");
  });

  test("throws ERR_INVALID_CONFIG when URL is empty", async () => {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    writeFileSync(TEST_CONFIG_FILE, "MEMOS_URL=\nMEMOS_TOKEN=test-token");

    const { loadConfig } = await import("./memoscript.ts");

    expect(() => loadConfig()).toThrow();

    try {
      loadConfig();
    } catch (error: any) {
      expect(error.code).toBe("ERR_INVALID_CONFIG");
      expect(error.hint).toBe("Run memoscript init to configure");
    }
  });

  test("throws ERR_INVALID_CONFIG when token is empty", async () => {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    writeFileSync(
      TEST_CONFIG_FILE,
      "MEMOS_URL=https://memos.example.com\nMEMOS_TOKEN="
    );

    const { loadConfig } = await import("./memoscript.ts");

    expect(() => loadConfig()).toThrow();

    try {
      loadConfig();
    } catch (error: any) {
      expect(error.code).toBe("ERR_INVALID_CONFIG");
      expect(error.hint).toBe("Run memoscript init to configure");
    }
  });

  test("loads from env vars only when file does not exist", async () => {
    process.env.MEMOS_URL = "https://env.example.com";
    process.env.MEMOS_TOKEN = "env-token";

    const { loadConfig } = await import("./memoscript.ts");
    const config = loadConfig();

    expect(config.url).toBe("https://env.example.com");
    expect(config.token).toBe("env-token");
  });

  test("loads from CLAUDE env vars only when file does not exist", async () => {
    process.env.CLAUDE_MEMOS_URL = "https://claude.example.com";
    process.env.CLAUDE_MEMOS_TOKEN = "claude-token";

    const { loadConfig } = await import("./memoscript.ts");
    const config = loadConfig();

    expect(config.url).toBe("https://claude.example.com");
    expect(config.token).toBe("claude-token");
  });
});
