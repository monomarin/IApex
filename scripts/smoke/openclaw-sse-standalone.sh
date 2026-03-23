#!/usr/bin/env bash
set -euo pipefail

log() {
  echo "[openclaw-sse-standalone] $*"
}

fail() {
  echo "[openclaw-sse-standalone] ERROR: $*" >&2
  exit 1
}

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || fail "missing required command: $cmd"
}

require_cmd curl
require_cmd jq
require_cmd grep

OPENCLAW_URL="${OPENCLAW_URL:-}"
OPENCLAW_METHOD="${OPENCLAW_METHOD:-POST}"
OPENCLAW_AUTH_HEADER="${OPENCLAW_AUTH_HEADER:-}"
OPENCLAW_TIMEOUT_SEC="${OPENCLAW_TIMEOUT_SEC:-180}"
OPENCLAW_MODEL="${OPENCLAW_MODEL:-openclaw}"
OPENCLAW_USER="${OPENCLAW_USER:-IApex-smoke}"

IApex_RUN_ID="${IApex_RUN_ID:-smoke-run-$(date +%s)}"
IApex_AGENT_ID="${IApex_AGENT_ID:-openclaw-smoke-agent}"
IApex_COMPANY_ID="${IApex_COMPANY_ID:-openclaw-smoke-company}"
IApex_API_URL="${IApex_API_URL:-http://localhost:3100}"
IApex_TASK_ID="${IApex_TASK_ID:-openclaw-smoke-task}"
IApex_WAKE_REASON="${IApex_WAKE_REASON:-openclaw_smoke_test}"
IApex_WAKE_COMMENT_ID="${IApex_WAKE_COMMENT_ID:-}"
IApex_APPROVAL_ID="${IApex_APPROVAL_ID:-}"
IApex_APPROVAL_STATUS="${IApex_APPROVAL_STATUS:-}"
IApex_LINKED_ISSUE_IDS="${IApex_LINKED_ISSUE_IDS:-}"
OPENCLAW_TEXT_PREFIX="${OPENCLAW_TEXT_PREFIX:-Standalone OpenClaw SSE smoke test.}"

[[ -n "$OPENCLAW_URL" ]] || fail "OPENCLAW_URL is required"

read -r -d '' TEXT_BODY <<EOF || true
${OPENCLAW_TEXT_PREFIX}

IApex_RUN_ID=${IApex_RUN_ID}
IApex_AGENT_ID=${IApex_AGENT_ID}
IApex_COMPANY_ID=${IApex_COMPANY_ID}
IApex_API_URL=${IApex_API_URL}
IApex_TASK_ID=${IApex_TASK_ID}
IApex_WAKE_REASON=${IApex_WAKE_REASON}
IApex_WAKE_COMMENT_ID=${IApex_WAKE_COMMENT_ID}
IApex_APPROVAL_ID=${IApex_APPROVAL_ID}
IApex_APPROVAL_STATUS=${IApex_APPROVAL_STATUS}
IApex_LINKED_ISSUE_IDS=${IApex_LINKED_ISSUE_IDS}

Run your IApex heartbeat procedure now.
EOF

PAYLOAD="$(jq -nc \
  --arg text "$TEXT_BODY" \
  --arg model "$OPENCLAW_MODEL" \
  --arg user "$OPENCLAW_USER" \
  --arg runId "$IApex_RUN_ID" \
  --arg agentId "$IApex_AGENT_ID" \
  --arg companyId "$IApex_COMPANY_ID" \
  --arg apiUrl "$IApex_API_URL" \
  --arg taskId "$IApex_TASK_ID" \
  --arg wakeReason "$IApex_WAKE_REASON" \
  --arg wakeCommentId "$IApex_WAKE_COMMENT_ID" \
  --arg approvalId "$IApex_APPROVAL_ID" \
  --arg approvalStatus "$IApex_APPROVAL_STATUS" \
  --arg linkedIssueIds "$IApex_LINKED_ISSUE_IDS" \
  '{
    model: $model,
    user: $user,
    input: $text,
    stream: true,
    metadata: {
      IApex_RUN_ID: $runId,
      IApex_AGENT_ID: $agentId,
      IApex_COMPANY_ID: $companyId,
      IApex_API_URL: $apiUrl,
      IApex_TASK_ID: $taskId,
      IApex_WAKE_REASON: $wakeReason,
      IApex_WAKE_COMMENT_ID: $wakeCommentId,
      IApex_APPROVAL_ID: $approvalId,
      IApex_APPROVAL_STATUS: $approvalStatus,
      IApex_LINKED_ISSUE_IDS: $linkedIssueIds,
      IApex_session_key: ("IApex:run:" + $runId)
    }
  }')"

headers_file="$(mktemp)"
body_file="$(mktemp)"
cleanup() {
  rm -f "$headers_file" "$body_file"
}
trap cleanup EXIT

args=(
  -sS
  -N
  --max-time "$OPENCLAW_TIMEOUT_SEC"
  -X "$OPENCLAW_METHOD"
  -H "content-type: application/json"
  -H "accept: text/event-stream"
  -H "x-openclaw-session-key: IApex:run:${IApex_RUN_ID}"
  -D "$headers_file"
  -o "$body_file"
  --data "$PAYLOAD"
  "$OPENCLAW_URL"
)

if [[ -n "$OPENCLAW_AUTH_HEADER" ]]; then
  args=(-H "Authorization: $OPENCLAW_AUTH_HEADER" "${args[@]}")
fi

log "posting SSE wake payload to ${OPENCLAW_URL}"
http_code="$(curl "${args[@]}" -w "%{http_code}")"
log "http status: ${http_code}"

if [[ ! "$http_code" =~ ^2 ]]; then
  tail -n 80 "$body_file" >&2 || true
  fail "non-success HTTP status: ${http_code}"
fi

if ! grep -Eqi '^content-type:.*text/event-stream' "$headers_file"; then
  tail -n 40 "$body_file" >&2 || true
  fail "response content-type was not text/event-stream"
fi

if grep -Eqi 'event:\s*(error|failed|cancel)|"status":"(failed|cancelled|error)"|"type":"[^"]*(failed|cancelled|error)"' "$body_file"; then
  tail -n 120 "$body_file" >&2 || true
  fail "stream reported a failure event"
fi

if ! grep -Eqi 'event:\s*(done|completed|response\.completed)|\[DONE\]|"status":"(completed|succeeded|done)"|"type":"response\.completed"' "$body_file"; then
  tail -n 120 "$body_file" >&2 || true
  fail "stream ended without a terminal completion marker"
fi

event_count="$(grep -Ec '^event:' "$body_file" || true)"
log "stream completed successfully (events=${event_count})"
echo
tail -n 40 "$body_file"
