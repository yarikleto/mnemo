#!/bin/bash
# Remind to save progress before session ends
# Checks if there are in-progress tasks or uncommitted changes

TASKS_DIR=".claude/tasks"
HAS_ISSUES=false
MESSAGES=""

# Check for in-progress tasks
if [ -d "$TASKS_DIR" ]; then
  IN_PROGRESS=$(grep -rl '`IN_PROGRESS`\|`TESTING`\|`IN_REVIEW`\|`READY`' "$TASKS_DIR" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$IN_PROGRESS" -gt 0 ]; then
    HAS_ISSUES=true
    MESSAGES="${MESSAGES}WARNING: $IN_PROGRESS task(s) still in progress — update their status in .claude/tasks/ before ending.\n"
  fi
fi

# Check for uncommitted changes
if command -v git &>/dev/null && git rev-parse --git-dir &>/dev/null 2>&1; then
  UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  if [ "$UNCOMMITTED" -gt 0 ]; then
    HAS_ISSUES=true
    MESSAGES="${MESSAGES}WARNING: $UNCOMMITTED uncommitted file(s) — commit your work before ending.\n"
  fi
fi

# Check if ceo-brain needs updating
if [ -f ".claude/ceo-brain.md" ]; then
  LAST_UPDATED=$(grep -o 'Last updated: [0-9-]*' .claude/ceo-brain.md 2>/dev/null | head -1)
  if [ -n "$LAST_UPDATED" ]; then
    MESSAGES="${MESSAGES}CEO brain last updated: $LAST_UPDATED — consider running /common-electron-app-sync if stale.\n"
  fi
fi

if [ "$HAS_ISSUES" = true ]; then
  echo -e "$MESSAGES" >&2
  exit 0
fi

exit 0
