#!/bin/bash
# Terminal Canvas - Claude Code Status Hook
# Writes Claude Code status to a temp file for monitoring.

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

if [ -z "$SESSION_ID" ] || [ -z "$EVENT" ]; then
  exit 0
fi

STATUS_DIR="/tmp/terminal-canvas"
mkdir -p "$STATUS_DIR"

COST=0

case "$EVENT" in
  PreToolUse)
    STATUS="tool_running"
    ;;
  PostToolUse)
    STATUS="thinking"
    ;;
  Stop)
    # Check stop_hook_active to avoid infinite loops
    STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
    if [ "$STOP_ACTIVE" = "true" ]; then
      exit 0
    fi
    STATUS="idle"
    # Extract cost from Stop event
    COST=$(echo "$INPUT" | jq -r '.cost.total_cost_usd // 0')
    ;;
  Notification)
    NTYPE=$(echo "$INPUT" | jq -r '.notification_type // empty')
    if [ "$NTYPE" = "permission_prompt" ]; then
      STATUS="permission"
    else
      exit 0
    fi
    ;;
  *)
    exit 0
    ;;
esac

# Write status atomically (write to temp then rename)
TMPFILE="$STATUS_DIR/.tmp.$$"
printf '{"status":"%s","tool_name":"%s","cwd":"%s","timestamp":%d,"cost":%s}\n' \
  "$STATUS" "$TOOL_NAME" "$CWD" "$(date +%s)" "$COST" > "$TMPFILE"
mv "$TMPFILE" "$STATUS_DIR/$SESSION_ID.json"

exit 0
