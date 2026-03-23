# Plugin Authoring Smoke Example

A IApex plugin

## Development

```bash
pnpm install
pnpm dev            # watch builds
pnpm dev:ui         # local dev server with hot-reload events
pnpm test
```

## Install Into IApex

```bash
pnpm IApexai plugin install ./
```

## Build Options

- `pnpm build` uses esbuild presets from `@iapexai/plugin-sdk/bundlers`.
- `pnpm build:rollup` uses rollup presets from the same SDK.
