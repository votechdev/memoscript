# How to pipe content into memoscript

This guide covers the different ways to send content to memoscript through
standard input rather than passing it as a command-line argument.

## Explicit stdin with `-`

Pass `-` as the first argument to tell memoscript to read from stdin:

```bash
echo "quick thought #idea" | memoscript -
```

Read a file and create a memo from its contents:

```bash
cat notes.md | memoscript -
```

## Implicit stdin detection

When you invoke memoscript with no arguments and stdin is not a terminal,
memoscript reads stdin automatically:

```bash
echo "this also works" | memoscript
```

If stdin is a TTY and no arguments are given, memoscript exits with
`ERR_NO_ARGS` instead of waiting for input.

## Combining stdin with flags

Place flags after the `-` marker. Memoscript parses them normally:

```bash
cat doc.md | memoscript - --visibility PUBLIC
echo "private note" | memoscript - -v PRIVATE --quiet
```

## Multi-line content with heredocs

Use a heredoc to compose multi-line memos inline:

```bash
cat <<'EOF' | memoscript -
## Meeting notes

- Agreed on Q3 timeline
- Action items assigned to @team
#meeting #q3
EOF
```

Quoting the delimiter (`'EOF'`) prevents shell variable expansion. Omit the
quotes if you want interpolation.

## Empty input

If the piped content is empty or whitespace-only, memoscript exits with
`ERR_NO_CONTENT`:

```bash
echo "" | memoscript -
# Error [ERR_NO_CONTENT]: No content provided from stdin
```
