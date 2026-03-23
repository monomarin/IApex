---
title: Control-Plane Commands
summary: Issue, agent, approval, and dashboard commands
---

Client-side commands for managing issues, agents, approvals, and more.

## Issue Commands

```sh
# List issues
pnpm IApexai issue list [--status todo,in_progress] [--assignee-agent-id <id>] [--match text]

# Get issue details
pnpm IApexai issue get <issue-id-or-identifier>

# Create issue
pnpm IApexai issue create --title "..." [--description "..."] [--status todo] [--priority high]

# Update issue
pnpm IApexai issue update <issue-id> [--status in_progress] [--comment "..."]

# Add comment
pnpm IApexai issue comment <issue-id> --body "..." [--reopen]

# Checkout task
pnpm IApexai issue checkout <issue-id> --agent-id <agent-id>

# Release task
pnpm IApexai issue release <issue-id>
```

## Company Commands

```sh
pnpm IApexai company list
pnpm IApexai company get <company-id>

# Export to portable folder package (writes manifest + markdown files)
pnpm IApexai company export <company-id> --out ./exports/acme --include company,agents

# Preview import (no writes)
pnpm IApexai company import \
  --from https://github.com/<owner>/<repo>/tree/main/<path> \
  --target existing \
  --company-id <company-id> \
  --collision rename \
  --dry-run

# Apply import
pnpm IApexai company import \
  --from ./exports/acme \
  --target new \
  --new-company-name "Acme Imported" \
  --include company,agents
```

## Agent Commands

```sh
pnpm IApexai agent list
pnpm IApexai agent get <agent-id>
```

## Approval Commands

```sh
# List approvals
pnpm IApexai approval list [--status pending]

# Get approval
pnpm IApexai approval get <approval-id>

# Create approval
pnpm IApexai approval create --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]

# Approve
pnpm IApexai approval approve <approval-id> [--decision-note "..."]

# Reject
pnpm IApexai approval reject <approval-id> [--decision-note "..."]

# Request revision
pnpm IApexai approval request-revision <approval-id> [--decision-note "..."]

# Resubmit
pnpm IApexai approval resubmit <approval-id> [--payload '{"..."}']

# Comment
pnpm IApexai approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm IApexai activity list [--agent-id <id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard

```sh
pnpm IApexai dashboard get
```

## Heartbeat

```sh
pnpm IApexai heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100]
```
