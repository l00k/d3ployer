# d3ployer

A TypeScript-based SSH deployment CLI tool. Runs tasks/scenarios against remote servers over SSH using rsync for file transfer.

**Why:** Provides a reusable, config-driven deployment pipeline for home-lab or similar server setups.

## Key source files

- `src/bin.ts` — shebang entry point (package.json `bin` exposes as `dpl`)
- `src/cli.ts` — Commander CLI: `deployer <name> [servers...]`, `deployer list`, supports `-c, --config <path>`
- `src/config.ts` — `defineConfig()` helper, applies server defaults, merges defaultTasks
- `src/configLoader.ts` — walks up directory tree to find `deployer.config.ts`, dynamic-imports it
- `src/connection.ts` — `createSSHConnection()` using ssh2-promise; supports key/password/agent auth
- `src/defaultTasks.ts` — built-in tasks: `upload` (rsync) and `symlinks` (ln -sfn over SSH)
- `src/def.ts` — all TypeScript types/interfaces (ServerConfig, TaskFn, TaskContext, DeployerConfig, etc.)
- `src/runner.ts` — `runScenario()` and `runTask()` using Listr2; connects SSH per server, runs tasks sequentially
- `src/index.ts` — public API re-exports
- `src/utils/Exception.ts` — custom Exception class with error code, reason chain, and stack rewriting
- `src/utils/index.ts` — barrel export for utils

## Core flow

1. CLI parses `<name> [servers...]`
2. `loadConfig()` finds and imports `deployer.config.ts`
3. If name matches a scenario key → `runScenario()`, else → `runTask()`
4. For each server: SSH connect → run task fns in order → SSH disconnect (via Listr2)

## Config structure (`deployer.config.ts`)

```ts
defineConfig({
  servers: { prod: { host, deployPath, ... } },
  files: { basePath, include, exclude },
  symlinks: [{ path, target }],
  tasks: { myTask: async (ctx, ph) => { ... } },
  scenarios: { deploy: ['upload', 'symlinks', 'myTask'] },
})
```

## Server defaults

- port: 22
- username: current OS user
- authMethod: 'agent' (uses SSH_AUTH_SOCK)

## TaskContext helpers

Available in TaskFn via `ctx`:
- `runRemote(cmd)` — execute command on remote server via SSH
- `runLocal(cmd)` — execute command locally via shell

## Placeholders

Available in TaskFn via `ph`: `serverName`, `deployPath`, `timestamp` (ISO, colons/dots replaced with dashes)

## Tech stack

- Runtime: Node (ESM, tsx for dev)
- CLI: commander
- SSH: ssh2-promise
- File sync: rsync (npm package wrapping system rsync)
- Task UI: listr2
- Utilities: lodash-es, chalk
- Build: tsc (tsconfig.build.json)
- Test: mocha + chai (c8 coverage)
- Lint: eslint + typescript-eslint + lint-staged + husky

