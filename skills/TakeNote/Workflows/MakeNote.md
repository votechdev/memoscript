# MakeNote Workflow

Create a note in Memos via memoscript.

## Step 1: Determine Note Content

**Two modes — choose based on user input:**

### Mode A: Explicit Content
The user provided specific content after "make a note of" / "note this" / etc.

- Use their words as the basis
- Clean up for clarity if needed (fix grammar, remove filler) but preserve meaning
- Do NOT editorialize or add your own interpretation

### Mode B: Inferred Content
The user said something like "make a note of that" or "remember this" without specifying what.

- Review the recent conversation context
- Identify the key insight, decision, or information worth capturing
- Distill into a concise, standalone note (someone reading it later should understand without the conversation)
- Include enough context that the note is self-contained
- If the conversation covers multiple topics and it's ambiguous what to note, ask the user via AskUserQuestion

## Step 2: Select Tags

**Read:** `~/.claude/skills/MakeNote/TaggingGuide.md` (if not already loaded)

Apply tagging rules:
1. Identify 1-3 broad topic tags from the note content
2. Add project name tag if project-specific
3. Prefer reusing known tags over inventing new ones
4. When in doubt, use fewer tags

## Step 3: Format the Memo Content

Compose the final memo as a single string:

```
[Note content]

[#tag1 #tag2]
```

**Formatting rules:**
- Note content first, as plain text or markdown
- Tags on a new line at the end, space-separated
- No quotes around the content
- Keep it concise — memos are for quick capture, not essays

## Step 4: Create the Memo

```bash
bun ~/Tools/memoscript/memoscript.ts create "[MEMO_CONTENT]" --quiet
```

**Important:** Escape any double quotes in the memo content with `\"`.

If the content contains characters that are problematic for shell quoting, pipe it instead:

```bash
echo "[MEMO_CONTENT]" | bun ~/Tools/memoscript/memoscript.ts -
```

## Step 5: Confirm

Report to the user:
- Briefly state what was noted (1 line summary)
- Show the tags applied
- Show the memo ID returned

**Keep confirmation minimal.** The user wants fast capture, not a report.

Example confirmation:
```
Noted: API rate limits at 100 req/min for free tier (#architecture)
```
