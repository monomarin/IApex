---
title: Setup Commands
summary: Onboard, run, doctor, and configure
---

Instance setup and diagnostics commands.

## `IApexai run`

One-command bootstrap and start:

```sh
pnpm IApexai run
```

Does:

1. Auto-onboards if config is missing
2. Runs `IApexai doctor` with repair enabled
3. Starts the server when checks pass

Choose a specific instance:

```sh
pnpm IApexai run --instance dev
```

## `IApexai onboard`

Interactive first-time setup:

```sh
pnpm IApexai onboard
```

First prompt:

1. `Quickstart` (recommended): local defaults (embedded database, no LLM provider, local disk storage, default secrets)
2. `Advanced setup`: full interactive configuration

Start immediately after onboarding:

```sh
pnpm IApexai onboard --run
```

Non-interactive defaults + immediate start (opens browser on server listen):

```sh
pnpm IApexai onboard --yes
```

## `IApexai doctor`

Health checks with optional auto-repair:

```sh
pnpm IApexai doctor
pnpm IApexai doctor --repair
```

Validates:

- Server configuration
- Database connectivity
- Secrets adapter configuration
- Storage configuration
- Missing key files

## `IApexai configure`

Update configuration sections:

```sh
pnpm IApexai configure --section server
pnpm IApexai configure --section secrets
pnpm IApexai configure --section storage
```

## `IApexai env`

Show resolved environment configuration:

```sh
pnpm IApexai env
```

## `IApexai allowed-hostname`

Allow a private hostname for authenticated/private mode:

```sh
pnpm IApexai allowed-hostname my-tailscale-host
```

## Local Storage Paths

| Data | Default Path |
|------|-------------|
| Config | `~/.IApex/instances/default/config.json` |
| Database | `~/.IApex/instances/default/db` |
| Logs | `~/.IApex/instances/default/logs` |
| Storage | `~/.IApex/instances/default/data/storage` |
| Secrets key | `~/.IApex/instances/default/secrets/master.key` |

Override with:

```sh
IApex_HOME=/custom/home IApex_INSTANCE_ID=dev pnpm IApexai run
```

Or pass `--data-dir` directly on any command:

```sh
pnpm IApexai run --data-dir ./tmp/IApex-dev
pnpm IApexai doctor --data-dir ./tmp/IApex-dev
```
