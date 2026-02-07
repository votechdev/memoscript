---
name: MakeNote
description: Quick note capture via memoscript. USE WHEN user says make a note, note this, save a note, remember this, jot this down, capture this thought, OR wants to save something from the conversation as a memo.
---

# MakeNote

Capture notes to Memos via memoscript with smart, selective tagging.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **MakeNote** | "make a note of", "note this", "remember this", "jot down" | `Workflows/MakeNote.md` |

## Quick Reference

- **CLI:** `bun ~/Tools/memoscript/memoscript.ts create "<content>"`
- Markdown: Memos *MUST* be formatted in markdown and optimized for readability 
- **Tags:** Inline `#hashtags` in content — Memos parses them natively
- **Modes:** Explicit (user provides content) or Inferred (derive from conversation)
- **Tagging rules:** `TaggingGuide.md`

## Examples

**Example 1: Explicit note**
```
User: "Make a note that API rate limits should be 100 req/min for free tier"
-> Invokes MakeNote workflow
-> Creates memo: "API rate limits should be 100 req/min for free tier #architecture"
-> Confirms creation with memo ID
```

**Example 2: Inferred note from conversation context**
```
User: [After discussing a security vulnerability in auth flow]
User: "Make a note of that"
-> Invokes MakeNote workflow
-> Infers key insight from conversation context
-> Creates memo: "Auth flow vulnerability: token refresh endpoint doesn't validate origin header — needs CORS fix #security #authentication"
-> Confirms creation with memo ID
```

**Example 3: Note with project context**
```
User: "Note this down — we decided to use WebSockets over SSE for the dashboard"
-> Invokes MakeNote workflow
-> Creates memo: "Decision: WebSockets over SSE for dashboard — bidirectional needed for real-time controls #memoscript"
-> Confirms creation with memo ID
```

