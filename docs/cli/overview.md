---
title: CLI Overview
summary: CLI installation and setup
---

The IApex CLI handles instance setup, diagnostics, and control-plane operations.

## Usage

```sh
pnpm IApexai --help
```

## Global Options

All commands support:

| Flag | Description |
|------|-------------|
| `--data-dir <path>` | Local IApex data root (isolates from `~/.IApex`) |
| `--api-base <url>` | API base URL |
| `--api-key <token>` | API authentication token |
| `--context <path>` | Context file path |
| `--profile <name>` | Context profile name |
| `--json` | Output as JSON |

Company-scoped commands also accept `--company-id <id>`.

For clean local instances, pass `--data-dir` on the command you run:

```sh
pnpm IApexai run --data-dir ./tmp/IApex-dev
```

## Context Profiles

Store defaults to avoid repeating flags:

```sh
# Set defaults
pnpm IApexai context set --api-base http://localhost:3100 --company-id <id>

# View current context
pnpm IApexai context show

# List profiles
pnpm IApexai context list

# Switch profile
pnpm IApexai context use default
```

To avoid storing secrets in context, use an env var:

```sh
pnpm IApexai context set --api-key-env-var-name IApex_API_KEY
export IApex_API_KEY=...
```

Context is stored at `~/.IApex/context.json`.

## Command Categories

The CLI has two categories:

1. **[Setup commands](/cli/setup-commands)** — instance bootstrap, diagnostics, configuration
2. **[Control-plane commands](/cli/control-plane-commands)** — issues, agents, approvals, activity
