#!/bin/bash
# Terminal Canvas - Claude Code Status Hook
# Only handles Stop and Notification(permission_prompt) events.

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

if [ -z "$SESSION_ID" ] || [ -z "$EVENT" ]; then
  exit 0
fi

STATUS_DIR="/tmp/terminal-canvas"
mkdir -p "$STATUS_DIR"

case "$EVENT" in
  Stop)
    STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
    if [ "$STOP_ACTIVE" = "true" ]; then
      exit 0
    fi
    STATUS="idle"
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

TMPFILE="$STATUS_DIR/.tmp.$$"
printf '{"status":"%s","cwd":"%s","timestamp":%d}\n' \
  "$STATUS" "$CWD" "$(date +%s)" > "$TMPFILE"
mv "$TMPFILE" "$STATUS_DIR/$SESSION_ID.json"

exit 0
