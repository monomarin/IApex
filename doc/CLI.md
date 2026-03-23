# CLI Reference

IApex CLI now supports both:

- instance setup/diagnostics (`onboard`, `doctor`, `configure`, `env`, `allowed-hostname`)
- control-plane client operations (issues, approvals, agents, activity, dashboard)

## Base Usage

Use repo script in development:

```sh
pnpm IApexai --help
```

First-time local bootstrap + run:

```sh
pnpm IApexai run
```

Choose local instance:

```sh
pnpm IApexai run --instance dev
```

## Deployment Modes

Mode taxonomy and design intent are documented in `doc/DEPLOYMENT-MODES.md`.

Current CLI behavior:

- `IApexai onboard` and `IApexai configure --section server` set deployment mode in config
- runtime can override mode with `IApex_DEPLOYMENT_MODE`
- `IApexai run` and `IApexai doctor` do not yet expose a direct `--mode` flag

Target behavior (planned) is documented in `doc/DEPLOYMENT-MODES.md` section 5.

Allow an authenticated/private hostname (for example custom Tailscale DNS):

```sh
pnpm IApexai allowed-hostname dotta-macbook-pro
```

All client commands support:

- `--data-dir <path>`
- `--api-base <url>`
- `--api-key <token>`
- `--context <path>`
- `--profile <name>`
- `--json`

Company-scoped commands also support `--company-id <id>`.

Use `--data-dir` on any CLI command to isolate all default local state (config/context/db/logs/storage/secrets) away from `~/.IApex`:

```sh
pnpm IApexai run --data-dir ./tmp/IApex-dev
pnpm IApexai issue list --data-dir ./tmp/IApex-dev
```

## Context Profiles

Store local defaults in `~/.IApex/context.json`:

```sh
pnpm IApexai context set --api-base http://localhost:3100 --company-id <company-id>
pnpm IApexai context show
pnpm IApexai context list
pnpm IApexai context use default
```

To avoid storing secrets in context, set `apiKeyEnvVarName` and keep the key in env:

```sh
pnpm IApexai context set --api-key-env-var-name IApex_API_KEY
export IApex_API_KEY=...
```

## Company Commands

```sh
pnpm IApexai company list
pnpm IApexai company get <company-id>
pnpm IApexai company delete <company-id-or-prefix> --yes --confirm <same-id-or-prefix>
```

Examples:

```sh
pnpm IApexai company delete PAP --yes --confirm PAP
pnpm IApexai company delete 5cbe79ee-acb3-4597-896e-7662742593cd --yes --confirm 5cbe79ee-acb3-4597-896e-7662742593cd
```

Notes:

- Deletion is server-gated by `IApex_ENABLE_COMPANY_DELETION`.
- With agent authentication, company deletion is company-scoped. Use the current company ID/prefix (for example via `--company-id` or `IApex_COMPANY_ID`), not another company.

## Issue Commands

```sh
pnpm IApexai issue list --company-id <company-id> [--status todo,in_progress] [--assignee-agent-id <agent-id>] [--match text]
pnpm IApexai issue get <issue-id-or-identifier>
pnpm IApexai issue create --company-id <company-id> --title "..." [--description "..."] [--status todo] [--priority high]
pnpm IApexai issue update <issue-id> [--status in_progress] [--comment "..."]
pnpm IApexai issue comment <issue-id> --body "..." [--reopen]
pnpm IApexai issue checkout <issue-id> --agent-id <agent-id> [--expected-statuses todo,backlog,blocked]
pnpm IApexai issue release <issue-id>
```

## Agent Commands

```sh
pnpm IApexai agent list --company-id <company-id>
pnpm IApexai agent get <agent-id>
pnpm IApexai agent local-cli <agent-id-or-shortname> --company-id <company-id>
```

`agent local-cli` is the quickest way to run local Claude/Codex manually as a IApex agent:

- creates a new long-lived agent API key
- installs missing IApex skills into `~/.codex/skills` and `~/.claude/skills`
- prints `export ...` lines for `IApex_API_URL`, `IApex_COMPANY_ID`, `IApex_AGENT_ID`, and `IApex_API_KEY`

Example for shortname-based local setup:

```sh
pnpm IApexai agent local-cli codexcoder --company-id <company-id>
pnpm IApexai agent local-cli claudecoder --company-id <company-id>
```

## Approval Commands

```sh
pnpm IApexai approval list --company-id <company-id> [--status pending]
pnpm IApexai approval get <approval-id>
pnpm IApexai approval create --company-id <company-id> --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]
pnpm IApexai approval approve <approval-id> [--decision-note "..."]
pnpm IApexai approval reject <approval-id> [--decision-note "..."]
pnpm IApexai approval request-revision <approval-id> [--decision-note "..."]
pnpm IApexai approval resubmit <approval-id> [--payload '{"...":"..."}']
pnpm IApexai approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm IApexai activity list --company-id <company-id> [--agent-id <agent-id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard Commands

```sh
pnpm IApexai dashboard get --company-id <company-id>
```

## Heartbeat Command

`heartbeat run` now also supports context/api-key options and uses the shared client stack:

```sh
pnpm IApexai heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100] [--api-key <token>]
```

## Local Storage Defaults

Default local instance root is `~/.IApex/instances/default`:

- config: `~/.IApex/instances/default/config.json`
- embedded db: `~/.IApex/instances/default/db`
- logs: `~/.IApex/instances/default/logs`
- storage: `~/.IApex/instances/default/data/storage`
- secrets key: `~/.IApex/instances/default/secrets/master.key`

Override base home or instance with env vars:

```sh
IApex_HOME=/custom/home IApex_INSTANCE_ID=dev pnpm IApexai run
```

## Storage Configuration

Configure storage provider and settings:

```sh
pnpm IApexai configure --section storage
```

Supported providers:

- `local_disk` (default; local single-user installs)
- `s3` (S3-compatible object storage)
